import compression from "compression";
import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import path from "node:path";
import { apiError } from "../shared/errors";
import { HONEYPOT_FIELD, MEMBERSHIP_ENDPOINT } from "../shared/membership/api";
import {
  CLIENT_ROUTES,
  NOT_FOUND_PAGE,
  PRERENDERED_ROUTES,
} from "../shared/routes";
import { honeypotGuard } from "./http/honeypot";
import { originGuard } from "./http/origin-guard";
import { rateLimit } from "./http/rate-limit";
import { securityHeaders } from "./http/security-headers";
import { respondError } from "./http/respond";
import { mountMembershipRoutes } from "./membership/http-routes";
import {
  randomReference,
  type Logger,
  type SubmitApplication,
} from "./membership/submit-application";

export type AppDeps = Readonly<{
  submitApplication: SubmitApplication;
  logger: Logger;
  trustProxyHops: number;
  allowedOrigins: readonly string[];
  hsts: boolean;
  /** Directorio del build del cliente; `null` en desarrollo/pruebas (Vite sirve el front). */
  staticDir: string | null;
  /** URL pública canónica (p. ej. https://svodeb.org). Habilita sitemap.xml. */
  publicSiteUrl: string | null;
  membershipRateLimit?: Readonly<{ windowMs: number; max: number }>;
}>;

const DEFAULT_MEMBERSHIP_RATE_LIMIT = Object.freeze({
  windowMs: 10 * 60 * 1000,
  max: 5,
});

/** Traduce errores del parser JSON a respuestas tipadas en vez de HTML de Express. */
const bodyParserErrors: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  const type =
    typeof error === "object" && error !== null && "type" in error
      ? String(error.type)
      : "";
  if (type === "entity.too.large") {
    respondError(
      res,
      apiError("PAYLOAD_TOO_LARGE", "La solicitud excede el tamaño permitido.")
    );
    return;
  }
  if (type === "entity.parse.failed") {
    respondError(
      res,
      apiError("BAD_REQUEST", "El cuerpo de la solicitud no es JSON válido.")
    );
    return;
  }
  next(error);
};

const apiNotFound: RequestHandler = (_req, res) => {
  respondError(res, apiError("NOT_FOUND", "Recurso no encontrado."));
};

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", deps.trustProxyHops);
  app.use(securityHeaders({ hsts: deps.hsts }));
  // gzip/deflate para HTML, CSS, JS y JSON: clave con conexiones lentas.
  app.use(compression());

  app.get("/api/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok" });
  });

  const routeDeps = { logger: deps.logger };

  // Afiliación: protecciones de borde (origen, tasa, tamaño, bots) y luego la ruta por contrato.
  app.use(
    MEMBERSHIP_ENDPOINT,
    originGuard(deps.allowedOrigins),
    rateLimit(deps.membershipRateLimit ?? DEFAULT_MEMBERSHIP_RATE_LIMIT),
    express.json({ limit: "16kb", strict: true }),
    bodyParserErrors,
    honeypotGuard({
      field: HONEYPOT_FIELD,
      onTrip: () => deps.logger.info("membership.honeypot_triggered"),
      decoy: () => {
        const now = new Date();
        return {
          status: 201,
          body: {
            referencia: randomReference.next(now),
            recibidaEn: now.toISOString(),
          },
        };
      },
    })
  );
  mountMembershipRoutes(app, {
    submitApplication: deps.submitApplication,
    route: routeDeps,
  });

  app.use("/api", apiNotFound);

  app.get("/robots.txt", (_req, res) => {
    const lines = ["User-agent: *", "Allow: /"];
    if (deps.publicSiteUrl)
      lines.push(
        `Sitemap: ${new URL("/sitemap.xml", deps.publicSiteUrl).href}`
      );
    res.type("text/plain").send(`${lines.join("\n")}\n`);
  });

  if (deps.publicSiteUrl) {
    const siteUrl = deps.publicSiteUrl;
    app.get("/sitemap.xml", (_req, res) => {
      const urls = [...CLIENT_ROUTES]
        .map(route => `  <url><loc>${new URL(route, siteUrl).href}</loc></url>`)
        .join("\n");
      res
        .type("application/xml")
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
        );
    });
  }

  if (deps.staticDir) {
    const staticDir = deps.staticDir;
    const pageFiles: ReadonlyMap<string, string> = new Map(
      PRERENDERED_ROUTES.map(route => [
        route.path,
        path.join(staticDir, route.file),
      ])
    );
    const notFoundHtml = path.join(staticDir, NOT_FOUND_PAGE.file);

    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, filePath) {
          const isHashedAsset = filePath.includes(
            `${path.sep}assets${path.sep}`
          );
          res.setHeader(
            "Cache-Control",
            isHashedAsset
              ? "public, max-age=31536000, immutable"
              : "public, max-age=0, must-revalidate"
          );
        },
      })
    );

    // Páginas prerenderizadas: rutas conocidas → 200; el resto → 404 real con su HTML.
    app.get("*", (req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      const page = pageFiles.get(req.path);
      if (page) res.status(200).sendFile(page);
      else res.status(404).sendFile(notFoundHtml);
    });
  }

  const fallbackErrorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next
  ) => {
    deps.logger.error("http.unhandled_error", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    respondError(
      res,
      apiError("INTERNAL_ERROR", "Ocurrió un error inesperado.")
    );
  };
  app.use(fallbackErrorHandler);

  return app;
}
