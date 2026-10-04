import { HONEYPOT_FIELD } from "@shared/membership/api";
import { submitApplicationContract } from "@shared/membership/contract";
import type { FieldErrors } from "@shared/errors";
import type { SolicitudAfiliacion } from "@shared/membership/schema";
import { callApi, type ClientError } from "@/lib/api";
import { createAttemptKey, type AttemptKey } from "@/lib/idempotency";

/** Una clave por intento de afiliación; se reutiliza en reintentos por fallo de red. */
let attempt: AttemptKey | null = null;

/** Resultados que la planilla sabe presentar (traducción de los errores genéricos del cliente). */
export type SubmitOutcome =
  | Readonly<{ kind: "success"; referencia: string }>
  | Readonly<{ kind: "validation"; fields: FieldErrors }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "rate_limited" }>
  | Readonly<{ kind: "failed"; message: string }>;

const GENERIC_FAILURE =
  "No pudimos enviar tu solicitud. Verifica tu conexión e inténtalo de nuevo.";

function toOutcome(error: ClientError): SubmitOutcome {
  switch (error.kind) {
    case "INVALID_INPUT":
      return { kind: "validation", fields: error.fields };
    case "API": {
      const { code, fields, message } = error.error;
      if (code === "VALIDATION_ERROR") {
        return { kind: "validation", fields: fields ?? {} };
      }
      if (code === "INTAKE_UNAVAILABLE") return { kind: "unavailable" };
      if (code === "RATE_LIMITED") return { kind: "rate_limited" };
      return { kind: "failed", message };
    }
    case "BAD_RESPONSE":
    case "NETWORK":
    case "TIMEOUT":
      return { kind: "failed", message: GENERIC_FAILURE };
  }
}

export async function submitMembershipApplication(
  solicitud: SolicitudAfiliacion,
  honeypot: string
): Promise<SubmitOutcome> {
  attempt ??= createAttemptKey();
  const result = await callApi(
    submitApplicationContract,
    { body: solicitud },
    {
      extraBody: { [HONEYPOT_FIELD]: honeypot },
      idempotencyKey: attempt.current(),
    }
  );
  attempt.settle(result.success ? "success" : result.error);
  return result.success
    ? { kind: "success", referencia: result.value.referencia }
    : toOutcome(result.error);
}
