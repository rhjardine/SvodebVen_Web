import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { unconfiguredIntake } from "../server/membership/adapters/smtp-intake";
import {
  makeSubmitApplication,
  randomReference,
  systemClock,
  type Logger,
} from "../server/membership/submit-application";
import { NOT_FOUND_PAGE, PRERENDERED_ROUTES } from "../shared/routes";

const silentLogger: Logger = { info: () => undefined, error: () => undefined };
const relleno = "<p>contenido</p>".repeat(200); // > umbral de compresión (1 KB)

let dir = "";
let server: Server | undefined;
let base = "";

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "svodeb-static-"));
  mkdirSync(path.join(dir, "assets"));
  for (const page of [...PRERENDERED_ROUTES, NOT_FOUND_PAGE]) {
    writeFileSync(
      path.join(dir, page.file),
      `<html><body data-page="${page.path}">${relleno}</body></html>`
    );
  }
  writeFileSync(
    path.join(dir, "assets", "app-abc123.js"),
    `console.log(1);${" ".repeat(2000)}`
  );

  const app = createApp({
    submitApplication: makeSubmitApplication({
      intake: unconfiguredIntake,
      clock: systemClock,
      references: randomReference,
      logger: silentLogger,
    }),
    logger: silentLogger,
    trustProxyHops: 0,
    allowedOrigins: [],
    hsts: false,
    staticDir: dir,
    publicSiteUrl: null,
    cookieSecure: false,
    auth: null,
  });
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
  rmSync(dir, { recursive: true, force: true });
});

describe("páginas prerenderizadas", () => {
  it("sirve el HTML propio de cada ruta conocida con 200", async () => {
    for (const route of PRERENDERED_ROUTES) {
      const res = await fetch(`${base}${route.path}`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain(`data-page="${route.path}"`);
    }
  });

  it("responde 404 real con la página de error para rutas desconocidas", async () => {
    const res = await fetch(`${base}/no-existe`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`data-page="${NOT_FOUND_PAGE.path}"`);
  });

  it("comprime las respuestas y marca los assets con hash como inmutables", async () => {
    const html = await fetch(`${base}/`, {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(html.headers.get("content-encoding")).toBe("gzip");
    const asset = await fetch(`${base}/assets/app-abc123.js`);
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });
});
