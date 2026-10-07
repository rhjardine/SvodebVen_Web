import { describe, expect, it } from "vitest";
import { describeConfigError, loadConfig } from "../server/config";

describe("loadConfig", () => {
  it("arranca sin SMTP (recepción deshabilitada de forma explícita)", () => {
    const result = loadConfig({ NODE_ENV: "production", PORT: "8080" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.smtp).toBeNull();
    expect(result.value.port).toBe(8080);
  });

  it("devuelve un error tipado con SMTP parcialmente configurado (sin lanzar)", () => {
    const result = loadConfig({ SMTP_HOST: "smtp.example.com" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.kind).toBe("SMTP_INCOMPLETE");
    const message = describeConfigError(result.error);
    expect(message).toMatch(/SMTP parcialmente/);
    // Dice exactamente cuáles faltan (solo nombres), no las que sí están.
    expect(message).toContain(
      "Faltan: SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM, SECRETARIA_EMAIL"
    );
    expect(message).not.toMatch(/Faltan:[^(]*SMTP_HOST/);
  });

  it("devuelve INVALID_ENV con los campos erróneos", () => {
    const result = loadConfig({ PORT: "no-es-numero" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.kind).toBe("INVALID_ENV");
  });

  it("construye la configuración SMTP completa", () => {
    const result = loadConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "user",
      SMTP_PASSWORD: "secret",
      MAIL_FROM: "SVODEB <no-responder@example.com>",
      SECRETARIA_EMAIL: "secretaria@example.com",
      ALLOWED_ORIGINS: "https://a.example, https://b.example",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.smtp?.secure).toBe(true);
    expect(result.value.allowedOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  describe("acceso de miembros (con base de datos)", () => {
    const db = { DATABASE_URL: "postgresql://app:x@localhost:5432/svodeb" };
    const secret = "x".repeat(40);
    const smtp = {
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_USER: "user",
      SMTP_PASSWORD: "secret",
      MAIL_FROM: "SVODEB <no-responder@example.com>",
      SECRETARIA_EMAIL: "secretaria@example.com",
    };

    it("sin base de datos no hay autenticación", () => {
      const result = loadConfig({});
      expect(result.success && result.value.auth).toBeNull();
    });

    it("con base de datos exige JWT_SECRET y lo dice por nombre", () => {
      const result = loadConfig(db);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error.kind).toBe("AUTH_INCOMPLETE");
      expect(describeConfigError(result.error)).toContain("JWT_SECRET");
    });

    it("rechaza secretos cortos", () => {
      expect(loadConfig({ ...db, JWT_SECRET: "corto" }).success).toBe(false);
    });

    it("en producción exige además PUBLIC_SITE_URL y SMTP (sin correo nadie podría entrar)", () => {
      const result = loadConfig({
        ...db,
        JWT_SECRET: secret,
        NODE_ENV: "production",
      });
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(
        result.error.kind === "AUTH_INCOMPLETE" && result.error.missing
      ).toEqual(["PUBLIC_SITE_URL", "SMTP_*"]);
    });

    it("en desarrollo basta con JWT_SECRET y las cookies no son Secure", () => {
      const result = loadConfig({ ...db, JWT_SECRET: secret });
      expect(result.success && result.value.auth?.cookieSecure).toBe(false);
    });

    it("en producción completa activa cookies Secure y fija el origen del enlace", () => {
      const result = loadConfig({
        ...db,
        ...smtp,
        JWT_SECRET: secret,
        NODE_ENV: "production",
        PUBLIC_SITE_URL: "https://svodeb-web.onrender.com/ruta?x=1",
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.value.auth?.cookieSecure).toBe(true);
      expect(result.value.auth?.siteUrl).toBe(
        "https://svodeb-web.onrender.com"
      );
    });
  });
});
