import { z } from "zod";
import type { SmtpIntakeConfig } from "./membership/adapters/smtp-intake";

const booleanFromEnv = z
  .enum(["true", "false"])
  .optional()
  .transform(value => value === "true");

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  /** Número de proxies de confianza delante del servidor (0 = conexión directa). */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /** Orígenes permitidos para POST, separados por coma. Vacío = no se valida Origin. */
  ALLOWED_ORIGINS: z.string().optional().default(""),
  PUBLIC_SITE_URL: z.url().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: booleanFromEnv,
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(3).optional(),
  SECRETARIA_EMAIL: z.email().optional(),
});

export type AppConfig = Readonly<{
  env: "development" | "production" | "test";
  port: number;
  trustProxyHops: number;
  allowedOrigins: readonly string[];
  publicSiteUrl: string | undefined;
  smtp: SmtpIntakeConfig | null;
}>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map(issue => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Configuración inválida: ${detail}`);
  }
  const e = parsed.data;

  const smtpFields = [
    e.SMTP_HOST,
    e.SMTP_PORT,
    e.SMTP_USER,
    e.SMTP_PASSWORD,
    e.MAIL_FROM,
    e.SECRETARIA_EMAIL,
  ];
  const smtpProvided = smtpFields.filter(value => value !== undefined).length;
  if (smtpProvided > 0 && smtpProvided < smtpFields.length) {
    throw new ConfigError(
      "SMTP parcialmente configurado: define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM y SECRETARIA_EMAIL."
    );
  }

  const smtp: SmtpIntakeConfig | null =
    e.SMTP_HOST &&
    e.SMTP_PORT &&
    e.SMTP_USER &&
    e.SMTP_PASSWORD &&
    e.MAIL_FROM &&
    e.SECRETARIA_EMAIL
      ? Object.freeze({
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          secure: e.SMTP_SECURE,
          user: e.SMTP_USER,
          password: e.SMTP_PASSWORD,
          from: e.MAIL_FROM,
          secretariaEmail: e.SECRETARIA_EMAIL,
        })
      : null;

  return Object.freeze({
    env: e.NODE_ENV,
    port: e.PORT,
    trustProxyHops: e.TRUST_PROXY_HOPS,
    allowedOrigins: Object.freeze(
      e.ALLOWED_ORIGINS.split(",")
        .map(origin => origin.trim())
        .filter(Boolean)
    ),
    publicSiteUrl: e.PUBLIC_SITE_URL,
    smtp,
  });
}
