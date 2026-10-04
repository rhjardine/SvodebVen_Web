import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import {
  makeSubmitApplication,
  type ApplicationIntake,
  type DeliveryFailure,
  type Logger,
  type MembershipApplication,
  type Receipt,
} from "../server/membership/submit-application";
import { unconfiguredIntake } from "../server/membership/adapters/smtp-intake";
import { HONEYPOT_FIELD, MEMBERSHIP_ENDPOINT } from "../shared/membership/api";
import { err, ok, type Result } from "../shared/result";
import { solicitudValida } from "./fixtures";

const silentLogger: Logger = { info: () => undefined, error: () => undefined };

class InMemoryIntake implements ApplicationIntake {
  readonly isConfigured = true;
  readonly received: MembershipApplication[] = [];
  constructor(private readonly failWith?: Error) {}
  deliver(
    application: MembershipApplication
  ): Promise<Result<Receipt, DeliveryFailure>> {
    if (this.failWith) {
      return Promise.resolve(err({ reason: this.failWith.message }));
    }
    this.received.push(application);
    return Promise.resolve(
      ok({
        referencia: application.referencia,
        recibidaEn: application.recibidaEn,
      })
    );
  }
}

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>(resolve =>
    server ? server.close(() => resolve()) : resolve()
  );
  server = undefined;
});

async function start(
  intake: ApplicationIntake,
  options: Readonly<{ allowedOrigins?: readonly string[]; max?: number }> = {}
): Promise<string> {
  const app = createApp({
    submitApplication: makeSubmitApplication({
      intake,
      clock: { now: () => new Date("2026-09-29T15:00:00Z") },
      references: { next: () => "SVD-2026-TEST01" },
      logger: silentLogger,
    }),
    logger: silentLogger,
    trustProxyHops: 0,
    allowedOrigins: options.allowedOrigins ?? [],
    hsts: true,
    staticDir: null,
    publicSiteUrl: "https://svodeb.example",
    cookieSecure: false,
    auth: null,
    membershipRateLimit: { windowMs: 60_000, max: options.max ?? 50 },
  });
  server = app.listen(0);
  await new Promise<void>(resolve =>
    server?.once("listening", () => resolve())
  );
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

const post = (
  base: string,
  body: unknown,
  headers: Record<string, string> = {}
) =>
  fetch(`${base}${MEMBERSHIP_ENDPOINT}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe(`POST ${MEMBERSHIP_ENDPOINT}`, () => {
  it("registra una solicitud válida y devuelve la referencia", async () => {
    const intake = new InMemoryIntake();
    const base = await start(intake);
    const res = await post(base, solicitudValida);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      referencia: "SVD-2026-TEST01",
      recibidaEn: "2026-09-29T15:00:00.000Z",
    });
    expect(intake.received).toHaveLength(1);
    expect(Object.isFrozen(intake.received[0])).toBe(true);
  });

  it("exige Idempotency-Key (400 si falta o no es UUID)", async () => {
    const base = await start(new InMemoryIntake());
    for (const key of [undefined, "no-es-uuid"]) {
      const res = await fetch(`${base}${MEMBERSHIP_ENDPOINT}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(key ? { "Idempotency-Key": key } : {}),
        },
        body: JSON.stringify(solicitudValida),
      });
      expect(res.status).toBe(400);
    }
  });

  it("aplica cabeceras de seguridad", async () => {
    const base = await start(new InMemoryIntake());
    const res = await fetch(`${base}/api/health`);
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'self'"
    );
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("devuelve 422 con errores por campo", async () => {
    const base = await start(new InMemoryIntake());
    const res = await post(base, { ...solicitudValida, email: "no-es-correo" });
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; fields: Record<string, string> };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fields.email).toBeDefined();
  });

  it("descarta en silencio el envío de un bot (honeypot) sin entregarlo", async () => {
    const intake = new InMemoryIntake();
    const base = await start(intake);
    const res = await post(base, {
      ...solicitudValida,
      [HONEYPOT_FIELD]: "http://spam.example",
    });
    expect(res.status).toBe(201);
    expect(intake.received).toHaveLength(0);
  });

  it("responde 503 honesto si no hay canal de recepción configurado", async () => {
    const base = await start(unconfiguredIntake);
    const res = await post(base, solicitudValida);
    expect(res.status).toBe(503);
  });

  it("responde 502 si falla la entrega", async () => {
    const base = await start(new InMemoryIntake(new Error("smtp down")));
    const res = await post(base, solicitudValida);
    expect(res.status).toBe(502);
  });

  it("rechaza JSON inválido, tipos de contenido incorrectos y cuerpos grandes", async () => {
    const base = await start(new InMemoryIntake());
    expect((await post(base, "{roto")).status).toBe(400);
    expect(
      (
        await post(base, "a=b", {
          "Content-Type": "application/x-www-form-urlencoded",
        })
      ).status
    ).toBe(415);
    expect((await post(base, { motivacion: "x".repeat(20_000) })).status).toBe(
      413
    );
  });

  it("bloquea orígenes no autorizados", async () => {
    const base = await start(new InMemoryIntake(), {
      allowedOrigins: ["https://svodeb.org"],
    });
    expect(
      (await post(base, solicitudValida, { Origin: "https://evil.example" }))
        .status
    ).toBe(403);
    expect(
      (await post(base, solicitudValida, { Origin: "https://svodeb.org" }))
        .status
    ).toBe(201);
  });

  it("limita la tasa de envíos por IP", async () => {
    const base = await start(new InMemoryIntake(), { max: 2 });
    await post(base, solicitudValida);
    await post(base, solicitudValida);
    const res = await post(base, solicitudValida);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
  });

  it("publica robots.txt y sitemap.xml con la URL canónica", async () => {
    const base = await start(new InMemoryIntake());
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    expect(robots).toContain("Sitemap: https://svodeb.example/sitemap.xml");
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    expect(sitemap).toContain("<loc>https://svodeb.example/privacidad</loc>");
  });

  it("responde 404 JSON para rutas de API desconocidas", async () => {
    const base = await start(new InMemoryIntake());
    const res = await fetch(`${base}/api/inexistente`);
    expect(res.status).toBe(404);
  });
});
