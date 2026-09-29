import { randomInt } from "node:crypto";
import {
  SolicitudAfiliacionSchema,
  toFieldErrors,
  type FieldErrors,
  type SolicitudAfiliacion,
} from "../../shared/membership/schema";
import { err, ok, type Result } from "../../shared/result";

// ─── Dominio ────────────────────────────────────────────────────────────────

/** Solicitud aceptada por la sociedad. Inmutable una vez creada. */
export type MembershipApplication = Readonly<{
  referencia: string;
  recibidaEn: Date;
  datos: SolicitudAfiliacion;
}>;

export type SubmitApplicationError =
  | Readonly<{ kind: "VALIDATION"; fields: FieldErrors }>
  | Readonly<{ kind: "INTAKE_UNAVAILABLE" }>
  | Readonly<{ kind: "DELIVERY_FAILED"; cause: string }>;

// ─── Puertos (implementados en infraestructura) ─────────────────────────────

/** Destino de las solicitudes: correo de secretaría hoy, base de datos mañana. */
export interface ApplicationIntake {
  readonly isConfigured: boolean;
  deliver(application: MembershipApplication): Promise<void>;
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
  return async function submitApplication(
    raw: unknown
  ): Promise<Result<MembershipApplication, SubmitApplicationError>> {
    const parsed = SolicitudAfiliacionSchema.safeParse(raw);
    if (!parsed.success) {
      return err({ kind: "VALIDATION", fields: toFieldErrors(parsed.error) });
    }

    if (!deps.intake.isConfigured) {
      deps.logger.error("membership.intake_unavailable");
      return err({ kind: "INTAKE_UNAVAILABLE" });
    }

    const recibidaEn = deps.clock.now();
    const application: MembershipApplication = Object.freeze({
      referencia: deps.references.next(recibidaEn),
      recibidaEn,
      datos: Object.freeze({ ...parsed.data }),
    });

    try {
      await deps.intake.deliver(application);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "unknown";
      // Solo se registra la referencia: nunca datos personales en los logs.
      deps.logger.error("membership.delivery_failed", {
        referencia: application.referencia,
        reason,
      });
      return err({ kind: "DELIVERY_FAILED", cause: reason });
    }

    deps.logger.info("membership.application_received", {
      referencia: application.referencia,
      categoria: application.datos.categoria,
    });
    return ok(application);
  };
}

export type SubmitApplication = ReturnType<typeof makeSubmitApplication>;
