import { z } from "zod";
import { err, ok, type Result } from "../shared/result";
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
  /** Conexión del rol de la aplicación (svodeb_app, sujeto a RLS). Sin ella no hay datos persistentes. */
  DATABASE_URL: z.url().optional(),
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
  databaseUrl: string | undefined;
  smtp: SmtpIntakeConfig | null;
}>;

export type ConfigError =
  | Readonly<{ kind: "INVALID_ENV"; issues: readonly string[] }>
  | Readonly<{ kind: "SMTP_INCOMPLETE" }>;

export function describeConfigError(error: ConfigError): string {
  switch (error.kind) {
    case "INVALID_ENV":
      return `Configuración inválida: ${error.issues.join("; ")}`;
    case "SMTP_INCOMPLETE":
      return "SMTP parcialmente configurado: define SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM y SECRETARIA_EMAIL.";
  }
}

/** Devuelve `Result`: quien arranca el proceso (composición) decide si registrar y salir. */
export function loadConfig(
  env: NodeJS.ProcessEnv
): Result<AppConfig, ConfigError> {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    return err({
      kind: "INVALID_ENV",
      issues: parsed.error.issues.map(
        issue => `${issue.path.join(".")}: ${issue.message}`
      ),
    });
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
    return err({ kind: "SMTP_INCOMPLETE" });
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

  return ok(
    Object.freeze({
      env: e.NODE_ENV,
      port: e.PORT,
      trustProxyHops: e.TRUST_PROXY_HOPS,
      allowedOrigins: Object.freeze(
        e.ALLOWED_ORIGINS.split(",")
          .map(origin => origin.trim())
          .filter(Boolean)
      ),
      publicSiteUrl: e.PUBLIC_SITE_URL,
      databaseUrl: e.DATABASE_URL,
      smtp,
    })
  );
}
