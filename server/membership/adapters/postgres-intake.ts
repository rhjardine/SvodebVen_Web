import { randomUUID } from "node:crypto";
import { z } from "zod";
import { err, ok, type Result } from "../../../shared/result";
import {
  withIdempotency,
  type JsonValue,
} from "../../adapters/postgres/idempotency";
import type { DbError } from "../../adapters/postgres/errors";
import type { DbPool } from "../../adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
  type IdentityTx,
} from "../../adapters/postgres/with-identity";
import type {
  ApplicationIntake,
  DeliveryContext,
  DeliveryFailure,
  Logger,
  MembershipApplication,
  Receipt,
} from "../submit-application";

/** Versión del aviso de privacidad aceptado. PENDIENTE: actualizar tras la revisión legal. */
export const CONSENT_VERSION = "privacidad-borrador-1";

const ANON: Actor = Object.freeze({ role: "anon", memberId: null });

const StoredReceiptSchema = z.object({
  referencia: z.string().min(1),
  recibidaEn: z.iso.datetime(),
});

async function insertApplication(
  tx: IdentityTx,
  application: MembershipApplication
): Promise<Result<JsonValue, DbError>> {
  const { datos } = application;
  const id = randomUUID();
  // Sin RETURNING: el alta anónima no tiene política SELECT (los datos solo los lee secretaría).
  const inserted = await tx.query(
    `INSERT INTO applications
       (id, referencia, categoria, email, datos, consentimiento_en, consentimiento_version, recibida_en)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $6)`,
    [
      id,
      application.referencia,
      datos.categoria,
      datos.email,
      JSON.stringify(datos),
      application.recibidaEn,
      CONSENT_VERSION,
    ]
  );
  if (!inserted.success) return inserted;
  const logged = await tx.query(
    `INSERT INTO application_events (application_id, desde, hacia) VALUES ($1, NULL, 'RECIBIDA')`,
    [id]
  );
  if (!logged.success) return logged;
  return ok({
    referencia: application.referencia,
    recibidaEn: application.recibidaEn.toISOString(),
  });
}

/**
 * Persiste PRIMERO el expediente (única fuente de verdad) y notifica DESPUÉS: si el correo falla
 * no se revierte nada, la secretaría igual lo ve en su bandeja. Con `Idempotency-Key` el reintento
 * devuelve la referencia original sin crear un segundo expediente.
 */
export class PostgresApplicationIntake implements ApplicationIntake {
  readonly isConfigured = true;

  constructor(
    private readonly pool: DbPool,
    private readonly notifier: ApplicationIntake | null,
    private readonly logger: Logger
  ) {}

  async deliver(
    application: MembershipApplication,
    context: DeliveryContext
  ): Promise<Result<Receipt, DeliveryFailure>> {
    const stored = context.idempotency
      ? await withIdempotency(this.pool, ANON, context.idempotency, tx =>
          insertApplication(tx, application)
        )
      : await withIdentity(this.pool, ANON, tx =>
          insertApplication(tx, application)
        ).then(result =>
          result.success ? ok({ body: result.value, replayed: false }) : result
        );
    if (!stored.success) {
      return err({
        reason: stored.error.kind,
        keyReused: stored.error.kind === "KEY_REUSED",
      });
    }

    const receipt = StoredReceiptSchema.safeParse(stored.value.body);
    if (!receipt.success) return err({ reason: "RECEIPT_SHAPE" });

    if (this.notifier && !stored.value.replayed) {
      void this.notifier.deliver(application, context).then(notified => {
        if (!notified.success) {
          this.logger.error("membership.notification_failed", {
            referencia: application.referencia,
            reason: notified.error.reason,
          });
        }
      });
    }
    return ok({
      referencia: receipt.data.referencia,
      recibidaEn: new Date(receipt.data.recibidaEn),
    });
  }
}
