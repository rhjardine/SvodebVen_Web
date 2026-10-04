import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineRoute } from "../shared/contracts/define";
import { apiError } from "../shared/errors";
import type { Identity } from "../shared/identity";
import { err, ok } from "../shared/result";
import { callApi } from "../client/src/lib/api";
import { mountRoute, type RouteHandler } from "../server/http/route";

const silentLogger = { info: () => undefined, error: () => undefined };

// ─── Contratos de prueba ────────────────────────────────────────────────────
const getItem = defineRoute({
  method: "GET",
  path: "/api/test/items/:id",
  auth: "public",
  idempotent: false,
  cache: { sMaxAge: 60, staleWhileRevalidate: 300 },
  successStatus: 200,
  params: z.object({ id: z.uuid() }),
  query: z.object({ page: z.coerce.number().int().min(1).default(1) }),
  response: z.object({ id: z.string(), page: z.number() }),
});

const createItem = defineRoute({
  method: "POST",
  path: "/api/test/items",
  auth: "staff",
  idempotent: false,
  cache: "no-store",
  successStatus: 201,
  body: z.object({ nombre: z.string().min(2) }),
  response: z.object({ nombre: z.string() }),
});

const memberOnly = defineRoute({
  method: "GET",
  path: "/api/test/me",
  auth: "member",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: z.object({ memberId: z.string() }),
});

const broken = defineRoute({
  method: "GET",
  path: "/api/test/broken",
  auth: "public",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: z.object({ n: z.number() }),
});

const boom = defineRoute({
  method: "GET",
  path: "/api/test/boom",
  auth: "public",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: z.object({ ok: z.boolean() }),
});

// ─── Servidor efímero ───────────────────────────────────────────────────────
let server: Server | undefined;
let base = "";

const fakeIdentity = (role: string | undefined): Identity | null =>
  role === "member" || role === "secretaria" || role === "admin"
    ? { memberId: "00000000-0000-4000-8000-000000000001", role }
    : null;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  const deps = {
    logger: silentLogger,
    cookieSecure: false,
    resolveIdentity: (req: express.Request) =>
      Promise.resolve(ok(fakeIdentity(req.get("x-test-role")))),
  };

  mountRoute(
    app,
    getItem,
    ({ params, query }) =>
      Promise.resolve(ok({ id: params.id, page: query.page })),
    deps
  );
  mountRoute(
    app,
    createItem,
    ({ body }) => Promise.resolve(ok({ nombre: body.nombre })),
    deps
  );
  mountRoute(
    app,
    memberOnly,
    (_input, { identity }) =>
      Promise.resolve(
        identity
          ? ok({ memberId: identity.memberId })
          : err(apiError("UNAUTHENTICATED", "x"))
      ),
    deps
  );
  // Handler que viola su propio contrato (bug simulado): el servidor debe responder 500.
  mountRoute(
    app,
    broken,
    () =>
      Promise.resolve(ok({ n: "no-es-numero" } as unknown as { n: number })),
    deps
  );
  // Handler que lanza una excepción inesperada: nunca debe filtrarse al cliente.
  mountRoute(
    app,
    boom,
    () => Promise.reject(new Error("secreto interno: password=123")),
    deps
  );

  server = app.listen(0);
  await new Promise<void>(resolve =>
    server?.once("listening", () => resolve())
  );
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve =>
    server ? server.close(() => resolve()) : resolve()
  );
});

const ID = "0b9c6f5e-7d3a-4f2e-9a41-5d2c8e1b7a10";

describe("mountRoute (servidor)", () => {
  it("valida params y query, aplica valores por defecto y fija la caché del contrato", async () => {
    const res = await fetch(`${base}/api/test/items/${ID}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: ID, page: 1 });
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
  });

  it("responde 422 con campos prefijados cuando params o query no cumplen el contrato", async () => {
    const res = await fetch(`${base}/api/test/items/no-es-uuid?page=0`);
    expect(res.status).toBe(422);
    const body = (await res.json()) as {
      error: { code: string; fields: Record<string, string> };
    };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fields).sort()).toEqual([
      "params.id",
      "query.page",
    ]);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("exige sesión (401) y rol de staff (403) según el contrato", async () => {
    const post = (role?: string) =>
      fetch(`${base}/api/test/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-svodeb-csrf": "1",
          ...(role ? { "x-test-role": role } : {}),
        },
        body: JSON.stringify({ nombre: "Ana" }),
      });
    expect((await post()).status).toBe(401);
    expect((await post("member")).status).toBe(403);
    const ok201 = await post("secretaria");
    expect(ok201.status).toBe(201);
    expect(await ok201.json()).toEqual({ nombre: "Ana" });
  });

  it("rechaza con 403 una mutación autenticada sin la cabecera CSRF", async () => {
    const res = await fetch(`${base}/api/test/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-role": "admin" },
      body: JSON.stringify({ nombre: "Ana" }),
    });
    expect(res.status).toBe(403);
  });

  it("rechaza con 415 un cuerpo que no es JSON en rutas con body", async () => {
    const res = await fetch(`${base}/api/test/items`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "x-test-role": "admin",
        "x-svodeb-csrf": "1",
      },
      body: "nombre=Ana",
    });
    expect(res.status).toBe(415);
  });

  it("entrega la identidad verificada al handler", async () => {
    const res = await fetch(`${base}/api/test/me`, {
      headers: { "x-test-role": "member" },
    });
    expect(await res.json()).toEqual({
      memberId: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("convierte una respuesta fuera de contrato en 500 sin enviarla", async () => {
    const res = await fetch(`${base}/api/test/broken`);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("no-es-numero");
  });

  it("convierte una excepción inesperada en 500 genérico sin filtrar detalles", async () => {
    const res = await fetch(`${base}/api/test/boom`);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toContain("password");
  });
});

describe("callApi (cliente)", () => {
  it("devuelve el valor tipado cuando la respuesta cumple el contrato", async () => {
    const result = await callApi(
      getItem,
      { params: { id: ID }, query: { page: "3" } },
      { baseUrl: base }
    );
    expect(result.success).toBe(true);
    if (result.success) expect(result.value).toEqual({ id: ID, page: 3 });
  });

  it("valida la entrada ANTES de enviar (INVALID_INPUT, sin red)", async () => {
    const result = await callApi(
      getItem,
      { params: { id: "xx" }, query: { page: 1 } },
      { baseUrl: "http://127.0.0.1:1" } // inalcanzable: si hubiera red, sería NETWORK
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.kind).toBe("INVALID_INPUT");
  });

  it("traduce errores de la API a un valor tipado con estado y código", async () => {
    const result = await callApi(
      createItem,
      { body: { nombre: "Ana" } },
      { baseUrl: base }
    );
    expect(result.success).toBe(false);
    if (!result.success && result.error.kind === "API") {
      expect(result.error.status).toBe(401);
      expect(result.error.error.code).toBe("UNAUTHENTICATED");
    } else {
      expect.unreachable("se esperaba un error de API");
    }
  });

  it("distingue fallo de red y respuesta fuera de contrato", async () => {
    const network = await callApi(
      broken,
      {},
      { baseUrl: "http://127.0.0.1:1", timeoutMs: 2000 }
    );
    expect(network.success).toBe(false);
    if (!network.success) expect(network.error.kind).toBe("NETWORK");
  });
});

describe("tipos del contrato (verificados por `tsc`)", () => {
  it("el compilador rechaza entradas y handlers que no cumplen el contrato", () => {
    // Si alguno de estos errores desaparece, `// @ts-expect-error` hace fallar `pnpm check`:
    // significa que un cambio de esquema dejó de propagarse a servidor o cliente.
    // @ts-expect-error falta el campo obligatorio `body`
    const _faltaBody = () => callApi(createItem, {});
    // @ts-expect-error `nombre` debe ser string
    const _tipoMal = () => callApi(createItem, { body: { nombre: 5 } });
    const _handlerMal: RouteHandler<typeof getItem> = () =>
      // @ts-expect-error la respuesta debe ser { id: string; page: number }
      Promise.resolve(ok({ id: 1 }));
    const _handlerBien: RouteHandler<typeof getItem> = ({ params, query }) =>
      Promise.resolve(ok({ id: params.id, page: query.page }));
    expect([_faltaBody, _tipoMal, _handlerMal, _handlerBien]).toHaveLength(4);
  });
});
