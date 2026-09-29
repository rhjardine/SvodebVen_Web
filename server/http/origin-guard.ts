import type { RequestHandler } from "express";
import type { ApiErrorBody } from "../../shared/membership/api";

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
    const body: ApiErrorBody = {
      error: { code: "FORBIDDEN_ORIGIN", message: "Origen no autorizado." },
    };
    res.status(403).json(body);
  };
}
