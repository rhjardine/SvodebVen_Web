import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { z } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  purgeExpiredIdempotencyKeys,
  withIdempotency,
} from "../../server/adapters/postgres/idempotency";
import type { DbPool } from "../../server/adapters/postgres/pool";
import {
  withIdentity,
  type Actor,
} from "../../server/adapters/postgres/with-identity";
import { mountRoute } from "../../server/http/route";
import { defineRoute } from "../../shared/contracts/define";
import { apiError } from "../../shared/errors";
import type { DbError } from "../../server/adapters/postgres/errors";
import type { JsonValue } from "../../server/adapters/postgres/idempotency";
import { err, ok, type Result } from "../../shared/result";
import {
  appPool,
  freshDatabase,
  shouldRunDbTests,
  silentLogger,
} from "../db-helpers";

const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const charge = defineRoute({
  method: "POST",
  path: "/api/test/charge",
  auth: "staff",
  idempotent: true,
  cache: "no-store",
  successStatus: 201,
  body: z.object({
    monto: z.number().int().positive(),
    falla: z.boolean().optional(),
  }),
  response: z.object({ monto: z.number() }),
});

const run = await shouldRunDbTests();

describe.skipIf(!run)(
  "idempotencia (misma transacción que la operación)",
  () => {
    let pool: DbPool;
    let server: Server;
    let base: string;

    const auditCount = async (): Promise<number> => {
      const rows = await withIdentity(
        pool,
        { role: "admin", memberId: ADMIN },
        tx =>
          tx.query(
            "SELECT count(*)::int AS n FROM audit_log WHERE accion = 'test.charge'"
          )
      );
      return rows.success ? Number(rows.value[0]?.n) : -1;
    };

    beforeAll(async () => {
      expect((await freshDatabase()).success).toBe(true);
      pool = appPool(10);
      const app = express();
      app.use(express.json());
      mountRoute(
        app,
        charge,
        async ({ body }, ctx) => {
          if (!ctx.identity || !ctx.idempotency) {
            return err(apiError("INTERNAL_ERROR", "x"));
          }
          const actor: Actor = {
            role: ctx.identity.role,
            memberId: ctx.identity.memberId,
          };
          const result = await withIdempotency(
            pool,
            actor,
            ctx.idempotency,
            async (
              tx
            ): Promise<Result<JsonValue, DbError | { kind: "BUSINESS" }>> => {
              if (body.falla) return err({ kind: "BUSINESS" });
              const written = await tx.query(
                `INSERT INTO audit_log (actor_id, actor_role, accion, detalle)
             VALUES ($1, $2, 'test.charge', $3)`,
                [
                  actor.memberId,
                  actor.role,
                  JSON.stringify({ monto: body.monto }),
                ]
              );
              return written.success ? ok({ monto: body.monto }) : written;
            }
          );
          if (!result.success) {
            return err(
              "kind" in result.error && result.error.kind === "KEY_REUSED"
                ? apiError(
                    "IDEMPOTENCY_KEY_REUSED",
                    "La clave ya se usó con otra solicitud."
                  )
                : apiError("CONFLICT", "No se pudo completar.")
            );
          }
          if (result.value.replayed)
            ctx.setHeader("Idempotent-Replayed", "true");
          return ok(z.object({ monto: z.number() }).parse(result.value.body));
        },
        {
          logger: silentLogger,
          cookieSecure: false,
          resolveIdentity: req =>
            Promise.resolve(
              ok({
                memberId: req.get("x-test-member") ?? ADMIN,
                role: "admin" as const,
              })
            ),
        }
      );
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

    const send = (key: string | undefined, body: unknown, member?: string) =>
      fetch(`${base}/api/test/charge`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-svodeb-csrf": "1",
          ...(key ? { "idempotency-key": key } : {}),
          ...(member ? { "x-test-member": member } : {}),
        },
        body: JSON.stringify(body),
      });

    it("exige una Idempotency-Key válida", async () => {
      expect((await send(undefined, { monto: 5 })).status).toBe(400);
      expect((await send("no-es-uuid", { monto: 5 })).status).toBe(400);
    });

    it("peticiones simultáneas con la misma clave producen UN efecto y la misma respuesta", async () => {
      const before = await auditCount();
      const key = crypto.randomUUID();
      const responses = await Promise.all(
        Array.from({ length: 6 }, () => send(key, { monto: 10 }))
      );
      expect(responses.map(r => r.status)).toEqual(Array(6).fill(201));
      const bodies = await Promise.all(responses.map(r => r.json()));
      for (const body of bodies) expect(body).toEqual({ monto: 10 });
      expect(
        responses.filter(r => r.headers.get("idempotent-replayed") === "true")
      ).toHaveLength(5);
      expect((await auditCount()) - before).toBe(1);
    });

    it("repetir después también repite la respuesta sin nuevo efecto", async () => {
      const key = crypto.randomUUID();
      await send(key, { monto: 20 });
      const before = await auditCount();
      const again = await send(key, { monto: 20 });
      expect(again.status).toBe(201);
      expect(again.headers.get("idempotent-replayed")).toBe("true");
      expect(await auditCount()).toBe(before);
    });

    it("la misma clave con otra carga útil → 422", async () => {
      const key = crypto.randomUUID();
      expect((await send(key, { monto: 30 })).status).toBe(201);
      expect((await send(key, { monto: 31 })).status).toBe(422);
    });

    it("la clave de otro actor no se puede reutilizar → 422", async () => {
      const key = crypto.randomUUID();
      expect((await send(key, { monto: 40 })).status).toBe(201);
      expect((await send(key, { monto: 40 }, OTHER)).status).toBe(422);
    });

    it("un fallo de negocio hace ROLLBACK y la clave queda libre para reintentar", async () => {
      const key = crypto.randomUUID();
      expect((await send(key, { monto: 50, falla: true })).status).toBe(409);
      const before = await auditCount();
      const retry = await send(key, { monto: 50 });
      // Cambia el cuerpo (falla opcional) → habría sido 422 si la clave hubiera quedado guardada.
      expect(retry.status).toBe(201);
      expect((await auditCount()) - before).toBe(1);
    });

    it("purga las claves vencidas (retención) y conserva las vigentes", async () => {
      const stale = {
        key: crypto.randomUUID(),
        scope: "POST /api/test/old",
        requestHash: Buffer.from("h"),
      };
      const actor: Actor = { role: "admin", memberId: ADMIN };
      const longAgo = () => new Date(Date.now() - 48 * 3_600_000);
      const saved = await withIdempotency(
        pool,
        actor,
        stale,
        () => Promise.resolve(ok({ a: 1 })),
        longAgo
      );
      expect(saved.success).toBe(true);
      const purged = await purgeExpiredIdempotencyKeys(pool);
      expect(purged.success && purged.value).toBeGreaterThanOrEqual(1);
      const fresh = await withIdempotency(pool, actor, stale, () =>
        Promise.resolve(ok({ a: 2 }))
      );
      expect(fresh.success && fresh.value.replayed).toBe(false);
    });
  }
);
