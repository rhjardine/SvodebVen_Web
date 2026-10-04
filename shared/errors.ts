import { z } from "zod";

/**
 * Taxonomía ÚNICA de errores de la API: cada código tiene un solo estado HTTP.
 * Servidor y cliente importan este módulo, así no pueden divergir.
 */
export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "FORBIDDEN_ORIGIN",
  "NOT_FOUND",
  "CONFLICT",
  "IDEMPOTENCY_KEY_REQUIRED",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_IN_PROGRESS",
  "UNSUPPORTED_MEDIA_TYPE",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "INTAKE_UNAVAILABLE",
  "SERVICE_UNAVAILABLE",
  "DELIVERY_FAILED",
  "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_STATUS: Readonly<Record<ApiErrorCode, number>> =
  Object.freeze({
    BAD_REQUEST: 400,
    VALIDATION_ERROR: 422,
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    FORBIDDEN_ORIGIN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    IDEMPOTENCY_KEY_REQUIRED: 400,
    IDEMPOTENCY_KEY_REUSED: 422,
    IDEMPOTENCY_IN_PROGRESS: 409,
    UNSUPPORTED_MEDIA_TYPE: 415,
    PAYLOAD_TOO_LARGE: 413,
    RATE_LIMITED: 429,
    INTAKE_UNAVAILABLE: 503,
    SERVICE_UNAVAILABLE: 503,
    DELIVERY_FAILED: 502,
    INTERNAL_ERROR: 500,
  });

/** Mapa campo → primer mensaje de error, apto para pintar errores en línea. */
export type FieldErrors = Readonly<Partial<Record<string, string>>>;

export function toFieldErrors(error: z.ZodError, prefix = ""): FieldErrors {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const segment = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    const key = `${prefix}${segment}`;
    if (!(key in errors)) errors[key] = issue.message;
  }
  return Object.freeze(errors);
}

export type ApiError = Readonly<{
  code: ApiErrorCode;
  message: string;
  fields?: FieldErrors;
}>;

export type ApiErrorBody = Readonly<{ error: ApiError }>;

export function apiError(
  code: ApiErrorCode,
  message: string,
  fields?: FieldErrors
): ApiError {
  return fields ? { code, message, fields } : { code, message };
}

export const apiErrorBody = (error: ApiError): ApiErrorBody => ({ error });

const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

function isApiErrorCode(value: string): value is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(value);
}

/** Interpreta el cuerpo de error de una respuesta; un código desconocido se trata como INTERNAL_ERROR. */
export function parseApiErrorBody(json: unknown): ApiError | null {
  const parsed = ApiErrorBodySchema.safeParse(json);
  if (!parsed.success) return null;
  const { code, message, fields } = parsed.data.error;
  return apiError(
    isApiErrorCode(code) ? code : "INTERNAL_ERROR",
    message,
    fields
  );
}
