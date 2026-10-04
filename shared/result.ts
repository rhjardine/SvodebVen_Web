import type { z } from "zod";

/**
 * Resultado explícito para la lógica de negocio: los errores se propagan como
 * valores tipados, nunca con `throw`. Las excepciones de librerías externas
 * (BD, SMTP, red) se capturan UNA vez en el borde del adaptador con `tryAsync`.
 */
export type Success<T> = Readonly<{ success: true; value: T }>;
export type Failure<E> = Readonly<{ success: false; error: E }>;
export type Result<T, E> = Success<T> | Failure<E>;

export const ok = <T>(value: T): Success<T> =>
  Object.freeze({ success: true, value });

export const err = <E>(error: E): Failure<E> =>
  Object.freeze({ success: false, error });

export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return result.success ? ok(fn(result.value)) : result;
}

export function mapError<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return result.success ? result : err(fn(result.error));
}

/** Encadena un paso que también puede fallar (flatMap). */
export function andThen<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, F>
): Result<U, E | F> {
  return result.success ? fn(result.value) : result;
}

export async function andThenAsync<T, U, E, F>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, F>>
): Promise<Result<U, E | F>> {
  return result.success ? fn(result.value) : result;
}

export function match<T, E, R>(
  result: Result<T, E>,
  handlers: Readonly<{ success: (value: T) => R; failure: (error: E) => R }>
): R {
  return result.success
    ? handlers.success(result.value)
    : handlers.failure(result.error);
}

/** Devuelve el primer fallo o la lista completa de valores. */
export function all<T, E>(
  results: readonly Result<T, E>[]
): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.success) return result;
    values.push(result.value);
  }
  return ok(Object.freeze(values));
}

/** Valida con un esquema Zod (`safeParse`) y devuelve `Result` en vez de excepción. */
export function fromZod<S extends z.ZodType>(
  schema: S,
  input: unknown
): Result<z.output<S>, z.ZodError> {
  const parsed = schema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err(parsed.error);
}

/** Borde con código que lanza (BD, SMTP, red): convierte la excepción en error tipado. */
export async function tryAsync<T, E>(
  fn: () => Promise<T>,
  onError: (cause: unknown) => E
): Promise<Result<T, E>> {
  try {
    return ok(await fn());
  } catch (cause) {
    return err(onError(cause));
  }
}

export function trySync<T, E>(
  fn: () => T,
  onError: (cause: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (cause) {
    return err(onError(cause));
  }
}

/** Texto seguro de una causa desconocida (sin filtrar objetos internos). */
export function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : "unknown";
}
