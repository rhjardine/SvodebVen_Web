import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { purgeExpiredIdempotencyKeys } from "./adapters/postgres/idempotency";
import { createPool } from "./adapters/postgres/pool";
import {
  ConsoleLoginLinkMailer,
  SmtpLoginLinkMailer,
  unconfiguredLoginLinkMailer,
  type LoginLinkMailer,
} from "./adapters/mail/login-link-mailer";
import { createJwtService } from "./auth/jwt";
import { createAuthModule, type AuthModule } from "./auth/module";
import { createAuthService } from "./auth/service";
import { describeConfigError, loadConfig, type AppConfig } from "./config";
import {
  SmtpApplicationIntake,
  unconfiguredIntake,
} from "./membership/adapters/smtp-intake";
import {
  makeSubmitApplication,
  randomReference,
  systemClock,
  type Logger,
} from "./membership/submit-application";

/** Logger JSON por línea; nunca recibe datos personales (ver caso de uso). */
const logger: Logger = {
  info: (event, meta) =>
    console.log(
      JSON.stringify({
        level: "info",
        event,
        ...meta,
        at: new Date().toISOString(),
      })
    ),
  error: (event, meta) =>
    console.error(
      JSON.stringify({
        level: "error",
        event,
        ...meta,
        at: new Date().toISOString(),
      })
    ),
};

function composeAuth(config: AppConfig): AuthModule | null {
  if (!config.auth || !config.databaseUrl) {
    logger.info("auth.disabled", {
      hint: "Define DATABASE_URL y JWT_SECRET para habilitar el acceso de miembros",
    });
    return null;
  }
  const settings = config.auth;
  const pool = createPool(config.databaseUrl, logger);
  // Retención de claves de idempotencia (24 h): purga horaria, sin impedir el cierre del proceso.
  setInterval(
    () => {
      void purgeExpiredIdempotencyKeys(pool).then(purged => {
        if (!purged.success) logger.error("idempotency.purge_failed");
      });
    },
    60 * 60 * 1000
  ).unref();
  const jwt = createJwtService({
    secret: settings.jwtSecret,
    ...(settings.jwtSecretPrevious
      ? { previousSecret: settings.jwtSecretPrevious }
      : {}),
    issuer: "svodeb",
    audience: "svodeb-web",
    ttlSeconds: settings.accessTtlSeconds,
  });
  // El mailer de consola solo existe fuera de producción (ahí exigimos SMTP al cargar la config).
  let mailer: LoginLinkMailer = unconfiguredLoginLinkMailer;
  if (config.smtp) mailer = new SmtpLoginLinkMailer(config.smtp, logger);
  else if (config.env !== "production") mailer = new ConsoleLoginLinkMailer();

  return createAuthModule({
    service: createAuthService({
      pool,
      jwt,
      mailer,
      logger,
      siteUrl: settings.siteUrl,
      ttls: {
        accessSeconds: settings.accessTtlSeconds,
        refreshSeconds: settings.refreshTtlSeconds,
        loginLinkSeconds: settings.loginLinkTtlSeconds,
      },
      now: () => new Date(),
    }),
    jwt,
    cookieSecure: settings.cookieSecure,
    ttls: {
      accessSeconds: settings.accessTtlSeconds,
      refreshSeconds: settings.refreshTtlSeconds,
    },
  });
}

function main(config: AppConfig): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const intake = config.smtp
    ? new SmtpApplicationIntake(config.smtp, logger)
    : unconfiguredIntake;
  if (!config.smtp) {
    logger.info("membership.intake_disabled", {
      hint: "Configura SMTP_* para habilitar la recepción",
    });
  }

  const app = createApp({
    submitApplication: makeSubmitApplication({
      intake,
      clock: systemClock,
      references: randomReference,
      logger,
    }),
    logger,
    trustProxyHops: config.trustProxyHops,
    allowedOrigins: config.allowedOrigins,
    hsts: config.env === "production",
    // En producción el bundle vive en dist/index.js y el cliente en dist/public.
    staticDir:
      config.env === "production" ? path.resolve(__dirname, "public") : null,
    publicSiteUrl: config.publicSiteUrl ?? null,
    cookieSecure: config.auth?.cookieSecure ?? config.env === "production",
    auth: composeAuth(config),
  });

  const server = app.listen(config.port, () => {
    logger.info("server.started", { port: config.port, env: config.env });
  });

  const shutdown = (signal: string) => {
    logger.info("server.stopping", { signal });
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Raíz de composición: único lugar que decide terminar el proceso ante una configuración inválida.
const config = loadConfig(process.env);
if (!config.success) {
  console.error(describeConfigError(config.error));
  process.exit(1);
}
main(config.value);
