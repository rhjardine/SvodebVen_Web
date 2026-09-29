import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../server/config";

describe("loadConfig", () => {
  it("arranca sin SMTP (recepción deshabilitada de forma explícita)", () => {
    const config = loadConfig({ NODE_ENV: "production", PORT: "8080" });
    expect(config.smtp).toBeNull();
    expect(config.port).toBe(8080);
  });

  it("falla rápido con SMTP parcialmente configurado", () => {
    expect(() => loadConfig({ SMTP_HOST: "smtp.example.com" })).toThrow(
      ConfigError
    );
  });

  it("construye la configuración SMTP completa", () => {
    const config = loadConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "user",
      SMTP_PASSWORD: "secret",
      MAIL_FROM: "SVODEB <no-responder@example.com>",
      SECRETARIA_EMAIL: "secretaria@example.com",
      ALLOWED_ORIGINS: "https://a.example, https://b.example",
    });
    expect(config.smtp?.secure).toBe(true);
    expect(config.allowedOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
