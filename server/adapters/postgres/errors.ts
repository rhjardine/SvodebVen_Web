import { describeCause } from "../../../shared/result";

/** Error de base de datos ya traducido (el borde del adaptador captura las excepciones del driver). */
export type DbError =
  | Readonly<{
      kind: "DB_ERROR";
      /** Código SQLSTATE (p. ej. 23505 = clave única, 42501 = permiso/RLS). */
      sqlState: string | null;
      message: string;
    }>
  | Readonly<{ kind: "INVALID_ACTOR" }>
  | Readonly<{ kind: "ROW_SHAPE"; message: string }>;

export function toDbError(cause: unknown): DbError {
  const sqlState =
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof cause.code === "string"
      ? cause.code
      : null;
  return { kind: "DB_ERROR", sqlState, message: describeCause(cause) };
}

export const SQLSTATE_UNIQUE_VIOLATION = "23505";
export const SQLSTATE_INSUFFICIENT_PRIVILEGE = "42501";

export function isUniqueViolation(error: DbError): boolean {
  return (
    error.kind === "DB_ERROR" && error.sqlState === SQLSTATE_UNIQUE_VIOLATION
  );
}
