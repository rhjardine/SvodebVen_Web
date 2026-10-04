import type { RequestHandler } from "express";

export type HoneypotOptions = Readonly<{
  /** Nombre del campo trampa en el cuerpo JSON. */
  field: string;
  /** Respuesta señuelo indistinguible de un éxito (el bot no recibe señales). */
  decoy: () => Readonly<{ status: number; body: unknown }>;
  onTrip: () => void;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Debe ir DESPUÉS de `express.json()`. Si el campo trampa trae valor, descarta el envío. */
export function honeypotGuard(options: HoneypotOptions): RequestHandler {
  return (req, res, next) => {
    const body: unknown = req.body;
    const value = isRecord(body) ? body[options.field] : undefined;
    if (typeof value === "string" && value !== "") {
      options.onTrip();
      const { status, body: decoyBody } = options.decoy();
      res.setHeader("Cache-Control", "no-store");
      res.status(status).json(decoyBody);
      return;
    }
    next();
  };
}
