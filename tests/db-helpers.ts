import path from "node:path";
import pg from "pg";
import {
  runMigrations,
  type MigrationError,
} from "../server/adapters/postgres/migrate";
import { createPool, type DbPool } from "../server/adapters/postgres/pool";
import type { Result } from "../shared/result";

/** Conexiones de PRUEBA (db:local las crea). En CI vienen del service container. */
export const OWNER_URL =
  process.env.TEST_DATABASE_MIGRATION_URL ??
  "postgresql://svodeb_owner:svodeb_owner_dev@localhost:5432/svodeb_test";
export const APP_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://svodeb_app:svodeb_app_dev@localhost:5432/svodeb_test";
export const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  "../db/migrations"
);

export const silentLogger = { info: () => undefined, error: () => undefined };

export async function dbAvailable(): Promise<boolean> {
  const client = new pg.Client({
    connectionString: OWNER_URL,
    connectionTimeoutMillis: 1500,
  });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

/** En CI la base DEBE existir (no se omite en silencio); en local se omite con aviso. */
export async function shouldRunDbTests(): Promise<boolean> {
  const available = await dbAvailable();
  if (!available && !process.env.CI) {
    console.warn(
      "⚠ Pruebas con base de datos omitidas: ejecuta `pnpm db:local` para habilitarlas."
    );
  }
  return available || Boolean(process.env.CI);
}

/** Deja la base de pruebas vacía (conexión del DUEÑO). */
export async function resetDatabase(): Promise<void> {
  const client = new pg.Client({ connectionString: OWNER_URL });
  await client.connect();
  try {
    await client.query(`
      DO $$ DECLARE r record;
      BEGIN
        FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
          EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
        END LOOP;
      END $$;
      DROP SCHEMA IF EXISTS app CASCADE;
    `);
  } finally {
    await client.end();
  }
}

export async function freshDatabase(): Promise<
  Result<readonly string[], MigrationError>
> {
  await resetDatabase();
  return runMigrations({
    connectionString: OWNER_URL,
    dir: MIGRATIONS_DIR,
    appRole: "svodeb_app",
  });
}

export function appPool(max = 4): DbPool {
  return createPool(APP_URL, silentLogger, { max });
}
