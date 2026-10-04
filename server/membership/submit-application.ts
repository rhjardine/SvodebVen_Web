import { randomInt } from "node:crypto";
import type { SolicitudAfiliacion } from "../../shared/membership/schema";
import { err, ok, type Result } from "../../shared/result";
import type { IdempotencyInput } from "../http/idempotency";

// ─── Dominio ────────────────────────────────────────────────────────────────

/** Solicitud aceptada por la sociedad. Inmutable una vez creada. */
export type MembershipApplication = Readonly<{
  referencia: string;
  recibidaEn: Date;
  datos: SolicitudAfiliacion;
}>;

export type SubmitApplicationError =
  | Readonly<{ kind: "INTAKE_UNAVAILABLE" }>
  | Readonly<{ kind: "IDEMPOTENCY_KEY_REUSED" }>
  | Readonly<{ kind: "DELIVERY_FAILED"; cause: string }>;

// ─── Puertos (implementados en infraestructura) ─────────────────────────────

/** Fallo de entrega ya traducido por el adaptador (nunca una excepción). */
export type DeliveryFailure = Readonly<{
  reason: string;
  /** La Idempotency-Key ya se usó con otra solicitud. */
  keyReused?: boolean;
}>;

/** Comprobante de recepción. En un reintento idempotente es el de la PRIMERA recepción. */
export type Receipt = Readonly<{ referencia: string; recibidaEn: Date }>;

/** Contexto de la petición que el destino puede usar para deduplicar (si soporta transacciones). */
export type DeliveryContext = Readonly<{
  idempotency: IdempotencyInput | null;
}>;

/** Destino de las solicitudes: base de datos (persistente) y/o correo de secretaría. */
export interface ApplicationIntake {
  readonly isConfigured: boolean;
  deliver(
    application: MembershipApplication,
    context: DeliveryContext
  ): Promise<Result<Receipt, DeliveryFailure>>;
}

export interface Clock {
  now(): Date;
}

export interface ReferenceGenerator {
  next(at: Date): string;
}

export interface Logger {
  info(
    event: string,
    meta?: Readonly<Record<string, string | number | boolean>>
  ): void;
  error(
    event: string,
    meta?: Readonly<Record<string, string | number | boolean>>
  ): void;
}

// ─── Adaptadores por defecto sin dependencias externas ─────────────────────

export const systemClock: Clock = { now: () => new Date() };

/** Sin caracteres ambiguos (0/O, 1/I/L) para dictarla por teléfono o WhatsApp. */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const randomReference: ReferenceGenerator = {
  next(at) {
    let suffix = "";
    for (let i = 0; i < 6; i += 1) {
      suffix += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
    }
    return `SVD-${at.getUTCFullYear()}-${suffix}`;
  },
};

// ─── Caso de uso ────────────────────────────────────────────────────────────

export type SubmitApplicationDeps = Readonly<{
  intake: ApplicationIntake;
  clock: Clock;
  references: ReferenceGenerator;
  logger: Logger;
}>;

export function makeSubmitApplication(deps: SubmitApplicationDeps) {
  /** Recibe datos YA validados por el contrato de la ruta (frontera HTTP). */
  return async function submitApplication(
    datos: SolicitudAfiliacion,
    context: DeliveryContext = { idempotency: null }
  ): Promise<Result<Receipt, SubmitApplicationError>> {
    if (!deps.intake.isConfigured) {
      deps.logger.error("membership.intake_unavailable");
      return err({ kind: "INTAKE_UNAVAILABLE" });
    }

    const recibidaEn = deps.clock.now();
    const application: MembershipApplication = Object.freeze({
      referencia: deps.references.next(recibidaEn),
      recibidaEn,
      datos: Object.freeze({ ...datos }),
    });

    const delivery = await deps.intake.deliver(application, context);
    if (!delivery.success) {
      if (delivery.error.keyReused)
        return err({ kind: "IDEMPOTENCY_KEY_REUSED" });
      // Solo se registra la referencia: nunca datos personales en los logs.
      deps.logger.error("membership.delivery_failed", {
        referencia: application.referencia,
        reason: delivery.error.reason,
      });
      return err({ kind: "DELIVERY_FAILED", cause: delivery.error.reason });
    }

    deps.logger.info("membership.application_received", {
      referencia: delivery.value.referencia,
      categoria: application.datos.categoria,
    });
    return ok(delivery.value);
  };
}

export type SubmitApplication = ReturnType<typeof makeSubmitApplication>;
