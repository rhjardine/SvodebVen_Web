import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  describeMigrationError,
  runMigrations,
} from "../../server/adapters/postgres/migrate";
import {
  freshDatabase,
  MIGRATIONS_DIR,
  OWNER_URL,
  shouldRunDbTests,
} from "../db-helpers";

describe.skipIf(!(await shouldRunDbTests()))("migraciones", () => {
  it("aplica todo en una base vacía y es idempotente al repetir", async () => {
    const first = await freshDatabase();
    expect(first.success).toBe(true);
    if (first.success) expect(first.value).toContain("0001_init.sql");

    const second = await runMigrations({
      connectionString: OWNER_URL,
      dir: MIGRATIONS_DIR,
      appRole: "svodeb_app",
    });
    expect(second).toEqual({ success: true, value: [] });
  });

  it("detecta que una migración aplicada fue editada (checksum)", async () => {
    await freshDatabase();
    const dir = await mkdtemp(path.join(tmpdir(), "svodeb-mig-"));
    try {
      await cp(MIGRATIONS_DIR, dir, { recursive: true });
      const file = path.join(dir, "0001_init.sql");
      await writeFile(file, `${await readFile(file, "utf8")}\n-- editada\n`);
      const result = await runMigrations({
        connectionString: OWNER_URL,
        dir,
        appRole: "svodeb_app",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe("CHECKSUM_MISMATCH");
        expect(describeMigrationError(result.error)).toMatch(/nueva migración/);
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rechaza un nombre de rol que no sea un identificador seguro", async () => {
    const result = await runMigrations({
      connectionString: OWNER_URL,
      dir: MIGRATIONS_DIR,
      appRole: 'x"; DROP TABLE members; --',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.kind).toBe("INVALID_ROLE_NAME");
  });

  it("revierte una migración que falla sin dejar rastro", async () => {
    await freshDatabase();
    const dir = await mkdtemp(path.join(tmpdir(), "svodeb-mig-"));
    try {
      await cp(MIGRATIONS_DIR, dir, { recursive: true });
      await writeFile(
        path.join(dir, "0002_rota.sql"),
        "CREATE TABLE medio_creada (id int); SELECT 1/0;"
      );
      const result = await runMigrations({
        connectionString: OWNER_URL,
        dir,
        appRole: "svodeb_app",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.kind).toBe("MIGRATION_FAILED");
      }
      // Tras el fallo, la tabla parcial no existe y 0002 no quedó registrada.
      const retry = await runMigrations({
        connectionString: OWNER_URL,
        dir: MIGRATIONS_DIR,
        appRole: "svodeb_app",
      });
      expect(retry).toEqual({ success: true, value: [] });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
