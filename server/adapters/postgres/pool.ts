import pg from "pg";
import type { Logger } from "../../membership/submit-application";

export type DbPool = pg.Pool;

/** Pool con tiempos límite defensivos; un error de un cliente inactivo se registra, no tumba el proceso. */
export function createPool(
  connectionString: string,
  logger: Logger,
  options: Readonly<{ max?: number }> = {}
): DbPool {
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    statement_timeout: 10_000,
    idle_in_transaction_session_timeout: 15_000,
  });
  pool.on("error", cause => {
    logger.error("db.pool_error", {
      reason: cause instanceof Error ? cause.message : "unknown",
    });
  });
  return pool;
}
