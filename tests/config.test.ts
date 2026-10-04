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
    expect(describeConfigError(result.error)).toMatch(/SMTP parcialmente/);
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
});
