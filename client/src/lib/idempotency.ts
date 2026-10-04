import type { ClientError } from "./api";

/**
 * Clave de idempotencia por INTENTO de operación: se crea al abrir el formulario y se reutiliza
 * en los reintentos por fallo de red (el servidor repite la respuesta si la primera sí llegó).
 * Tras una respuesta definitiva del servidor (éxito o rechazo 4xx) se renueva.
 */
export type AttemptKey = Readonly<{
  current: () => string;
  /** Llamar con cada resultado de la operación: renueva la clave cuando el intento terminó. */
  settle: (outcome: "success" | ClientError) => void;
}>;

export function createAttemptKey(
  generate: () => string = () => crypto.randomUUID()
): AttemptKey {
  let key = generate();
  return {
    current: () => key,
    settle: outcome => {
      const definitive =
        outcome === "success" ||
        (outcome.kind === "API" &&
          outcome.status >= 400 &&
          outcome.status < 500) ||
        outcome.kind === "INVALID_INPUT";
      if (definitive) key = generate();
    },
  };
}
