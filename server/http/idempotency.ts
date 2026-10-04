import { createHash } from "node:crypto";
import { z } from "zod";
import { apiError, type ApiError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";

export const IDEMPOTENCY_HEADER = "idempotency-key";

/** Lo que `mountRoute` entrega al handler de una ruta `idempotent: true`. */
export type IdempotencyInput = Readonly<{
  key: string;
  /** `MÉTODO /ruta`: la misma clave en otra ruta es otra operación. */
  scope: string;
  /** SHA-256 de la solicitud validada: misma clave con otra carga útil es un error. */
  requestHash: Buffer;
}>;

const KeySchema = z.uuid();

/** JSON con claves ordenadas: dos objetos equivalentes producen el mismo texto. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const hashRequest = (parts: unknown): Buffer =>
  createHash("sha256").update(canonicalJson(parts)).digest();

export function readIdempotency(
  header: string | undefined,
  scope: string,
  parts: unknown
): Result<IdempotencyInput, ApiError> {
  const key = KeySchema.safeParse(header);
  if (!key.success) {
    return err(
      apiError(
        "IDEMPOTENCY_KEY_REQUIRED",
        "Falta la cabecera Idempotency-Key (un UUID por intento de la operación)."
      )
    );
  }
  return ok({ key: key.data, scope, requestHash: hashRequest(parts) });
}
