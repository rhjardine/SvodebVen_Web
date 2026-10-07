/**
 * Paso de liberación: corre ANTES de arrancar el servidor en cada despliegue
 * (lo invoca `server/start.ts`; también hay un CLI en `server/release-cli.ts`).
 * - Con DB_APP_ROLE + DB_APP_PASSWORD intenta crear/actualizar el rol de la aplicación (separación
 *   dueño/aplicación). Si el proveedor no permite crear roles, falla con un mensaje claro.
 * - Sin ellos, usa el propio usuario de la conexión como rol de la aplicación ("rol único"): las
 *   políticas RLS siguen aplicando (FORCE ROW LEVEL SECURITY), pero la aplicación podría ejecutar DDL.
 * - Aplica las migraciones pendientes (idempotente, con bloqueo consultivo).
 * No termina el proceso: devuelve el código de salida (0 = listo) para que lo decida la raíz de composición.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import {
  describeCause,
  err,
  ok,
  tryAsync,
  type Result,
} from "../shared/result";
import {
  describeMigrationError,
  runMigrations,
} from "./adapters/postgres/migrate";

const ROLE_NAME = /^[a-z_][a-z0-9_]*$/;

type Setup = Readonly<{ appRole: string; separated: boolean }>;

async function resolveAppRole(
  connectionString: string,
  requestedRole: string | undefined,
  password: string | undefined
): Promise<Result<Setup, string>> {
  const client = new pg.Client({ connectionString });
  const connected = await tryAsync(() => client.connect(), describeCause);
  if (!connected.success) return err(`No se pudo conectar: ${connected.error}`);
  try {
    const me = await tryAsync(
      () => client.query<{ u: string }>("SELECT current_user AS u"),
      describeCause
    );
    if (!me.success) return err(me.error);
    const owner = me.value.rows[0]?.u ?? "";

    if (!requestedRole || requestedRole === owner) {
      return ok({ appRole: owner, separated: false });
    }
    if (!ROLE_NAME.test(requestedRole) || !password || password.length < 16) {
      return err(
        "DB_APP_ROLE debe ser un identificador válido y DB_APP_PASSWORD tener al menos 16 caracteres."
      );
    }
    const role = client.escapeIdentifier(requestedRole);
    const secret = client.escapeLiteral(password);
    const created = await tryAsync(
      () =>
        client.query(`
          DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${client.escapeLiteral(requestedRole)}) THEN
              CREATE ROLE ${role} LOGIN PASSWORD ${secret} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
            ELSE
              ALTER ROLE ${role} LOGIN PASSWORD ${secret} NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
            END IF;
          END $$`),
      describeCause
    );
    if (!created.success) {
      return err(`El proveedor no permitió crear el rol: ${created.error}`);
    }
    return ok({ appRole: requestedRole, separated: true });
  } finally {
    await tryAsync(
      () => client.end(),
      () => undefined
    );
  }
}

export async function runRelease(env: NodeJS.ProcessEnv): Promise<number> {
  const connectionString = env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL;
  if (!connectionString) {
    console.log(
      "release: sin base de datos configurada; no hay nada que migrar."
    );
    return 0;
  }
  const setup = await resolveAppRole(
    connectionString,
    env.DB_APP_ROLE,
    env.DB_APP_PASSWORD
  );
  if (!setup.success) {
    console.error(`release: ${setup.error}`);
    return 1;
  }
  console.log(
    setup.value.separated
      ? `release: rol de aplicación "${setup.value.appRole}" listo (separado del dueño).`
      : `release: ADVERTENCIA rol único "${setup.value.appRole}" (sin separación dueño/aplicación; RLS forzada).`
  );

  const dir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "migrations"
  );
  const result = await runMigrations({
    connectionString,
    dir,
    appRole: setup.value.appRole,
  });
  if (!result.success) {
    console.error(`release: ${describeMigrationError(result.error)}`);
    return 1;
  }
  console.log(
    result.value.length === 0
      ? "release: base de datos al día."
      : `release: migraciones aplicadas: ${result.value.join(", ")}`
  );
  return 0;
}
