import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import {
  describeCause,
  err,
  ok,
  tryAsync,
  type Result,
} from "../../../shared/result";

/**
 * Ejecutor de migraciones SQL (db/migrations/NNNN_nombre.sql), transparente y sin magia:
 * - orden lexicográfico; cada migración corre en UNA transacción;
 * - registra el checksum: editar una migración ya aplicada es un ERROR (se crea una nueva);
 * - bloqueo consultivo: dos instancias desplegando a la vez no se pisan;
 * - sustituye {{app_role}} por el rol de la aplicación (validado como identificador).
 */
export type MigrationError =
  | Readonly<{ kind: "INVALID_ROLE_NAME"; role: string }>
  | Readonly<{ kind: "CHECKSUM_MISMATCH"; migration: string }>
  | Readonly<{ kind: "UNRESOLVED_PLACEHOLDER"; migration: string }>
  | Readonly<{ kind: "MIGRATION_FAILED"; migration: string; reason: string }>
  | Readonly<{ kind: "IO_FAILED"; reason: string }>
  | Readonly<{ kind: "CONNECTION_FAILED"; reason: string }>;

export type MigrateOptions = Readonly<{
  /** Conexión del rol DUEÑO (svodeb_owner), no la de la aplicación. */
  connectionString: string;
  dir: string;
  /** Rol de la aplicación que recibe los privilegios (por defecto svodeb_app). */
  appRole: string;
}>;

const ADVISORY_LOCK_KEY = 7_426_001;
const ROLE_NAME = /^[a-z_][a-z0-9_]*$/;
const PLACEHOLDER = /\{\{\s*[a-z_]+\s*\}\}/;

export function describeMigrationError(error: MigrationError): string {
  switch (error.kind) {
    case "INVALID_ROLE_NAME":
      return `Nombre de rol inválido: "${error.role}"`;
    case "CHECKSUM_MISMATCH":
      return `La migración ${error.migration} ya estaba aplicada y fue modificada. Crea una nueva migración en vez de editarla.`;
    case "UNRESOLVED_PLACEHOLDER":
      return `La migración ${error.migration} tiene marcadores {{...}} sin resolver.`;
    case "MIGRATION_FAILED":
      return `Falló la migración ${error.migration}: ${error.reason}`;
    case "IO_FAILED":
      return `No se pudieron leer las migraciones: ${error.reason}`;
    case "CONNECTION_FAILED":
      return `No se pudo conectar a la base de datos: ${error.reason}`;
  }
}

const checksum = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

type Applied = ReadonlyMap<string, string>;

async function run(
  client: pg.Client,
  sql: string,
  params?: readonly unknown[]
): Promise<Result<pg.QueryResult, string>> {
  return tryAsync(
    () => client.query(sql, params ? [...params] : undefined),
    describeCause
  );
}

async function loadApplied(
  client: pg.Client
): Promise<Result<Applied, MigrationError>> {
  const created = await run(
    client,
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       checksum text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`
  );
  if (!created.success) {
    return err({
      kind: "MIGRATION_FAILED",
      migration: "schema_migrations",
      reason: created.error,
    });
  }
  const rows = await run(
    client,
    "SELECT name, checksum FROM schema_migrations"
  );
  if (!rows.success) {
    return err({
      kind: "MIGRATION_FAILED",
      migration: "schema_migrations",
      reason: rows.error,
    });
  }
  const applied = new Map<string, string>();
  for (const row of rows.value.rows as { name: string; checksum: string }[]) {
    applied.set(row.name, row.checksum);
  }
  return ok(applied);
}

async function applyOne(
  client: pg.Client,
  name: string,
  rawSql: string,
  appRole: string
): Promise<Result<void, MigrationError>> {
  const sql = rawSql.replaceAll(
    "{{app_role}}",
    client.escapeIdentifier(appRole)
  );
  if (PLACEHOLDER.test(sql)) {
    return err({ kind: "UNRESOLVED_PLACEHOLDER", migration: name });
  }

  const begin = await run(client, "BEGIN");
  if (!begin.success)
    return err({
      kind: "MIGRATION_FAILED",
      migration: name,
      reason: begin.error,
    });

  const steps = [
    () => run(client, sql),
    () =>
      run(
        client,
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [name, checksum(rawSql)]
      ),
    () => run(client, "COMMIT"),
  ];
  for (const step of steps) {
    const result = await step();
    if (!result.success) {
      await run(client, "ROLLBACK");
      return err({
        kind: "MIGRATION_FAILED",
        migration: name,
        reason: result.error,
      });
    }
  }
  return ok(undefined);
}

/** Aplica las migraciones pendientes y devuelve los nombres aplicados (vacío = ya estaba al día). */
export async function runMigrations(
  options: MigrateOptions
): Promise<Result<readonly string[], MigrationError>> {
  if (!ROLE_NAME.test(options.appRole)) {
    return err({ kind: "INVALID_ROLE_NAME", role: options.appRole });
  }

  const files = await tryAsync(
    async () =>
      (await readdir(options.dir)).filter(f => f.endsWith(".sql")).sort(),
    (cause): MigrationError => ({
      kind: "IO_FAILED",
      reason: describeCause(cause),
    })
  );
  if (!files.success) return files;

  const client = new pg.Client({ connectionString: options.connectionString });
  const connected = await tryAsync(
    () => client.connect(),
    (cause): MigrationError => ({
      kind: "CONNECTION_FAILED",
      reason: describeCause(cause),
    })
  );
  if (!connected.success) return connected;

  try {
    const locked = await run(client, "SELECT pg_advisory_lock($1)", [
      ADVISORY_LOCK_KEY,
    ]);
    if (!locked.success) {
      return err({ kind: "CONNECTION_FAILED", reason: locked.error });
    }

    const applied = await loadApplied(client);
    if (!applied.success) return applied;

    const newlyApplied: string[] = [];
    for (const name of files.value) {
      const content = await tryAsync(
        () => readFile(path.join(options.dir, name), "utf8"),
        (cause): MigrationError => ({
          kind: "IO_FAILED",
          reason: describeCause(cause),
        })
      );
      if (!content.success) return content;

      const previous = applied.value.get(name);
      if (previous !== undefined) {
        if (previous !== checksum(content.value)) {
          return err({ kind: "CHECKSUM_MISMATCH", migration: name });
        }
        continue;
      }

      const result = await applyOne(
        client,
        name,
        content.value,
        options.appRole
      );
      if (!result.success) return result;
      newlyApplied.push(name);
    }
    return ok(newlyApplied);
  } finally {
    await tryAsync(
      () => client.end(),
      () => undefined
    );
  }
}
