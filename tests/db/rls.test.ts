import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DbError } from "../../server/adapters/postgres/errors";
import type { DbPool } from "../../server/adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
  type IdentityTx,
} from "../../server/adapters/postgres/with-identity";
import { err, ok, type Result } from "../../shared/result";
import {
  appPool,
  freshDatabase,
  OWNER_URL,
  shouldRunDbTests,
} from "../db-helpers";

// UUID fijos para razonar sobre qué ve cada quien.
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STAFF = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const anon: Actor = { role: "anon", memberId: null };
const system: Actor = { role: "system", memberId: null };
const memberA: Actor = { role: "member", memberId: A };
const memberB: Actor = { role: "member", memberId: B };
const secretaria: Actor = { role: "secretaria", memberId: STAFF };
const tesoreria: Actor = { role: "tesoreria", memberId: STAFF };
const admin: Actor = { role: "admin", memberId: STAFF };

let pool: DbPool;

type Q = (tx: IdentityTx) => Promise<Result<unknown, DbError>>;
const as = (actor: Actor, work: Q) => withIdentity(pool, actor, work);

function value<T>(result: Result<T, unknown>): T {
  if (!result.success) {
    throw new Error(`Se esperaba éxito: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

function sqlState(result: Result<unknown, unknown>): string | null {
  if (result.success) return null;
  const error = result.error as DbError;
  return error.kind === "DB_ERROR" ? error.sqlState : error.kind;
}

const count = async (actor: Actor, table: string): Promise<number> => {
  const rows = value(
    await withIdentity(pool, actor, tx =>
      tx.query(`SELECT count(*)::int AS n FROM ${table}`)
    )
  );
  return Number(rows[0]?.n);
};

const insertApplication = (
  tx: IdentityTx,
  referencia: string,
  estado = "RECIBIDA"
) =>
  tx.query(
    `INSERT INTO applications
       (referencia, estado, categoria, email, datos, consentimiento_en, consentimiento_version, recibida_en)
     VALUES ($1, $2, 'ACTIVO', $3, '{}'::jsonb, now(), 'v1', now())`,
    [referencia, estado, `${referencia.toLowerCase()}@example.com`]
  );

describe.skipIf(!(await shouldRunDbTests()))("RLS (PostgreSQL real)", () => {
  beforeAll(async () => {
    value(await freshDatabase());
    pool = appPool(1); // 1 conexión: obliga a reutilizarla y detecta fugas de identidad
    // Siembra a través de la propia aplicación, con identidad de admin (ejercita las políticas).
    value(
      await withIdentity(pool, admin, async tx => {
        for (const [id, email] of [
          [A, "a@example.com"],
          [B, "b@example.com"],
        ] as const) {
          const r = await tx.query(
            "INSERT INTO members (id, email, nombres, apellidos, categoria) VALUES ($1, $2, 'N', 'A', 'ACTIVO')",
            [id, email]
          );
          if (!r.success) return r;
        }
        return ok(undefined);
      })
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  describe("members", () => {
    it("sin identidad falla CERRADO: cero filas", async () => {
      const raw = await pool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM members"
      );
      expect(raw.rows[0]?.n).toBe(0);
      expect(await count(anon, "members")).toBe(0);
    });

    it("cada miembro ve solo su fila (A no ve a B)", async () => {
      const rows = value(
        await as(memberA, tx => tx.query("SELECT email FROM members"))
      ) as readonly { email: string }[];
      expect(rows.map(r => r.email)).toEqual(["a@example.com"]);

      const asB = value(
        await as(memberB, tx =>
          tx.query("SELECT id FROM members WHERE id = $1", [A])
        )
      ) as readonly unknown[];
      expect(asB).toHaveLength(0); // IDOR: B pide por id la fila de A y no existe para B
    });

    it("el personal ve todas las filas; un miembro no puede modificar ni crear", async () => {
      expect(await count(secretaria, "members")).toBe(2);
      expect(await count(tesoreria, "members")).toBe(2);

      const update = await as(memberA, tx =>
        tx.query(
          "UPDATE members SET role = 'admin' WHERE id = $1 RETURNING id",
          [A]
        )
      );
      expect(value(update)).toHaveLength(0); // escalada de privilegios bloqueada

      const insert = await as(memberA, tx =>
        tx.query(
          "INSERT INTO members (email, nombres, apellidos) VALUES ('x@example.com', 'X', 'X')"
        )
      );
      expect(sqlState(insert)).toBe("42501");
    });

    it("el contexto 'system' puede leer miembros (inicio de sesión) pero no crearlos", async () => {
      expect(await count(system, "members")).toBe(2);
      const insert = await as(system, tx =>
        tx.query(
          "INSERT INTO members (email, nombres, apellidos) VALUES ('s@example.com', 'S', 'S')"
        )
      );
      expect(sqlState(insert)).toBe("42501");
    });
  });

  describe("applications y application_events", () => {
    it("un anónimo puede ENVIAR en estado RECIBIDA pero no leer lo enviado", async () => {
      value(await as(anon, tx => insertApplication(tx, "SVD-2026-AAAAAA")));
      expect(await count(anon, "applications")).toBe(0);
      expect(await count(memberA, "applications")).toBe(0);
      expect(await count(tesoreria, "applications")).toBe(0); // minimización de datos
      expect(await count(secretaria, "applications")).toBe(1);
    });

    it("un anónimo NO puede crear un expediente ya aprobado", async () => {
      const result = await as(anon, tx =>
        insertApplication(tx, "SVD-2026-BBBBBB", "APROBADA")
      );
      expect(sqlState(result)).toBe("42501");
    });

    it("INSERT … RETURNING exige política SELECT: por eso el alta anónima no lo usa", async () => {
      const result = await as(anon, tx =>
        tx.query(
          `INSERT INTO applications
             (referencia, categoria, email, datos, consentimiento_en, consentimiento_version, recibida_en)
           VALUES ('SVD-2026-CCCCCC', 'ACTIVO', 'c@example.com', '{}'::jsonb, now(), 'v1', now())
           RETURNING id`
        )
      );
      expect(sqlState(result)).toBe("42501");
    });

    it("solo revisores cambian el estado", async () => {
      const byMember = await as(memberA, tx =>
        tx.query(
          "UPDATE applications SET estado = 'EN_REVISION' WHERE referencia = 'SVD-2026-AAAAAA' RETURNING id"
        )
      );
      expect(value(byMember)).toHaveLength(0);

      const byStaff = await as(secretaria, tx =>
        tx.query(
          "UPDATE applications SET estado = 'EN_REVISION' WHERE referencia = 'SVD-2026-AAAAAA' RETURNING id"
        )
      );
      expect(value(byStaff)).toHaveLength(1);
    });

    it("el anónimo solo registra el evento inicial; la bitácora es de solo inserción", async () => {
      const appId = (
        value(
          await as(secretaria, tx =>
            tx.query("SELECT id FROM applications LIMIT 1")
          )
        ) as readonly { id: string }[]
      )[0]?.id;

      const initial = await as(anon, tx =>
        tx.query(
          "INSERT INTO application_events (application_id, desde, hacia) VALUES ($1, NULL, 'RECIBIDA')",
          [appId]
        )
      );
      expect(initial.success).toBe(true);

      const forged = await as(anon, tx =>
        tx.query(
          "INSERT INTO application_events (application_id, desde, hacia) VALUES ($1, 'RECIBIDA', 'APROBADA')",
          [appId]
        )
      );
      expect(sqlState(forged)).toBe("42501");

      const review = await as(secretaria, tx =>
        tx.query(
          "INSERT INTO application_events (application_id, desde, hacia, actor_id) VALUES ($1, 'RECIBIDA', 'EN_REVISION', $2)",
          [appId, STAFF]
        )
      );
      // actor_id debe existir en members: el staff de prueba no está sembrado ⇒ FK (23503), no RLS.
      expect(sqlState(review)).toBe("23503");

      const update = await as(admin, tx =>
        tx.query("UPDATE application_events SET nota = 'x'")
      );
      expect(sqlState(update)).toBe("42501");
      const del = await as(admin, tx =>
        tx.query("DELETE FROM application_events")
      );
      expect(sqlState(del)).toBe("42501");
    });
  });

  describe("audit_log", () => {
    it("no permite falsificar la identidad del actor", async () => {
      const honest = await as(memberA, tx =>
        tx.query(
          "INSERT INTO audit_log (actor_id, actor_role, accion) VALUES ($1, 'member', 'ver')",
          [A]
        )
      );
      expect(honest.success).toBe(true);

      const lie = await as(memberA, tx =>
        tx.query(
          "INSERT INTO audit_log (actor_id, actor_role, accion) VALUES ($1, 'admin', 'ver')",
          [A]
        )
      );
      expect(sqlState(lie)).toBe("42501");
    });

    it("solo admin lee y nadie modifica ni borra", async () => {
      expect(await count(memberA, "audit_log")).toBe(0);
      expect(await count(secretaria, "audit_log")).toBe(0);
      expect(await count(admin, "audit_log")).toBe(1);
      expect(
        sqlState(await as(admin, tx => tx.query("DELETE FROM audit_log")))
      ).toBe("42501");
    });
  });

  describe("sesiones y enlaces de acceso", () => {
    it("solo el contexto 'system' los ve o escribe", async () => {
      const insert = (actor: Actor) =>
        as(actor, tx =>
          tx.query(
            `INSERT INTO login_challenges (member_id, token_hash, expires_at)
             VALUES ($1, decode(md5(random()::text), 'hex'), now() + interval '15 minutes')`,
            [A]
          )
        );
      expect(sqlState(await insert(memberA))).toBe("42501");
      expect(sqlState(await insert(admin))).toBe("42501");
      expect((await insert(system)).success).toBe(true);

      expect(await count(system, "login_challenges")).toBe(1);
      expect(await count(admin, "login_challenges")).toBe(0);
      expect(await count(memberA, "login_challenges")).toBe(0);
    });
  });

  describe("el rol de la aplicación no puede saltarse la seguridad", () => {
    it("no puede ejecutar DDL ni cambiar de rol ni apagar RLS", async () => {
      for (const statement of [
        "CREATE TABLE intruso (id int)",
        "SET ROLE svodeb_owner",
        "ALTER TABLE members DISABLE ROW LEVEL SECURITY",
        "DROP POLICY members_select_self ON members",
      ]) {
        const result = await as(admin, tx => tx.query(statement));
        expect(result.success, statement).toBe(false);
      }
    });

    it("FORCE RLS: ni el dueño de las tablas ve filas sin una política que lo permita", async () => {
      const owner = new pg.Client({ connectionString: OWNER_URL });
      await owner.connect();
      try {
        const r = await owner.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM members"
        );
        expect(r.rows[0]?.n).toBe(0);
      } finally {
        await owner.end();
      }
    });
  });

  describe("withIdentity", () => {
    it("la identidad es local a la transacción: no se filtra por el pool", async () => {
      expect(await count(admin, "members")).toBe(2);
      // Misma (única) conexión del pool, ahora sin withIdentity:
      const raw = await pool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM members"
      );
      expect(raw.rows[0]?.n).toBe(0);
    });

    it("un err(...) de negocio hace ROLLBACK de todo lo escrito", async () => {
      const result = await withIdentity(pool, admin, async tx => {
        await tx.query(
          "INSERT INTO members (email, nombres, apellidos) VALUES ('fantasma@example.com', 'F', 'F')"
        );
        return err("regla de negocio violada" as const);
      });
      expect(result).toEqual({
        success: false,
        error: "regla de negocio violada",
      });
      const rows = value(
        await as(admin, tx =>
          tx.query("SELECT 1 FROM members WHERE email = 'fantasma@example.com'")
        )
      ) as readonly unknown[];
      expect(rows).toHaveLength(0);
    });

    it("rechaza identidades inválidas sin tocar la base", async () => {
      let called = false;
      const result = await withIdentity(
        pool,
        { role: "admin", memberId: "no-es-un-uuid" },
        () => {
          called = true;
          return Promise.resolve(ok(1));
        }
      );
      expect(result).toEqual({
        success: false,
        error: { kind: "INVALID_ACTOR" },
      });
      expect(called).toBe(false);
    });

    it("una inyección en el id del actor no llega a ejecutarse como SQL", async () => {
      const result = await withIdentity(
        pool,
        { role: "member", memberId: "'; DROP TABLE members; --" },
        () => Promise.resolve(ok(1))
      );
      expect(result.success).toBe(false);
      expect(await count(admin, "members")).toBe(2);
    });
  });
});
