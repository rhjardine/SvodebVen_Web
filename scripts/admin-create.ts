/**
 * Crea (o actualiza el rol de) una cuenta de personal. Sin interfaz web a propósito:
 * ninguna pantalla puede escalar privilegios.
 * Uso: pnpm admin:create correo@dominio.org "Nombres" "Apellidos" [admin|secretaria|tesoreria]
 * Requiere DATABASE_URL (rol svodeb_app). Se ejecuta con identidad `admin`, sujeta a RLS.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createPool } from "../server/adapters/postgres/pool";
import { withIdentity } from "../server/adapters/postgres/with-identity";
import { err, ok } from "../shared/result";

const ArgsSchema = z.tuple([
  z.email().transform(value => value.toLowerCase()),
  z.string().trim().min(1).max(100),
  z.string().trim().min(1).max(100),
  z.enum(["admin", "secretaria", "tesoreria"]).default("admin"),
]);

const connectionString = process.env.DATABASE_URL;
const parsed = ArgsSchema.safeParse([
  process.argv[2],
  process.argv[3],
  process.argv[4],
  process.argv[5] ?? "admin",
]);
if (!connectionString || !parsed.success) {
  console.error(
    '✘ Uso: DATABASE_URL=… pnpm admin:create correo "Nombres" "Apellidos" [admin|secretaria|tesoreria]'
  );
  process.exit(1);
}
const [email, nombres, apellidos, role] = parsed.data;

const logger = { info: () => undefined, error: console.error };
const pool = createPool(connectionString, logger, { max: 1 });
const actorId = randomUUID();

const result = await withIdentity(
  pool,
  { role: "admin", memberId: actorId },
  async tx => {
    const rows = await tx.query(
      `INSERT INTO members (email, nombres, apellidos, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, estado = 'ACTIVO'
       RETURNING id`,
      [email, nombres, apellidos, role]
    );
    if (!rows.success) return rows;
    const id = rows.value[0]?.id;
    if (typeof id !== "string")
      return err({ kind: "ROW_SHAPE" as const, message: "sin id" });
    const audited = await tx.query(
      `INSERT INTO audit_log (actor_id, actor_role, accion, entidad, entidad_id, detalle)
       VALUES ($1, 'admin', 'staff.upsert', 'members', $2, $3)`,
      [actorId, id, JSON.stringify({ role })]
    );
    return audited.success ? ok(id) : audited;
  }
);
await pool.end();

if (!result.success) {
  console.error("✘ No se pudo crear la cuenta:", JSON.stringify(result.error));
  process.exit(1);
}
console.log(`✔ Cuenta ${role} lista: ${email} (${result.value})`);
