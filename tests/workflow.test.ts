import { describe, expect, it } from "vitest";
import {
  allowedEvents,
  ESTADOS,
  EVENTOS,
  isFinal,
  transition,
} from "../shared/membership/workflow";

describe("máquina de estados del expediente", () => {
  it("recorre el camino feliz", () => {
    const steps = [
      ["RECIBIDA", "INICIAR_REVISION", "EN_REVISION"],
      ["EN_REVISION", "SOLICITAR_INFORMACION", "REQUIERE_INFORMACION"],
      ["REQUIERE_INFORMACION", "REANUDAR_REVISION", "EN_REVISION"],
      ["EN_REVISION", "APROBAR", "APROBADA"],
    ] as const;
    for (const [desde, evento, hacia] of steps) {
      const result = transition(desde, evento);
      expect(result.success && result.value).toBe(hacia);
    }
  });

  it("no se puede aprobar sin revisar ni salir de un estado final", () => {
    expect(transition("RECIBIDA", "APROBAR").success).toBe(false);
    for (const evento of EVENTOS) {
      expect(transition("APROBADA", evento).success).toBe(false);
      expect(transition("RECHAZADA", evento).success).toBe(false);
    }
  });

  it("solo APROBADA y RECHAZADA son finales y allowedEvents coincide con transition", () => {
    expect(ESTADOS.filter(isFinal)).toEqual(["APROBADA", "RECHAZADA"]);
    for (const estado of ESTADOS) {
      for (const evento of EVENTOS) {
        expect(allowedEvents(estado).includes(evento)).toBe(
          transition(estado, evento).success
        );
      }
    }
  });

  it("devuelve un error tipado con el origen y el evento", () => {
    const result = transition("RECIBIDA", "RECHAZAR");
    expect(!result.success && result.error).toEqual({
      kind: "INVALID_TRANSITION",
      desde: "RECIBIDA",
      evento: "RECHAZAR",
    });
  });
});
