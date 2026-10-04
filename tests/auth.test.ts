import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../server/app";
import { ok } from "../shared/result";
import {
  withIdentity,
  type Actor,
} from "../server/adapters/postgres/with-identity";
import type { DbPool } from "../server/adapters/postgres/pool";
import type {
  LoginLinkMail,
  LoginLinkMailer,
} from "../server/adapters/mail/login-link-mailer";
import { createJwtService } from "../server/auth/jwt";
import { createAuthModule } from "../server/auth/module";
import { createAuthService } from "../server/auth/service";
import {
  makeSubmitApplication,
  randomReference,
  systemClock,
} from "../server/membership/submit-application";
import { unconfiguredIntake } from "../server/membership/adapters/smtp-intake";
import {
  appPool,
  freshDatabase,
  shouldRunDbTests,
  silentLogger,
} from "./db-helpers";

const SECRET = "x".repeat(40);
const MEMBER_ID = "11111111-1111-4111-8111-111111111111";
const SUSPENDED_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";
const CSRF = { "x-svodeb-csrf": "1" } as const;
const JSON_CT = { "content-type": "application/json" } as const;

const run = await shouldRunDbTests();

describe.skipIf(!run)("autenticación (enlace mágico + JWT en cookies)", () => {
  let pool: DbPool;
  let server: Server;
  let base: string;
  let nowMs = Date.parse("2026-10-01T12:00:00Z");
  const sent: LoginLinkMail[] = [];
  const mailer: LoginLinkMailer = {
    send: mail => {
      sent.push(mail);
      return Promise.resolve(ok(undefined));
    },
  };
  const jwt = createJwtService({
    secret: SECRET,
    issuer: "svodeb",
    audience: "svodeb-web",
    ttlSeconds: 900,
    now: () => new Date(nowMs),
  });

  beforeAll(async () => {
    const migrated = await freshDatabase();
    expect(migrated.success).toBe(true);
    pool = appPool();
    const seeder: Actor = { role: "admin", memberId: ADMIN_ID };
    await withIdentity(pool, seeder, async tx => {
      for (const [id, email, nombres, role, estado] of [
        [MEMBER_ID, "ana@example.com", "Ana", "member", "ACTIVO"],
        [SUSPENDED_ID, "sus@example.com", "Sus", "member", "SUSPENDIDO"],
        [ADMIN_ID, "admin@example.com", "Ada", "admin", "ACTIVO"],
      ] as const) {
        await tx.query(
          `INSERT INTO members (id, email, nombres, apellidos, role, estado)
           VALUES ($1, $2, $3, 'Prueba', $4, $5)`,
          [id, email, nombres, role, estado]
        );
      }
      return ok(undefined);
    });

    const ttls = {
      accessSeconds: 900,
      refreshSeconds: 2_592_000,
      loginLinkSeconds: 900,
    };
    const auth = createAuthModule({
      service: createAuthService({
        pool,
        jwt,
        mailer,
        logger: silentLogger,
        siteUrl: "https://svodeb.example",
        ttls,
        now: () => new Date(nowMs),
      }),
      jwt,
      cookieSecure: true,
      ttls,
    });
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
      hsts: true,
      staticDir: null,
      publicSiteUrl: null,
      cookieSecure: true,
      auth,
      loginLinkPerEmailMax: 100,
      authRateLimit: { windowMs: 60_000, max: 1000 },
    });
    server = app.listen(0);
    await new Promise<void>(resolve =>
      server.once("listening", () => resolve())
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  });

  const post = (
    path: string,
    body?: unknown,
    cookie = "",
    headers: Record<string, string> = CSRF
  ) =>
    fetch(`${base}/api/v1/auth/${path}`, {
      method: "POST",
      headers: {
        ...(body === undefined ? {} : JSON_CT),
        ...headers,
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const cookiesOf = (res: Response): Map<string, string> => {
    const map = new Map<string, string>();
    for (const line of res.headers.getSetCookie())
      map.set(line.split("=")[0] ?? "", line);
    return map;
  };
  const jar = (res: Response): string =>
    [...cookiesOf(res).values()]
      .filter(line => !/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(line))
      .map(line => line.split(";")[0])
      .join("; ");
  const valueOf = (line: string | undefined): string =>
    (line ?? "").split(";")[0]?.split("=").slice(1).join("=") ?? "";

  async function login(email = "ana@example.com"): Promise<Response> {
    const before = sent.length;
    const requested = await post("login-link", { email });
    expect(requested.status).toBe(202);
    const mail = sent[before];
    expect(mail).toBeDefined();
    const token = new URL(mail?.url ?? "").hash.replace("#token=", "");
    return post("redeem", { token });
  }

  it("el enlace lleva el token en el fragmento y la respuesta es uniforme", async () => {
    const known = await post("login-link", { email: "ana@example.com" });
    const unknown = await post("login-link", { email: "nadie@example.com" });
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    const url = new URL(sent.at(-1)?.url ?? "");
    expect(url.pathname).toBe("/acceso");
    expect(url.search).toBe("");
    expect(url.hash).toMatch(/^#token=[A-Za-z0-9_-]{43}$/);
  });

  it("un miembro suspendido o desconocido no recibe enlace", async () => {
    const before = sent.length;
    await post("login-link", { email: "sus@example.com" });
    await post("login-link", { email: "nadie@example.com" });
    expect(sent.length).toBe(before);
  });

  it("canjear emite cookies HttpOnly/Secure/SameSite=Strict y nunca devuelve tokens en el cuerpo", async () => {
    const res = await login();
    expect(res.status).toBe(200);
    const cookies = cookiesOf(res);
    const access = cookies.get("__Host-svodeb_at") ?? "";
    const refresh = cookies.get("__Secure-svodeb_rt") ?? "";
    for (const line of [access, refresh]) {
      expect(line).toMatch(/HttpOnly/i);
      expect(line).toMatch(/Secure/i);
      expect(line).toMatch(/SameSite=Strict/i);
    }
    expect(access).toMatch(/Path=\/(;|$)/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    const body = await res.text();
    expect(body).not.toContain(valueOf(access));
    expect(body).not.toContain(valueOf(refresh));
    expect(JSON.parse(body)).toEqual({
      member: {
        id: MEMBER_ID,
        nombres: "Ana",
        apellidos: "Prueba",
        role: "member",
      },
    });
  });

  it("el enlace es de un solo uso", async () => {
    await post("login-link", { email: "ana@example.com" });
    const token = new URL(sent.at(-1)?.url ?? "").hash.replace("#token=", "");
    expect((await post("redeem", { token })).status).toBe(200);
    expect((await post("redeem", { token })).status).toBe(401);
  });

  it("el enlace caduca a los 15 minutos", async () => {
    await post("login-link", { email: "ana@example.com" });
    const token = new URL(sent.at(-1)?.url ?? "").hash.replace("#token=", "");
    nowMs += 16 * 60 * 1000;
    expect((await post("redeem", { token })).status).toBe(401);
    nowMs -= 16 * 60 * 1000;
  });

  it("un token inventado se rechaza igual que uno vencido", async () => {
    const res = await post("redeem", { token: "A".repeat(43) });
    expect(res.status).toBe(401);
    expect((await post("redeem", { token: "corto" })).status).toBe(422);
  });

  it("sin cabecera CSRF las mutaciones se rechazan con 403", async () => {
    const res = await post("login-link", { email: "ana@example.com" }, "", {});
    expect(res.status).toBe(403);
    expect((await post("logout", undefined, "", {})).status).toBe(403);
  });

  it("GET /session: con sesión devuelve el miembro; sin sesión, null", async () => {
    const anon = await fetch(`${base}/api/v1/auth/session`);
    expect(anon.status).toBe(200);
    expect(await anon.json()).toEqual({ member: null });

    const cookie = jar(await login());
    const res = await fetch(`${base}/api/v1/auth/session`, {
      headers: { cookie },
    });
    expect(((await res.json()) as { member: { id: string } }).member.id).toBe(
      MEMBER_ID
    );
  });

  it("refresh rota el token; reutilizar el anterior revoca TODA la familia", async () => {
    const first = await login();
    const firstJar = jar(first);
    const rotated = await post("refresh", undefined, firstJar);
    expect(rotated.status).toBe(200);
    const secondJar = jar(rotated);
    expect(secondJar).not.toBe(firstJar);

    // Reutilización del refresh ya rotado → robo presunto.
    const reuse = await post("refresh", undefined, firstJar);
    expect(reuse.status).toBe(401);
    // El refresh legítimo más reciente también queda revocado (el COMMIT de la revocación persistió).
    expect((await post("refresh", undefined, secondJar)).status).toBe(401);
  });

  it("logout revoca la familia y limpia las cookies", async () => {
    const res = await login();
    const cookie = jar(res);
    const out = await post("logout", undefined, cookie);
    expect(out.status).toBe(200);
    for (const line of cookiesOf(out).values()) {
      expect(line).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    }
    expect((await post("refresh", undefined, cookie)).status).toBe(401);
  });

  it("refresh con rol cambiado toma el rol vigente en la base", async () => {
    const cookie = jar(await login("admin@example.com"));
    const rotated = await post("refresh", undefined, cookie);
    const body = (await rotated.json()) as { member: { role: string } };
    expect(body.member.role).toBe("admin");
  });

  it("un miembro suspendido después de iniciar sesión no puede refrescar", async () => {
    const cookie = jar(await login());
    await withIdentity(
      pool,
      { role: "admin", memberId: ADMIN_ID },
      async tx => {
        await tx.query(
          "UPDATE members SET estado = 'SUSPENDIDO' WHERE id = $1",
          [MEMBER_ID]
        );
        return ok(undefined);
      }
    );
    expect((await post("refresh", undefined, cookie)).status).toBe(401);
    await withIdentity(
      pool,
      { role: "admin", memberId: ADMIN_ID },
      async tx => {
        await tx.query("UPDATE members SET estado = 'ACTIVO' WHERE id = $1", [
          MEMBER_ID,
        ]);
        return ok(undefined);
      }
    );
  });

  it("la base solo guarda el hash del token, no el token", async () => {
    await post("login-link", { email: "ana@example.com" });
    const token = new URL(sent.at(-1)?.url ?? "").hash.replace("#token=", "");
    const found = await withIdentity(
      pool,
      { role: "system", memberId: null },
      tx =>
        tx.query(
          "SELECT count(*)::int AS n FROM login_challenges WHERE encode(token_hash,'escape') = $1",
          [token]
        )
    );
    expect(found.success && found.value[0]?.n).toBe(0);
  });

  it("limita las solicitudes de enlace por correo (y no por otra cuenta)", async () => {
    const ttls = {
      accessSeconds: 900,
      refreshSeconds: 2_592_000,
      loginLinkSeconds: 900,
    };
    const limited = createApp({
      submitApplication: makeSubmitApplication({
        intake: unconfiguredIntake,
        clock: systemClock,
        references: randomReference,
        logger: silentLogger,
      }),
      logger: silentLogger,
      trustProxyHops: 0,
      allowedOrigins: [],
      hsts: true,
      staticDir: null,
      publicSiteUrl: null,
      cookieSecure: true,
      auth: createAuthModule({
        service: createAuthService({
          pool,
          jwt,
          mailer,
          logger: silentLogger,
          siteUrl: "https://svodeb.example",
          ttls,
          now: () => new Date(nowMs),
        }),
        jwt,
        cookieSecure: true,
        ttls,
      }),
      loginLinkPerEmailMax: 2,
    });
    const second = limited.listen(0);
    await new Promise<void>(resolve =>
      second.once("listening", () => resolve())
    );
    const url = `http://127.0.0.1:${(second.address() as AddressInfo).port}/api/v1/auth/login-link`;
    const ask = (email: string) =>
      fetch(url, {
        method: "POST",
        headers: { ...JSON_CT, ...CSRF },
        body: JSON.stringify({ email }),
      });
    try {
      expect((await ask("rate@example.com")).status).toBe(202);
      expect((await ask("rate@example.com")).status).toBe(202);
      expect((await ask("rate@example.com")).status).toBe(429);
      expect((await ask("otra@example.com")).status).toBe(202);
    } finally {
      await new Promise<void>(resolve => second.close(() => resolve()));
    }
  });

  describe("verificación del JWT", () => {
    const claims = { role: "member" };
    const build = (
      alg: "HS256" | "HS384",
      secret = SECRET,
      aud = "svodeb-web",
      exp = "10m"
    ) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg, kid: "no-importa" })
        .setSubject(MEMBER_ID)
        .setIssuer("svodeb")
        .setAudience(aud)
        .setIssuedAt(Math.floor(nowMs / 1000))
        .setExpirationTime(exp)
        .sign(new TextEncoder().encode(secret));

    it("acepta un token propio", async () => {
      const token = await jwt.sign({ memberId: MEMBER_ID, role: "member" });
      expect((await jwt.verify(token)).success).toBe(true);
    });
    it("rechaza alg=none", async () => {
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" })
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          sub: MEMBER_ID,
          role: "admin",
          iss: "svodeb",
          aud: "svodeb-web",
          exp: Math.floor(nowMs / 1000) + 600,
        })
      ).toString("base64url");
      expect((await jwt.verify(`${header}.${payload}.`)).success).toBe(false);
    });
    it("rechaza otro algoritmo, otro secreto, otra audiencia y tokens vencidos", async () => {
      expect((await jwt.verify(await build("HS384"))).success).toBe(false);
      expect(
        (await jwt.verify(await build("HS256", "y".repeat(40)))).success
      ).toBe(false);
      expect(
        (await jwt.verify(await build("HS256", SECRET, "otro-sitio"))).success
      ).toBe(false);
      const token = await jwt.sign({ memberId: MEMBER_ID, role: "member" });
      nowMs += 16 * 60 * 1000;
      expect((await jwt.verify(token)).success).toBe(false);
      nowMs -= 16 * 60 * 1000;
    });
    it("durante una rotación acepta el secreto anterior pero firma con el nuevo", async () => {
      const old = createJwtService({
        secret: SECRET,
        issuer: "svodeb",
        audience: "svodeb-web",
        ttlSeconds: 900,
      });
      const rotated = createJwtService({
        secret: "n".repeat(40),
        previousSecret: SECRET,
        issuer: "svodeb",
        audience: "svodeb-web",
        ttlSeconds: 900,
      });
      const oldToken = await old.sign({ memberId: MEMBER_ID, role: "member" });
      expect((await rotated.verify(oldToken)).success).toBe(true);
      const newToken = await rotated.sign({
        memberId: MEMBER_ID,
        role: "member",
      });
      expect((await old.verify(newToken)).success).toBe(false);
    });
  });
});
