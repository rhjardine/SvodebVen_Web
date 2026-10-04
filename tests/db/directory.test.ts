import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";
import type { DbError } from "../../server/adapters/postgres/errors";
import type { DbPool } from "../../server/adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
} from "../../server/adapters/postgres/with-identity";
import { createJwtService } from "../../server/auth/jwt";
import { createAuthModule } from "../../server/auth/module";
import { createAuthService } from "../../server/auth/service";
import { createDirectoryService } from "../../server/directory/service";
import {
  makeSubmitApplication,
  randomReference,
  systemClock,
} from "../../server/membership/submit-application";
import { unconfiguredIntake } from "../../server/membership/adapters/smtp-intake";
import type { Role } from "../../shared/identity";
import { ok, type Result } from "../../shared/result";
import {
  appPool,
  freshDatabase,
  shouldRunDbTests,
  silentLogger,
} from "../db-helpers";

const id = (n: number) => `bbbbbbbb-0000-4000-8000-00000000000${n}`;
const M1 = id(1); // activo
const M2 = id(2); // asociado
const M3 = id(3); // estudiante
const SEC = id(4);
const TES = id(5);
const ADM = id(6);

const caracasToday = () => new Date(Date.now() - 4 * 3_600_000);
const inDays = (days: number) =>
  new Date(caracasToday().getTime() + days * 86_400_000)
    .toISOString()
    .slice(0, 10);

const run = await shouldRunDbTests();

describe.skipIf(!run)("directorio de especialistas", () => {
  let pool: DbPool;
  let server: Server;
  let base: string;
  const jwt = createJwtService({
    secret: "d".repeat(40),
    issuer: "svodeb",
    audience: "svodeb-web",
    ttlSeconds: 900,
  });
  const admin: Actor = { role: "admin", memberId: ADM };
  const sqlState = (r: Result<unknown, unknown>): string | null =>
    r.success
      ? null
      : (r.error as DbError).kind === "DB_ERROR"
        ? (r.error as { sqlState: string | null }).sqlState
        : (r.error as DbError).kind;

  beforeAll(async () => {
    expect((await freshDatabase()).success).toBe(true);
    pool = appPool(10);
    await withIdentity(pool, admin, async tx => {
      for (const [mid, email, role, categoria] of [
        [M1, "m1@example.com", "member", "ACTIVO"],
        [M2, "m2@example.com", "member", "ASOCIADO"],
        [M3, "m3@example.com", "member", "ESTUDIANTE"],
        [SEC, "sec@example.com", "secretaria", null],
        [TES, "tes@example.com", "tesoreria", null],
        [ADM, "adm@example.com", "admin", null],
      ] as const) {
        await tx.query(
          "INSERT INTO members (id, email, nombres, apellidos, role, categoria) VALUES ($1, $2, 'N', 'A', $3, $4)",
          [mid, email, role, categoria]
        );
      }
      return ok(undefined);
    });

    const ttls = {
      accessSeconds: 900,
      refreshSeconds: 3600,
      loginLinkSeconds: 900,
    };
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
      staticDir: null,
      publicSiteUrl: null,
      cookieSecure: false,
      directory: createDirectoryService(pool),
      directoryRateLimit: { windowMs: 60_000, max: 40 },
      auth: createAuthModule({
        service: createAuthService({
          pool,
          jwt,
          mailer: { send: () => Promise.resolve(ok(undefined)) },
          logger: silentLogger,
          siteUrl: "https://svodeb.example",
          ttls,
          now: () => new Date(),
        }),
        jwt,
        cookieSecure: false,
        ttls,
      }),
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

  const cookie = async (memberId: string, role: Role) =>
    `svodeb_at=${await jwt.sign({ memberId, role })}`;
  const call = async (
    method: string,
    path: string,
    who: [string, Role] | null,
    body?: unknown
  ) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        "x-svodeb-csrf": "1",
        ...(who ? { cookie: await cookie(...who) } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const pub = async (qs = "") => {
    const res = await fetch(`${base}/api/v1/directory${qs}`);
    return {
      res,
      body: (await res.json()) as {
        items: Record<string, unknown>[];
        total: number;
        totalPages: number;
      },
    };
  };

  const m1: [string, Role] = [M1, "member"];
  const m2: [string, Role] = [M2, "member"];
  const sec: [string, Role] = [SEC, "secretaria"];
  const listing = (over: Record<string, unknown> = {}) => ({
    nombrePublico: "Ana Núñez",
    ciudad: "Mérida",
    entidad: "Mérida",
    areas: ["ESTETICA", "BIOMATERIALES"],
    publicado: true,
    ...over,
  });
  const adminProfiles = async () =>
    (
      (await (await call("GET", "/api/v1/admin/directory", sec)).json()) as {
        items: { id: string; nombre: string }[];
      }
    ).items;
  const profileId = async (nombre: string) =>
    (await adminProfiles()).find(p => p.nombre === nombre)?.id ?? "";

  it("al inicio está vacío y la respuesta es cacheable en el borde", async () => {
    const { res, body } = await pub();
    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
  });

  it("publicar sin verificación NO expone la ficha; verificar la hace visible sin datos de contacto", async () => {
    const put = await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing()
    );
    expect(put.status).toBe(200);
    const mine = (await put.json()) as {
      elegible: boolean;
      ficha: { verificacion: string; publicado: boolean };
    };
    expect(mine.elegible).toBe(true);
    expect(mine.ficha).toMatchObject({
      verificacion: "SIN_VERIFICAR",
      publicado: true,
    });
    expect((await pub()).body.total).toBe(0);

    const verified = await call(
      "POST",
      `/api/v1/admin/directory/${await profileId("Ana Núñez")}/verify`,
      sec,
      { verificadoHasta: inDays(30) }
    );
    expect(verified.status).toBe(200);
    const { body } = await pub();
    expect(body.total).toBe(1);
    expect(Object.keys(body.items[0] ?? {}).sort()).toEqual([
      "areas",
      "categoria",
      "ciudad",
      "entidad",
      "id",
      "nombre",
      "verificadoHasta",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/@example|m1|memberId|telefono/i);
  });

  it("buscar ignora acentos y mayúsculas, combina palabras y filtra por área y estado", async () => {
    expect((await pub("?q=NUNEZ")).body.total).toBe(1);
    expect((await pub("?q=ana%20merida")).body.total).toBe(1);
    expect((await pub("?q=ana%20zulia")).body.total).toBe(0);
    expect((await pub("?area=ESTETICA")).body.total).toBe(1);
    expect((await pub("?area=ENDODONCIA")).res.status).toBe(422);
    expect((await pub("?entidad=Zulia")).body.total).toBe(0);
  });

  it("los comodines de LIKE del usuario no actúan como patrón", async () => {
    expect((await pub("?q=%25")).body.total).toBe(0);
    expect((await pub("?q=_")).body.total).toBe(0);
    expect((await pub("?q=a%5C")).body.total).toBe(0);
  });

  it("acota la paginación y valida los parámetros", async () => {
    expect((await pub("?pageSize=21")).res.status).toBe(422);
    expect((await pub("?page=51")).res.status).toBe(422);
    expect((await pub("?page=0")).res.status).toBe(422);
    expect((await pub(`?q=${"a".repeat(61)}`)).res.status).toBe(422);
    expect((await pub("?q=a%0Ab")).res.status).toBe(422);
    const ok1 = await pub("?page=1&pageSize=5");
    expect(ok1.body.totalPages).toBe(1);
  });

  it("la verificación exige fecha entre hoy y 400 días", async () => {
    const pid = await profileId("Ana Núñez");
    const post = (d: string) =>
      call("POST", `/api/v1/admin/directory/${pid}/verify`, sec, {
        verificadoHasta: d,
      });
    expect((await post(inDays(-1))).status).toBe(422);
    expect((await post(inDays(401))).status).toBe(422);
    expect((await post("2026-13-45")).status).toBe(422);
    expect((await post(inDays(400))).status).toBe(200);
  });

  it("cambiar datos públicos invalida la verificación; cambiar solo 'publicado' no", async () => {
    expect(
      (
        await call(
          "PUT",
          "/api/v1/members/me/directory",
          m1,
          listing({ ciudad: "Ejido" })
        )
      ).status
    ).toBe(200);
    expect((await pub()).body.total).toBe(0);
    await call(
      "POST",
      `/api/v1/admin/directory/${await profileId("Ana Núñez")}/verify`,
      sec,
      { verificadoHasta: inDays(30) }
    );
    expect((await pub()).body.total).toBe(1);
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing({ ciudad: "Ejido", publicado: false })
    );
    expect((await pub()).body.total).toBe(0);
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing({ ciudad: "Ejido", publicado: true })
    );
    expect((await pub()).body.total).toBe(1);
  });

  it("un miembro no puede alterar su verificación ni crear una ficha ya verificada (RLS + disparador)", async () => {
    const forged = await withIdentity(
      pool,
      { role: "member", memberId: M1 },
      tx =>
        tx.query(
          "UPDATE directory_profiles SET verificado_hasta = '2099-01-01', verificado_por = $1 WHERE member_id = $1 RETURNING verificado_hasta::text AS v",
          [M1]
        )
    );
    expect(forged.success && forged.value[0]?.v).not.toBe("2099-01-01");

    const insert = await withIdentity(
      pool,
      { role: "member", memberId: M2 },
      tx =>
        tx.query(
          `INSERT INTO directory_profiles (member_id, nombre_publico, ciudad, entidad, areas, categoria, busqueda, verificado_hasta)
         VALUES ($1, 'Falso', 'X', 'Zulia', ARRAY['ESTETICA'], 'ASOCIADO', 'falso', '2099-01-01')`,
          [M2]
        )
    );
    expect(sqlState(insert)).toBe("42501");

    const others = await withIdentity(
      pool,
      { role: "member", memberId: M2 },
      tx =>
        tx.query(
          "INSERT INTO directory_profiles (member_id, nombre_publico, ciudad, entidad, areas, categoria, busqueda) VALUES ($1, 'Suplanta', 'X', 'Zulia', ARRAY['ESTETICA'], 'ASOCIADO', 'x')",
          [M1]
        )
    );
    expect(sqlState(others)).toBe("42501");
  });

  it("no se puede publicar sin consentimiento (restricción de la base)", async () => {
    const res = await withIdentity(
      pool,
      { role: "secretaria", memberId: SEC },
      tx =>
        tx.query(
          "UPDATE directory_profiles SET publicado = true, consentimiento_en = NULL"
        )
    );
    expect(sqlState(res)).toBe("23514");
  });

  it("la lectura directa por SQL respeta RLS: anónimo y otros miembros no ven fichas ocultas", async () => {
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing({ ciudad: "Ejido", publicado: false })
    );
    const count = (actor: Actor) =>
      withIdentity(pool, actor, tx =>
        tx.query("SELECT count(*)::int AS n FROM directory_profiles")
      );
    const anon = await count({ role: "anon", memberId: null });
    expect(anon.success && anon.value[0]?.n).toBe(0);
    const other = await count({ role: "member", memberId: M2 });
    expect(other.success && other.value[0]?.n).toBe(0);
    const owner = await count({ role: "member", memberId: M1 });
    expect(owner.success && owner.value[0]?.n).toBe(1);
    const tes = await count({ role: "tesoreria", memberId: TES });
    expect(tes.success && tes.value[0]?.n).toBe(0);
  });

  it("solo miembros activos o asociados son elegibles", async () => {
    const student = await call(
      "PUT",
      "/api/v1/members/me/directory",
      [M3, "member"],
      listing({ nombrePublico: "Estudiante" })
    );
    expect(student.status).toBe(403);
    const view = (await (
      await call("GET", "/api/v1/members/me/directory", [M3, "member"])
    ).json()) as { elegible: boolean };
    expect(view.elegible).toBe(false);
  });

  it("autorización de las rutas de gestión: 401 sin sesión; 403 a miembros y tesorería", async () => {
    expect((await call("GET", "/api/v1/admin/directory", null)).status).toBe(
      401
    );
    expect((await call("GET", "/api/v1/admin/directory", m1)).status).toBe(403);
    expect(
      (await call("GET", "/api/v1/admin/directory", [TES, "tesoreria"])).status
    ).toBe(403);
    expect(
      (await call("PUT", "/api/v1/members/me/directory", null, listing()))
        .status
    ).toBe(401);
    const noCsrf = await fetch(`${base}/api/v1/members/me/directory`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: await cookie(M1, "member"),
      },
      body: JSON.stringify(listing()),
    });
    expect(noCsrf.status).toBe(403);
  });

  it("despublicar por secretaría borra la verificación: el miembro no puede reaparecer solo", async () => {
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing({ ciudad: "Ejido", publicado: true })
    );
    const pid = await profileId("Ana Núñez");
    await call("POST", `/api/v1/admin/directory/${pid}/verify`, sec, {
      verificadoHasta: inDays(30),
    });
    expect((await pub()).body.total).toBe(1);
    expect(
      (
        await call("POST", `/api/v1/admin/directory/${pid}/unpublish`, sec, {
          nota: "Reclamo",
        })
      ).status
    ).toBe(200);
    expect((await pub()).body.total).toBe(0);
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m1,
      listing({ ciudad: "Ejido", publicado: true })
    );
    expect((await pub()).body.total).toBe(0);
    expect(
      (
        await call(
          "POST",
          `/api/v1/admin/directory/00000000-0000-4000-8000-0000000000ff/unpublish`,
          sec,
          {}
        )
      ).status
    ).toBe(404);
  });

  it("suspender al miembro lo retira del directorio de inmediato", async () => {
    await call(
      "PUT",
      "/api/v1/members/me/directory",
      m2,
      listing({
        nombrePublico: "Luis Pérez",
        ciudad: "Maracaibo",
        entidad: "Zulia",
      })
    );
    await call(
      "POST",
      `/api/v1/admin/directory/${await profileId("Luis Pérez")}/verify`,
      sec,
      { verificadoHasta: inDays(30) }
    );
    expect((await pub("?q=luis")).body.total).toBe(1);
    await withIdentity(pool, { role: "secretaria", memberId: SEC }, tx =>
      tx.query("UPDATE members SET estado = 'SUSPENDIDO' WHERE id = $1", [M2])
    );
    expect((await pub("?q=luis")).body.total).toBe(0);
  });

  it("una ficha vencida deja de ser pública", async () => {
    await withIdentity(pool, { role: "secretaria", memberId: SEC }, tx =>
      tx.query(
        "UPDATE directory_profiles SET publicado = true, consentimiento_en = now(), verificado_hasta = (now() AT TIME ZONE 'America/Caracas')::date - 1 WHERE nombre_publico = 'Ana Núñez'"
      )
    );
    expect((await pub("?q=ana")).body.total).toBe(0);
    const mine = (await (
      await call("GET", "/api/v1/members/me/directory", m1)
    ).json()) as { ficha: { verificacion: string } };
    expect(mine.ficha.verificacion).toBe("VENCIDA");
  });

  it("el miembro puede retirar su ficha (DELETE) y queda auditado", async () => {
    expect(
      (await call("DELETE", "/api/v1/members/me/directory", m1)).status
    ).toBe(200);
    const mine = (await (
      await call("GET", "/api/v1/members/me/directory", m1)
    ).json()) as { ficha: unknown };
    expect(mine.ficha).toBeNull();
    const audit = await withIdentity(pool, admin, tx =>
      tx.query(
        "SELECT count(*)::int AS n FROM audit_log WHERE accion LIKE 'directory.%'"
      )
    );
    expect(audit.success && Number(audit.value[0]?.n)).toBeGreaterThanOrEqual(
      5
    );
  });

  it("la secretaría no puede crear ni promover cuentas de personal; el admin sí", async () => {
    const asSec = { role: "secretaria", memberId: SEC } as const;
    const insertAdmin = await withIdentity(pool, asSec, tx =>
      tx.query(
        "INSERT INTO members (email, nombres, apellidos, role) VALUES ('x@example.com', 'X', 'X', 'admin')"
      )
    );
    expect(sqlState(insertAdmin)).toBe("42501");
    const promote = await withIdentity(pool, asSec, tx =>
      tx.query("UPDATE members SET role = 'admin' WHERE id = $1 RETURNING id", [
        SEC,
      ])
    );
    expect(promote.success && promote.value).toHaveLength(0);
    const insertMember = await withIdentity(pool, asSec, tx =>
      tx.query(
        "INSERT INTO members (email, nombres, apellidos, role) VALUES ('ok@example.com', 'O', 'K', 'member')"
      )
    );
    expect(insertMember.success).toBe(true);
    const adminInsert = await withIdentity(pool, admin, tx =>
      tx.query(
        "INSERT INTO members (email, nombres, apellidos, role) VALUES ('st@example.com', 'S', 'T', 'tesoreria')"
      )
    );
    expect(adminInsert.success).toBe(true);
  });

  it("el listado público tiene límite por IP (429)", async () => {
    let last = 200;
    for (let i = 0; i < 60 && last !== 429; i += 1) {
      last = (await fetch(`${base}/api/v1/directory`)).status;
    }
    expect(last).toBe(429);
  });
});
