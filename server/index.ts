import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { loadConfig } from "./config";
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

function main(): void {
  const config = loadConfig(process.env);
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
