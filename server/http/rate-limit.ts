import type { Request, RequestHandler } from "express";
import { apiError } from "../../shared/errors";
import { respondError } from "./respond";

export type RateLimitOptions = Readonly<{
  windowMs: number;
  max: number;
  now?: () => number;
  /** Clave de agrupación; por defecto la IP. Útil para limitar por correo, etc. */
  keyOf?: (req: Request) => string;
  /** Tope de claves en memoria (defensa ante claves inventadas, p. ej. correos). Por defecto 20 000. */
  maxKeys?: number;
}>;

type Bucket = { count: number; resetAt: number };

/**
 * Limitador de ventana fija en memoria.
 * Suficiente para una sola instancia; con varias réplicas, sustituir por Redis/Postgres.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  const now = options.now ?? Date.now;
  const buckets = new Map<string, Bucket>();

  const sweep = () => {
    const current = now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= current) buckets.delete(key);
    }
  };
  const timer = setInterval(sweep, options.windowMs);
  timer.unref();

  return (req, res, next) => {
    const key = options.keyOf ? options.keyOf(req) : (req.ip ?? "unknown");
    const current = now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= current) {
      if (!bucket && buckets.size >= (options.maxKeys ?? 20_000)) {
        // Memoria acotada: se descarta la clave más antigua (el Map conserva el orden de inserción).
        const oldest = buckets.keys().next();
        if (!oldest.done) buckets.delete(oldest.value);
      }
      buckets.set(key, { count: 1, resetAt: current + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - current) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      respondError(
        res,
        apiError(
          "RATE_LIMITED",
          "Recibimos demasiadas solicitudes desde tu conexión. Intenta de nuevo en unos minutos."
        )
      );
      return;
    }
    next();
  };
}
