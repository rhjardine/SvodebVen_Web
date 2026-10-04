import { z } from "zod";
import { err, ok, type Result } from "../../../shared/result";
import type { IdempotencyInput } from "../../http/idempotency";
import type { DbError } from "./errors";
import type { DbPool } from "./pool";
import { withIdentity, type Actor, type IdentityTx } from "./with-identity";

export const IDEMPOTENCY_RETENTION_HOURS = 24;

export type IdempotencyConflict = Readonly<{ kind: "KEY_REUSED" }>;

/** Respuesta ya serializable: es lo que se guarda y lo que se repite tal cual. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type IdempotentOutcome = Readonly<{
  body: JsonValue;
  /** `true` si se repitió la respuesta guardada sin ejecutar la operación otra vez. */
  replayed: boolean;
}>;

const StoredSchema = z.object({
  request_hash: z.instanceof(Buffer),
  response_body: z.unknown(),
  expires_at: z.date(),
});

/**
 * Ejecuta `work` como máximo UNA vez por (scope, key), dentro de la misma transacción que la
 * operación. Concurrencia: el INSERT choca con el índice único; la segunda petición espera a que
 * la primera confirme y entonces repite su respuesta (no hay carrera ni doble efecto).
 * - misma clave + misma solicitud → repite la respuesta guardada.
 * - misma clave + otra solicitud (o clave de otro actor) → KEY_REUSED (422).
 * - `work` devuelve `err` → ROLLBACK: nada se guarda y la clave queda libre.
 */
export async function withIdempotency<E>(
  pool: DbPool,
  actor: Actor,
  input: IdempotencyInput,
  work: (tx: IdentityTx) => Promise<Result<JsonValue, E>>,
  now: () => Date = () => new Date()
): Promise<Result<IdempotentOutcome, E | IdempotencyConflict | DbError>> {
  return withIdentity(
    pool,
    actor,
    async (
      tx
    ): Promise<
      Result<IdempotentOutcome, E | IdempotencyConflict | DbError>
    > => {
      const expiresAt = new Date(
        now().getTime() + IDEMPOTENCY_RETENTION_HOURS * 3_600_000
      );
      const claimed = await tx.query(
        `INSERT INTO idempotency_keys (scope, key, actor_id, actor_role, request_hash, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (scope, key) DO NOTHING
         RETURNING 1 AS inserted`,
        [
          input.scope,
          input.key,
          actor.memberId,
          actor.role,
          input.requestHash,
          expiresAt,
        ]
      );
      if (!claimed.success) return claimed;

      if (claimed.value.length === 0) {
        const existing = await tx.select(
          StoredSchema,
          `SELECT request_hash, response_body, expires_at FROM idempotency_keys
           WHERE scope = $1 AND key = $2`,
          [input.scope, input.key]
        );
        if (!existing.success) return existing;
        const row = existing.value[0];
        // Sin fila visible: la clave pertenece a otro actor (RLS la oculta).
        if (!row || !row.request_hash.equals(input.requestHash)) {
          return err({ kind: "KEY_REUSED" });
        }
        const parsed = z.json().safeParse(row.response_body);
        if (!parsed.success) {
          return err({
            kind: "ROW_SHAPE",
            message: "Respuesta guardada ilegible",
          });
        }
        return ok({ body: parsed.data, replayed: true });
      }

      const outcome = await work(tx);
      if (!outcome.success) return outcome;
      const saved = await tx.query(
        `UPDATE idempotency_keys SET response_body = $3::jsonb
         WHERE scope = $1 AND key = $2`,
        [input.scope, input.key, JSON.stringify(outcome.value)]
      );
      if (!saved.success) return saved;
      return ok({ body: outcome.value, replayed: false });
    }
  );
}

/** Borra las claves vencidas (retención 24 h). Corre como `system`; devuelve cuántas eliminó. */
export async function purgeExpiredIdempotencyKeys(
  pool: DbPool
): Promise<Result<number, DbError>> {
  const purged = await withIdentity(
    pool,
    { role: "system", memberId: null },
    async tx => {
      const rows = await tx.query(
        "DELETE FROM idempotency_keys WHERE expires_at < now() RETURNING 1 AS gone"
      );
      return rows.success ? ok(rows.value.length) : rows;
    }
  );
  return purged;
}
