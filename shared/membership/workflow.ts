import { z } from "zod";
import { err, ok, type Result } from "../result";

/**
 * Ciclo de vida de un expediente de afiliación. Función pura: no toca la base de datos ni el reloj,
 * así que cada regla se prueba sin infraestructura. APROBADA y RECHAZADA son estados finales.
 */
export const ESTADOS = [
  "RECIBIDA",
  "EN_REVISION",
  "REQUIERE_INFORMACION",
  "APROBADA",
  "RECHAZADA",
] as const;
export type Estado = (typeof ESTADOS)[number];

export const EVENTOS = [
  "INICIAR_REVISION",
  "SOLICITAR_INFORMACION",
  "REANUDAR_REVISION",
  "APROBAR",
  "RECHAZAR",
] as const;
export type Evento = (typeof EVENTOS)[number];

export const EstadoSchema = z.enum(ESTADOS);
export const EventoSchema = z.enum(EVENTOS);

export type TransitionError = Readonly<{
  kind: "INVALID_TRANSITION";
  desde: Estado;
  evento: Evento;
}>;

const TRANSITIONS: Readonly<
  Record<Estado, Readonly<Partial<Record<Evento, Estado>>>>
> = {
  RECIBIDA: { INICIAR_REVISION: "EN_REVISION" },
  EN_REVISION: {
    SOLICITAR_INFORMACION: "REQUIERE_INFORMACION",
    APROBAR: "APROBADA",
    RECHAZAR: "RECHAZADA",
  },
  REQUIERE_INFORMACION: {
    REANUDAR_REVISION: "EN_REVISION",
    RECHAZAR: "RECHAZADA",
  },
  APROBADA: {},
  RECHAZADA: {},
};

export function transition(
  desde: Estado,
  evento: Evento
): Result<Estado, TransitionError> {
  const hacia = TRANSITIONS[desde][evento];
  return hacia ? ok(hacia) : err({ kind: "INVALID_TRANSITION", desde, evento });
}

/** Eventos permitidos desde un estado (para que la interfaz solo ofrezca acciones válidas). */
export function allowedEvents(desde: Estado): readonly Evento[] {
  return EVENTOS.filter(evento => TRANSITIONS[desde][evento] !== undefined);
}

export const isFinal = (estado: Estado): boolean =>
  allowedEvents(estado).length === 0;
