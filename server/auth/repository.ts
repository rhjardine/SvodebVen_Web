import { z } from "zod";
import { ROLES } from "../../shared/identity";
import type { Result } from "../../shared/result";
import type { DbError } from "../adapters/postgres/errors";
import type { IdentityTx } from "../adapters/postgres/with-identity";

const MemberRowSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  nombres: z.string(),
  apellidos: z.string(),
  role: z.enum(ROLES),
  estado: z.enum(["ACTIVO", "SUSPENDIDO"]),
});
export type AuthMember = z.output<typeof MemberRowSchema>;

const SessionRowSchema = z.object({
  id: z.uuid(),
  member_id: z.uuid(),
  family_id: z.uuid(),
  expires_at: z.date(),
  used_at: z.date().nullable(),
  revoked_at: z.date().nullable(),
});
export type SessionRow = z.output<typeof SessionRowSchema>;

const MEMBER_COLUMNS = "id, email, nombres, apellidos, role, estado";

type R<T> = Promise<Result<T, DbError>>;

/** Acceso a datos de autenticación. Solo funciona con identidad `system` (lo exige RLS). */
export const authRepository = {
  async findMemberByEmail(tx: IdentityTx, email: string): R<AuthMember | null> {
    const rows = await tx.select(
      MemberRowSchema,
      `SELECT ${MEMBER_COLUMNS} FROM members WHERE email = $1`,
      [email]
    );
    return mapFirst(rows);
  },

  async findMemberById(tx: IdentityTx, id: string): R<AuthMember | null> {
    const rows = await tx.select(
      MemberRowSchema,
      `SELECT ${MEMBER_COLUMNS} FROM members WHERE id = $1`,
      [id]
    );
    return mapFirst(rows);
  },

  /** Un solo enlace vigente por persona: los pendientes anteriores se descartan. */
  async replaceChallenge(
    tx: IdentityTx,
    memberId: string,
    tokenHash: Buffer,
    expiresAt: Date
  ): R<void> {
    const cleared = await tx.query(
      "DELETE FROM login_challenges WHERE member_id = $1 AND consumed_at IS NULL",
      [memberId]
    );
    if (!cleared.success) return cleared;
    const inserted = await tx.query(
      "INSERT INTO login_challenges (member_id, token_hash, expires_at) VALUES ($1, $2, $3)",
      [memberId, tokenHash, expiresAt]
    );
    return inserted.success ? { success: true, value: undefined } : inserted;
  },

  /** Consumo atómico de un solo uso: el UPDATE condicional gana una sola vez. */
  async consumeChallenge(
    tx: IdentityTx,
    tokenHash: Buffer,
    now: Date
  ): R<string | null> {
    const rows = await tx.select(
      z.object({ member_id: z.uuid() }),
      `UPDATE login_challenges SET consumed_at = $2
       WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > $2
       RETURNING member_id`,
      [tokenHash, now]
    );
    return rows.success
      ? { success: true, value: rows.value[0]?.member_id ?? null }
      : rows;
  },

  async createSession(
    tx: IdentityTx,
    input: Readonly<{
      memberId: string;
      familyId: string;
      tokenHash: Buffer;
      expiresAt: Date;
    }>
  ): R<void> {
    const inserted = await tx.query(
      `INSERT INTO auth_sessions (member_id, family_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [input.memberId, input.familyId, input.tokenHash, input.expiresAt]
    );
    return inserted.success ? { success: true, value: undefined } : inserted;
  },

  /** Bloquea la fila: dos refrescos simultáneos con el mismo token se serializan. */
  async findSessionForUpdate(
    tx: IdentityTx,
    tokenHash: Buffer
  ): R<SessionRow | null> {
    const rows = await tx.select(
      SessionRowSchema,
      `SELECT id, member_id, family_id, expires_at, used_at, revoked_at
       FROM auth_sessions WHERE token_hash = $1 FOR UPDATE`,
      [tokenHash]
    );
    return mapFirst(rows);
  },

  async markUsed(tx: IdentityTx, sessionId: string, now: Date): R<void> {
    const updated = await tx.query(
      "UPDATE auth_sessions SET used_at = $2 WHERE id = $1",
      [sessionId, now]
    );
    return updated.success ? { success: true, value: undefined } : updated;
  },

  async revokeFamily(tx: IdentityTx, familyId: string, now: Date): R<void> {
    const updated = await tx.query(
      "UPDATE auth_sessions SET revoked_at = $2 WHERE family_id = $1 AND revoked_at IS NULL",
      [familyId, now]
    );
    return updated.success ? { success: true, value: undefined } : updated;
  },
};

function mapFirst<T>(
  rows: Result<readonly T[], DbError>
): Result<T | null, DbError> {
  return rows.success ? { success: true, value: rows.value[0] ?? null } : rows;
}
