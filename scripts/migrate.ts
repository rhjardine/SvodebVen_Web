/**
 * Aplica las migraciones pendientes de db/migrations.
 * Uso: pnpm db:migrate   (lee DATABASE_MIGRATION_URL y, opcional, DB_APP_ROLE del entorno o de .env)
 */
import path from "node:path";
import {
  describeMigrationError,
  runMigrations,
} from "../server/adapters/postgres/migrate";

const connectionString = process.env.DATABASE_MIGRATION_URL;
if (!connectionString) {
  console.error(
    "✘ Define DATABASE_MIGRATION_URL (conexión del rol svodeb_owner)."
  );
  process.exit(1);
}

const result = await runMigrations({
  connectionString,
  dir: path.resolve(import.meta.dirname, "../db/migrations"),
  appRole: process.env.DB_APP_ROLE ?? "svodeb_app",
});

if (!result.success) {
  console.error(`✘ ${describeMigrationError(result.error)}`);
  process.exit(1);
}
console.log(
  result.value.length === 0
    ? "✔ La base de datos ya está al día."
    : `✔ Migraciones aplicadas: ${result.value.join(", ")}`
);
