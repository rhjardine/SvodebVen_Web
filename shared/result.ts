/** Resultado explícito para flujos de dominio: sin excepciones como control de flujo. */
export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const ok = <T>(value: T): Result<T, never> =>
  Object.freeze({ ok: true, value });
export const err = <E>(error: E): Result<never, E> =>
  Object.freeze({ ok: false, error });
