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
  /** Secreto HS256 del access token (≥ 32 caracteres). Obligatorio si hay DATABASE_URL. */
  JWT_SECRET: z.string().min(32).optional(),
  /** Secreto anterior, aceptado solo para verificar durante una rotación. */
  JWT_SECRET_PREVIOUS: z.string().min(32).optional(),
  ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(3600)
    .max(7776000)
    .default(2592000),
  LOGIN_LINK_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3600)
    .default(900),
  /** Fuerza el atributo Secure y los prefijos de cookie; por defecto, true en producción. */
  AUTH_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
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
  auth: AuthConfig | null;
  smtp: SmtpIntakeConfig | null;
}>;

export type AuthConfig = Readonly<{
  jwtSecret: string;
  jwtSecretPrevious: string | undefined;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  loginLinkTtlSeconds: number;
  cookieSecure: boolean;
  /** Origen para armar el enlace del correo. */
  siteUrl: string;
}>;

export type ConfigError =
  | Readonly<{ kind: "INVALID_ENV"; issues: readonly string[] }>
  | Readonly<{ kind: "SMTP_INCOMPLETE"; missing: readonly string[] }>
  | Readonly<{ kind: "AUTH_INCOMPLETE"; missing: readonly string[] }>;

export function describeConfigError(error: ConfigError): string {
  switch (error.kind) {
    case "INVALID_ENV":
      return `Configuración inválida: ${error.issues.join("; ")}`;
    case "SMTP_INCOMPLETE":
      return `SMTP parcialmente configurado. Faltan: ${error.missing.join(", ")} (todas son obligatorias: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM y SECRETARIA_EMAIL).`;
    case "AUTH_INCOMPLETE":
      return `Con DATABASE_URL el acceso de miembros requiere: ${error.missing.join(", ")}.`;
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

  const smtpFields: readonly (readonly [string, unknown])[] = [
    ["SMTP_HOST", e.SMTP_HOST],
    ["SMTP_PORT", e.SMTP_PORT],
    ["SMTP_USER", e.SMTP_USER],
    ["SMTP_PASSWORD", e.SMTP_PASSWORD],
    ["MAIL_FROM", e.MAIL_FROM],
    ["SECRETARIA_EMAIL", e.SECRETARIA_EMAIL],
  ];
  // Solo se informan los NOMBRES de las variables que faltan, nunca sus valores.
  const smtpMissing = smtpFields
    .filter(([, value]) => value === undefined)
    .map(([name]) => name);
  if (smtpMissing.length > 0 && smtpMissing.length < smtpFields.length) {
    return err({ kind: "SMTP_INCOMPLETE", missing: smtpMissing });
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

  let auth: AuthConfig | null = null;
  if (e.DATABASE_URL) {
    const production = e.NODE_ENV === "production";
    const missing = [
      e.JWT_SECRET ? null : "JWT_SECRET (≥ 32 caracteres)",
      production && !e.PUBLIC_SITE_URL ? "PUBLIC_SITE_URL" : null,
      production && !smtp ? "SMTP_*" : null,
    ].filter((item): item is string => item !== null);
    if (missing.length > 0 || !e.JWT_SECRET) {
      return err({ kind: "AUTH_INCOMPLETE", missing });
    }
    auth = Object.freeze({
      jwtSecret: e.JWT_SECRET,
      jwtSecretPrevious: e.JWT_SECRET_PREVIOUS,
      accessTtlSeconds: e.ACCESS_TTL_SECONDS,
      refreshTtlSeconds: e.REFRESH_TTL_SECONDS,
      loginLinkTtlSeconds: e.LOGIN_LINK_TTL_SECONDS,
      cookieSecure: e.AUTH_COOKIE_SECURE
        ? e.AUTH_COOKIE_SECURE === "true"
        : production,
      siteUrl: new URL(e.PUBLIC_SITE_URL ?? "http://localhost:3000").origin,
    });
  }

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
      auth,
      smtp,
    })
  );
}
