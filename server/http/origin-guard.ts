import type { RequestHandler } from "express";
import { apiError } from "../../shared/errors";
import { respondError } from "./respond";

/**
 * Defensa CSRF complementaria: si hay orígenes configurados, un POST desde un
 * navegador con `Origin` ajeno se rechaza. Clientes sin `Origin` (curl, monitoreo)
 * siguen sujetos a validación, rate limit y honeypot.
 */
export function originGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    const origin = req.get("origin");
    if (allowed.size === 0 || origin === undefined || allowed.has(origin)) {
      next();
      return;
    }
    respondError(res, apiError("FORBIDDEN_ORIGIN", "Origen no autorizado."));
  };
}
