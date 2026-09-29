import { z } from "zod";
import { MEMBERSHIP_ENDPOINT, HONEYPOT_FIELD } from "@shared/membership/api";
import type {
  FieldErrors,
  SolicitudAfiliacion,
} from "@shared/membership/schema";

export type SubmitOutcome =
  | Readonly<{ kind: "success"; referencia: string }>
  | Readonly<{ kind: "validation"; fields: FieldErrors }>
  | Readonly<{ kind: "unavailable" }>
  | Readonly<{ kind: "rate_limited" }>
  | Readonly<{ kind: "failed"; message: string }>;

/** Las respuestas del servidor también se validan: nunca se confía en la forma del JSON. */
const SuccessBody = z.object({
  referencia: z.string().min(1),
  recibidaEn: z.string(),
});
const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

const REQUEST_TIMEOUT_MS = 15_000;
const GENERIC_FAILURE =
  "No pudimos enviar tu solicitud. Verifica tu conexión e inténtalo de nuevo.";

export async function submitMembershipApplication(
  solicitud: SolicitudAfiliacion,
  honeypot: string
): Promise<SubmitOutcome> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(MEMBERSHIP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ ...solicitud, [HONEYPOT_FIELD]: honeypot }),
      signal: controller.signal,
      credentials: "same-origin",
    });
    const json: unknown = await response.json().catch(() => null);

    if (response.ok) {
      const body = SuccessBody.safeParse(json);
      return body.success
        ? { kind: "success", referencia: body.data.referencia }
        : { kind: "failed", message: GENERIC_FAILURE };
    }

    const body = ErrorBody.safeParse(json);
    const code = body.success ? body.data.error.code : "";
    switch (code) {
      case "VALIDATION_ERROR":
        return {
          kind: "validation",
          fields: body.success ? (body.data.error.fields ?? {}) : {},
        };
      case "INTAKE_UNAVAILABLE":
        return { kind: "unavailable" };
      case "RATE_LIMITED":
        return { kind: "rate_limited" };
      default:
        return {
          kind: "failed",
          message: body.success ? body.data.error.message : GENERIC_FAILURE,
        };
    }
  } catch {
    return { kind: "failed", message: GENERIC_FAILURE };
  } finally {
    window.clearTimeout(timer);
  }
}
