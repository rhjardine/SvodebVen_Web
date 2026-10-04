import type { PoolClient } from "pg";
import { z } from "zod";
import { err, ok, tryAsync, type Result } from "../../../shared/result";
import { toDbError, type DbError } from "./errors";
import type { DbPool } from "./pool";

/**
 * "Proxy de identidad": cada operación sobre datos con RLS corre en una transacción
 * donde Express fija quién actúa. Las políticas de la base leen esos valores y
 * deniegan por defecto. Los repositorios solo aceptan `IdentityTx`, un tipo que
 * únicamente `withIdentity` puede crear: no hay forma de consultar sin identidad.
 */
export const ACTOR_ROLES = [
  "anon",
  "system",
  "member",
  "secretaria",
  "tesoreria",
  "admin",
] as const;
export type ActorRole = (typeof ACTOR_ROLES)[number];

export type Actor = Readonly<{ role: ActorRole; memberId: string | null }>;

const ActorSchema = z.object({
  role: z.enum(ACTOR_ROLES),
  memberId: z.uuid().nullable(),
});

export type Row = Readonly<Record<string, unknown>>;
export type Params = readonly unknown[];

const txBrand: unique symbol = Symbol("IdentityTx");

export type IdentityTx = Readonly<{
  [txBrand]: true;
  actor: Actor;
  /** Consulta parametrizada. Nunca concatenar valores en `sql`. */
  query: (
    sql: string,
    params?: Params
  ) => Promise<Result<readonly Row[], DbError>>;
  /** Consulta y valida cada fila con Zod (frontera de datos). */
  select: <S extends z.ZodType>(
    schema: S,
    sql: string,
    params?: Params
  ) => Promise<Result<readonly z.output<S>[], DbError>>;
}>;

function createTx(client: PoolClient, actor: Actor): IdentityTx {
  const query: IdentityTx["query"] = (sql, params = []) =>
    tryAsync(
      async () => {
        const result = await client.query<Record<string, unknown>>(sql, [
          ...params,
        ]);
        return result.rows;
      },
      cause => toDbError(cause)
    );

  const select: IdentityTx["select"] = async (schema, sql, params) => {
    const rows = await query(sql, params);
    if (!rows.success) return rows;
    const parsed = z.array(schema).safeParse(rows.value);
    return parsed.success
      ? ok(parsed.data)
      : err({
          kind: "ROW_SHAPE",
          message: "Las filas no cumplen el esquema esperado",
        });
  };

  return Object.freeze({ [txBrand]: true as const, actor, query, select });
}

async function exec(client: PoolClient, sql: string, params?: Params) {
  return tryAsync(
    () => client.query(sql, params ? [...params] : undefined),
    cause => toDbError(cause)
  );
}

/**
 * Ejecuta `work` dentro de una transacción con la identidad fijada.
 * - Éxito → COMMIT. Cualquier `err(...)` de negocio o fallo de BD → ROLLBACK.
 * - `set_config(..., true)` es local a la transacción: no se filtra a otras
 *   peticiones que reutilicen la conexión del pool.
 * (`SET LOCAL x = '…'` no admite parámetros; `set_config` sí, y evita inyección.)
 */
export async function withIdentity<T, E>(
  pool: DbPool,
  actor: Actor,
  work: (tx: IdentityTx) => Promise<Result<T, E>>
): Promise<Result<T, E | DbError>> {
  const validActor = ActorSchema.safeParse(actor);
  if (!validActor.success) return err({ kind: "INVALID_ACTOR" });

  const connection = await tryAsync(
    () => pool.connect(),
    cause => toDbError(cause)
  );
  if (!connection.success) return connection;
  const client = connection.value;

  let healthy = true;
  try {
    const begin = await exec(client, "BEGIN");
    if (!begin.success) {
      healthy = false;
      return begin;
    }

    const identity = await exec(
      client,
      "SELECT set_config('app.current_member_id', $1, true), set_config('app.current_actor_role', $2, true)",
      [validActor.data.memberId ?? "", validActor.data.role]
    );
    if (!identity.success) {
      healthy = (await exec(client, "ROLLBACK")).success;
      return identity;
    }

    const outcome = await tryAsync(
      () => work(createTx(client, validActor.data)),
      cause => toDbError(cause)
    );
    if (!outcome.success || !outcome.value.success) {
      healthy = (await exec(client, "ROLLBACK")).success;
      return outcome.success ? outcome.value : outcome;
    }

    const commit = await exec(client, "COMMIT");
    if (!commit.success) {
      healthy = false;
      return commit;
    }
    return outcome.value;
  } finally {
    // Una conexión en estado dudoso se destruye en vez de volver al pool.
    client.release(!healthy);
  }
}
