import type {
  ClientInput,
  ResponseOf,
  RouteContract,
} from "@shared/contracts/define";
import {
  parseApiErrorBody,
  toFieldErrors,
  type ApiError,
  type FieldErrors,
} from "@shared/errors";
import { err, ok, tryAsync, type Result } from "@shared/result";

/** Errores del cliente, siempre como valores (nunca excepciones). */
export type ClientError =
  | Readonly<{ kind: "INVALID_INPUT"; fields: FieldErrors }>
  | Readonly<{ kind: "API"; status: number; error: ApiError }>
  | Readonly<{ kind: "BAD_RESPONSE" }>
  | Readonly<{ kind: "NETWORK" }>
  | Readonly<{ kind: "TIMEOUT" }>;

export type CallOptions = Readonly<{
  /** UUID por intento de operación (obligatorio si el contrato es `idempotent`). */
  idempotencyKey?: string;
  /** Campos extra de nivel superior en el cuerpo (p. ej. el campo trampa anti-bots). */
  extraBody?: Readonly<Record<string, string>>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Prefijo absoluto (pruebas o SSR). En el navegador se usa el mismo origen. */
  baseUrl?: string;
}>;

const DEFAULT_TIMEOUT_MS = 15_000;

function readPart(input: unknown, key: string): unknown {
  return typeof input === "object" && input !== null
    ? (Reflect.get(input, key) as unknown)
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildUrl(contract: RouteContract, params: unknown, query: unknown) {
  const values = isRecord(params) ? params : {};
  const path = contract.path.replace(
    /:([A-Za-z0-9_]+)/g,
    (_match, name: string) => {
      const value = values[name];
      const text =
        typeof value === "string" || typeof value === "number"
          ? String(value)
          : "";
      return encodeURIComponent(text);
    }
  );
  const search = new URLSearchParams();
  if (isRecord(query)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        search.append(key, String(item));
      }
    }
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Llama a una ruta a partir de su contrato: valida la entrada ANTES de enviarla
 * y la respuesta ANTES de devolverla. Tipos de entrada y salida salen del contrato.
 */
export async function callApi<C extends RouteContract>(
  contract: C,
  input: ClientInput<C>,
  options: CallOptions = {}
): Promise<Result<ResponseOf<C>, ClientError>> {
  // 1) Validación de entrada (UX): el servidor la repite siempre.
  const fields: Record<string, string> = {};
  const valid: Record<string, unknown> = {};
  for (const [name, schema, prefix] of [
    ["params", contract.params, "params."],
    ["query", contract.query, "query."],
    ["body", contract.body, ""],
  ] as const) {
    if (!schema) continue;
    const parsed = schema.safeParse(readPart(input, name));
    if (parsed.success) valid[name] = parsed.data;
    else Object.assign(fields, toFieldErrors(parsed.error, prefix));
  }
  if (Object.keys(fields).length > 0) {
    return err({ kind: "INVALID_INPUT", fields });
  }

  // 2) Petición con tiempo límite.
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  const headers: Record<string, string> = { Accept: "application/json" };
  const hasBody = contract.body !== undefined;
  if (hasBody) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey)
    headers["Idempotency-Key"] = options.idempotencyKey;

  const body = hasBody
    ? JSON.stringify({
        ...(isRecord(valid.body) ? valid.body : {}),
        ...options.extraBody,
      })
    : undefined;

  const response = await tryAsync(
    () =>
      fetch(
        `${options.baseUrl ?? ""}${buildUrl(contract, valid.params, valid.query)}`,
        {
          method: contract.method,
          headers,
          body,
          signal: controller.signal,
          credentials: "same-origin",
        }
      ),
    (): ClientError =>
      controller.signal.aborted ? { kind: "TIMEOUT" } : { kind: "NETWORK" }
  );
  clearTimeout(timer);
  options.signal?.removeEventListener("abort", onAbort);
  if (!response.success) return response;

  // 3) Interpretación de la respuesta.
  const res = response.value;
  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const apiErr = parseApiErrorBody(json);
    return apiErr
      ? err({ kind: "API", status: res.status, error: apiErr })
      : err({ kind: "BAD_RESPONSE" });
  }

  const payload = contract.response.safeParse(json);
  return payload.success
    ? ok(payload.data as ResponseOf<C>)
    : err({ kind: "BAD_RESPONSE" });
}
