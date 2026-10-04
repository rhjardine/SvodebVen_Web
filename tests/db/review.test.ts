import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app";
import type { DbPool } from "../../server/adapters/postgres/pool";
import { withIdentity } from "../../server/adapters/postgres/with-identity";
import { createJwtService } from "../../server/auth/jwt";
import { createAuthModule } from "../../server/auth/module";
import { createAuthService } from "../../server/auth/service";
import { PostgresApplicationIntake } from "../../server/membership/adapters/postgres-intake";
import { createApplicationReview } from "../../server/membership/review";
import {
  makeSubmitApplication,
  randomReference,
  systemClock,
  type ApplicationIntake,
} from "../../server/membership/submit-application";
import type { Role } from "../../shared/identity";
import { err, ok } from "../../shared/result";
import {
  appPool,
  freshDatabase,
  shouldRunDbTests,
  silentLogger,
} from "../db-helpers";
import { solicitudValida } from "../fixtures";

const SECRETARIA = "aaaaaaaa-0000-4000-8000-000000000001";
const TESORERIA = "aaaaaaaa-0000-4000-8000-000000000002";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000003";
const MIEMBRO = "aaaaaaaa-0000-4000-8000-000000000004";

const run = await shouldRunDbTests();

describe.skipIf(!run)("afiliación persistida y revisión de expedientes", () => {
  let pool: DbPool;
  let server: Server;
  let base: string;
  let notified = 0;
  const jwt = createJwtService({
    secret: "s".repeat(40),
    issuer: "svodeb",
    audience: "svodeb-web",
    ttlSeconds: 900,
  });

  const failingNotifier: ApplicationIntake = {
    isConfigured: true,
    deliver: () => {
      notified += 1;
      return Promise.resolve(err({ reason: "SMTP caído" }));
    },
  };

  beforeAll(async () => {
    expect((await freshDatabase()).success).toBe(true);
    pool = appPool(10);
    await withIdentity(pool, { role: "admin", memberId: ADMIN }, async tx => {
      for (const [id, email, role] of [
        [SECRETARIA, "sec@example.com", "secretaria"],
        [TESORERIA, "tes@example.com", "tesoreria"],
        [ADMIN, "adm@example.com", "admin"],
        [MIEMBRO, "mie@example.com", "member"],
      ] as const) {
        await tx.query(
          `INSERT INTO members (id, email, nombres, apellidos, role) VALUES ($1, $2, 'N', 'A', $3)`,
          [id, email, role]
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
        intake: new PostgresApplicationIntake(
          pool,
          failingNotifier,
          silentLogger
        ),
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
      membershipRateLimit: { windowMs: 60_000, max: 1000 },
      review: createApplicationReview(pool),
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

  const cookieFor = async (memberId: string, role: Role) =>
    `svodeb_at=${await jwt.sign({ memberId, role })}`;

  const submit = (email: string, key = crypto.randomUUID(), extra = {}) =>
    fetch(`${base}/api/v1/afiliaciones`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": key },
      body: JSON.stringify({ ...solicitudValida, email, ...extra }),
    });

  const api = async (
    method: string,
    path: string,
    who: [string, Role] | null,
    body?: unknown
  ) =>
    fetch(`${base}/api/v1/admin/applications${path}`, {
      method,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        "x-svodeb-csrf": "1",
        ...(who ? { cookie: await cookieFor(...who) } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  const secretaria: [string, Role] = [SECRETARIA, "secretaria"];

  async function newApplication(email: string): Promise<string> {
    const res = await submit(email);
    expect(res.status).toBe(201);
    const { referencia } = (await res.json()) as { referencia: string };
    const listed = (await (
      await api("GET", "?pageSize=50", secretaria)
    ).json()) as {
      items: { id: string; referencia: string }[];
    };
    const found = listed.items.find(item => item.referencia === referencia);
    expect(found).toBeDefined();
    return found?.id ?? "";
  }

  it("persiste el expediente aunque falle la notificación por correo", async () => {
    const res = await submit("persist@example.com");
    expect(res.status).toBe(201);
    expect(notified).toBeGreaterThan(0);
    const listed = (await (await api("GET", "", secretaria)).json()) as {
      total: number;
    };
    expect(listed.total).toBeGreaterThanOrEqual(1);
  });

  it("un reintento con la misma Idempotency-Key devuelve la misma referencia y no duplica", async () => {
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([
      submit("idem@example.com", key),
      submit("idem@example.com", key),
    ]);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const first = (await a.json()) as { referencia: string };
    const second = (await b.json()) as { referencia: string };
    expect(second.referencia).toBe(first.referencia);
    const listed = (await (
      await api("GET", "?pageSize=50", secretaria)
    ).json()) as {
      items: { email: string }[];
    };
    expect(
      listed.items.filter(item => item.email === "idem@example.com")
    ).toHaveLength(1);
    // La misma clave con otra solicitud es un error.
    expect((await submit("otra@example.com", key)).status).toBe(422);
  });

  it("solo secretaría y admin ven expedientes (401 sin sesión; 403 miembro y tesorería)", async () => {
    expect((await api("GET", "", null)).status).toBe(401);
    expect((await api("GET", "", [MIEMBRO, "member"])).status).toBe(403);
    expect((await api("GET", "", [TESORERIA, "tesoreria"])).status).toBe(403);
    expect((await api("GET", "", [ADMIN, "admin"])).status).toBe(200);
  });

  it("acota la paginación y valida el filtro", async () => {
    expect((await api("GET", "?pageSize=500", secretaria)).status).toBe(422);
    expect((await api("GET", "?estado=INVENTADO", secretaria)).status).toBe(
      422
    );
    const filtered = (await (
      await api("GET", "?estado=APROBADA", secretaria)
    ).json()) as { total: number };
    expect(filtered.total).toBe(0);
  });

  it("flujo completo: revisar, aprobar y crear el miembro; bitácora y auditoría", async () => {
    const id = await newApplication("aprobar@example.com");
    const post = (evento: string, nota?: string) =>
      api("POST", `/${id}/transition`, secretaria, {
        evento,
        ...(nota ? { nota } : {}),
      });

    expect((await post("APROBAR")).status).toBe(409); // sin revisar no se aprueba
    expect((await post("INICIAR_REVISION")).status).toBe(200);
    const approved = await post("APROBAR", "Documentación completa");
    expect(approved.status).toBe(200);
    const result = (await approved.json()) as {
      estado: string;
      miembroId: string;
    };
    expect(result.estado).toBe("APROBADA");
    expect(result.miembroId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await post("APROBAR")).status).toBe(409); // estado final

    const detail = (await (await api("GET", `/${id}`, secretaria)).json()) as {
      estado: string;
      miembroId: string;
      accionesPermitidas: string[];
      eventos: { hacia: string; nota: string | null }[];
    };
    expect(detail.estado).toBe("APROBADA");
    expect(detail.miembroId).toBe(result.miembroId);
    expect(detail.accionesPermitidas).toEqual([]);
    expect(detail.eventos.map(e => e.hacia)).toEqual([
      "RECIBIDA",
      "EN_REVISION",
      "APROBADA",
    ]);
    expect(detail.eventos.at(-1)?.nota).toBe("Documentación completa");

    const audit = await withIdentity(
      pool,
      { role: "admin", memberId: ADMIN },
      tx =>
        tx.query(
          "SELECT count(*)::int AS n FROM audit_log WHERE accion = 'application.transition' AND entidad_id = $1",
          [id]
        )
    );
    expect(audit.success && audit.value[0]?.n).toBe(2);
  });

  it("dos aprobaciones simultáneas: una gana y la otra recibe 409 (FOR UPDATE)", async () => {
    const id = await newApplication("carrera@example.com");
    await api("POST", `/${id}/transition`, secretaria, {
      evento: "INICIAR_REVISION",
    });
    const results = await Promise.all([
      api("POST", `/${id}/transition`, secretaria, { evento: "APROBAR" }),
      api("POST", `/${id}/transition`, [ADMIN, "admin"], { evento: "APROBAR" }),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const members = await withIdentity(
      pool,
      { role: "admin", memberId: ADMIN },
      tx =>
        tx.query(
          "SELECT count(*)::int AS n FROM members WHERE email = 'carrera@example.com'"
        )
    );
    expect(members.success && members.value[0]?.n).toBe(1);
  });

  it("rechazar guarda la nota y no crea miembro; un expediente inexistente da 404", async () => {
    const id = await newApplication("rechazar@example.com");
    await api("POST", `/${id}/transition`, secretaria, {
      evento: "INICIAR_REVISION",
    });
    const rejected = await api("POST", `/${id}/transition`, secretaria, {
      evento: "RECHAZAR",
      nota: "No cumple requisitos",
    });
    expect(
      ((await rejected.json()) as { miembroId: string | null }).miembroId
    ).toBeNull();
    expect(
      (await api("GET", "/00000000-0000-4000-8000-0000000000ff", secretaria))
        .status
    ).toBe(404);
    expect((await api("GET", "/no-es-uuid", secretaria)).status).toBe(422);
  });

  it("aprobar un correo que ya es miembro da 409 y deja el expediente intacto", async () => {
    const id = await newApplication("mie@example.com");
    await api("POST", `/${id}/transition`, secretaria, {
      evento: "INICIAR_REVISION",
    });
    const res = await api("POST", `/${id}/transition`, secretaria, {
      evento: "APROBAR",
    });
    expect(res.status).toBe(409);
    const detail = (await (await api("GET", `/${id}`, secretaria)).json()) as {
      estado: string;
    };
    expect(detail.estado).toBe("EN_REVISION");
  });
});
