import type { FieldErrors } from "./schema";

/** Contrato HTTP compartido entre cliente y servidor (fuente única de verdad). */
export const MEMBERSHIP_ENDPOINT = "/api/v1/afiliaciones" as const;

/** Campo trampa: los humanos no lo ven; si llega con valor, es un bot. */
export const HONEYPOT_FIELD = "sitio_web" as const;

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "INTAKE_UNAVAILABLE"
  | "DELIVERY_FAILED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "FORBIDDEN_ORIGIN"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export type ApiErrorBody = Readonly<{
  error: Readonly<{
    code: ApiErrorCode;
    message: string;
    fields?: FieldErrors;
  }>;
}>;

export type SubmitApplicationSuccess = Readonly<{
  referencia: string;
  recibidaEn: string;
}>;
