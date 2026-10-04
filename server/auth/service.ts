import type { SessionMember } from "../../shared/auth/contract";
import type { Identity } from "../../shared/identity";
import { err, ok, type Result } from "../../shared/result";
import type { DbError } from "../adapters/postgres/errors";
import {
  withIdentity,
  type Actor,
  type IdentityTx,
} from "../adapters/postgres/with-identity";
import type { DbPool } from "../adapters/postgres/pool";
import type { LoginLinkMailer } from "../adapters/mail/login-link-mailer";
import type { Logger } from "../membership/submit-application";
import type { JwtService } from "./jwt";
import { authRepository, type AuthMember } from "./repository";
import { generateToken, hashToken } from "./tokens";

export type AuthTtls = Readonly<{
  accessSeconds: number;
  refreshSeconds: number;
  loginLinkSeconds: number;
}>;

export type AuthServiceDeps = Readonly<{
  pool: DbPool;
  jwt: JwtService;
  mailer: LoginLinkMailer;
  logger: Logger;
  /** Origen público para armar el enlace del correo (p. ej. https://svodeb.org). */
  siteUrl: string;
  ttls: AuthTtls;
  now: () => Date;
}>;

export type RejectionReason = "INVALID" | "REUSED" | "SUSPENDED";

export type Granted = Readonly<{
  kind: "granted";
  member: SessionMember;
  identity: Identity;
  accessToken: string;
  refreshToken: string;
}>;
export type Rejected = Readonly<{ kind: "rejected"; reason: RejectionReason }>;
export type AuthOutcome = Granted | Rejected;

/** Fallo de infraestructura (la base no respondió). Los rechazos de negocio son valores, no errores. */
export type AuthError = Readonly<{ kind: "UNAVAILABLE" }>;

export type AuthService = Readonly<{
  requestLoginLink: (email: string) => Promise<Result<void, AuthError>>;
  redeemLoginLink: (token: string) => Promise<Result<AuthOutcome, AuthError>>;
  refresh: (refreshToken: string) => Promise<Result<AuthOutcome, AuthError>>;
  logout: (refreshToken: string) => Promise<Result<void, AuthError>>;
  describeMember: (
    identity: Identity
  ) => Promise<Result<SessionMember | null, AuthError>>;
}>;

const SYSTEM: Actor = Object.freeze({ role: "system", memberId: null });

const toSessionMember = (member: AuthMember): SessionMember => ({
  id: member.id,
  nombres: member.nombres,
  apellidos: member.apellidos,
  role: member.role,
});

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const after = (seconds: number): Date =>
    new Date(deps.now().getTime() + seconds * 1000);

  const unavailable = (where: string, cause: DbError): AuthError => {
    deps.logger.error("auth.db_failure", {
      where,
      sqlState:
        cause.kind === "DB_ERROR" ? (cause.sqlState ?? "none") : cause.kind,
    });
    return { kind: "UNAVAILABLE" };
  };

  async function grant(
    tx: IdentityTx,
    member: AuthMember,
    familyId: string
  ): Promise<Result<{ refreshToken: string }, DbError>> {
    const refresh = generateToken();
    const created = await authRepository.createSession(tx, {
      memberId: member.id,
      familyId,
      tokenHash: refresh.hash,
      expiresAt: after(deps.ttls.refreshSeconds),
    });
    return created.success ? ok({ refreshToken: refresh.token }) : created;
  }

  async function finish(
    member: AuthMember,
    refreshToken: string
  ): Promise<Granted> {
    const identity: Identity = { memberId: member.id, role: member.role };
    return {
      kind: "granted",
      member: toSessionMember(member),
      identity,
      accessToken: await deps.jwt.sign(identity),
      refreshToken,
    };
  }

  return {
    async requestLoginLink(email) {
      const prepared = await withIdentity(deps.pool, SYSTEM, async tx => {
        const member = await authRepository.findMemberByEmail(tx, email);
        if (!member.success) return member;
        if (!member.value || member.value.estado !== "ACTIVO") {
          return ok(null);
        }
        const link = generateToken();
        const stored = await authRepository.replaceChallenge(
          tx,
          member.value.id,
          link.hash,
          after(deps.ttls.loginLinkSeconds)
        );
        return stored.success
          ? ok({ member: member.value, token: link.token })
          : stored;
      });
      if (!prepared.success)
        return err(unavailable("requestLoginLink", prepared.error));

      if (prepared.value) {
        const { member, token } = prepared.value;
        // Envío sin esperar: el tiempo de respuesta no delata si la cuenta existe.
        void deps.mailer
          .send({
            to: member.email,
            nombres: member.nombres,
            url: `${deps.siteUrl}/acceso#token=${token}`,
            expiresInMinutes: Math.round(deps.ttls.loginLinkSeconds / 60),
          })
          .then(sent => {
            if (!sent.success) {
              deps.logger.error("auth.login_link_not_sent", {
                reason: sent.error,
              });
            }
          });
      }
      return ok(undefined);
    },

    async redeemLoginLink(token) {
      const outcome = await withIdentity(
        deps.pool,
        SYSTEM,
        async (
          tx
        ): Promise<
          Result<
            Rejected | { member: AuthMember; refreshToken: string },
            DbError
          >
        > => {
          const memberId = await authRepository.consumeChallenge(
            tx,
            hashToken(token),
            deps.now()
          );
          if (!memberId.success) return memberId;
          if (!memberId.value)
            return ok({ kind: "rejected", reason: "INVALID" });

          const member = await authRepository.findMemberById(
            tx,
            memberId.value
          );
          if (!member.success) return member;
          if (!member.value) return ok({ kind: "rejected", reason: "INVALID" });
          if (member.value.estado !== "ACTIVO")
            return ok({ kind: "rejected", reason: "SUSPENDED" });

          const granted = await grant(tx, member.value, crypto.randomUUID());
          return granted.success
            ? ok({
                member: member.value,
                refreshToken: granted.value.refreshToken,
              })
            : granted;
        }
      );
      if (!outcome.success)
        return err(unavailable("redeemLoginLink", outcome.error));
      if ("kind" in outcome.value) return ok(outcome.value);
      return ok(await finish(outcome.value.member, outcome.value.refreshToken));
    },

    async refresh(refreshToken) {
      const now = deps.now();
      const outcome = await withIdentity(
        deps.pool,
        SYSTEM,
        async (
          tx
        ): Promise<
          Result<
            Rejected | { member: AuthMember; refreshToken: string },
            DbError
          >
        > => {
          const session = await authRepository.findSessionForUpdate(
            tx,
            hashToken(refreshToken)
          );
          if (!session.success) return session;
          const row = session.value;
          if (!row || row.revoked_at || row.expires_at <= now)
            return ok({ kind: "rejected", reason: "INVALID" });

          if (row.used_at) {
            // Reutilización de un refresh ya rotado: se asume robo y se revoca TODA la familia.
            // Se devuelve `ok` para que la revocación se COMMITEE (un `err` haría ROLLBACK).
            const revoked = await authRepository.revokeFamily(
              tx,
              row.family_id,
              now
            );
            return revoked.success
              ? ok({ kind: "rejected", reason: "REUSED" })
              : revoked;
          }

          const member = await authRepository.findMemberById(tx, row.member_id);
          if (!member.success) return member;
          if (!member.value || member.value.estado !== "ACTIVO") {
            const revoked = await authRepository.revokeFamily(
              tx,
              row.family_id,
              now
            );
            return revoked.success
              ? ok({ kind: "rejected", reason: "SUSPENDED" })
              : revoked;
          }

          const used = await authRepository.markUsed(tx, row.id, now);
          if (!used.success) return used;
          const next = await grant(tx, member.value, row.family_id);
          return next.success
            ? ok({
                member: member.value,
                refreshToken: next.value.refreshToken,
              })
            : next;
        }
      );
      if (!outcome.success) return err(unavailable("refresh", outcome.error));
      if ("kind" in outcome.value) {
        if (outcome.value.reason === "REUSED")
          deps.logger.error("auth.refresh_reuse_detected");
        return ok(outcome.value);
      }
      return ok(await finish(outcome.value.member, outcome.value.refreshToken));
    },

    async logout(refreshToken) {
      const done = await withIdentity(deps.pool, SYSTEM, async tx => {
        const session = await authRepository.findSessionForUpdate(
          tx,
          hashToken(refreshToken)
        );
        if (!session.success) return session;
        if (!session.value) return ok(undefined);
        return authRepository.revokeFamily(
          tx,
          session.value.family_id,
          deps.now()
        );
      });
      return done.success
        ? ok(undefined)
        : err(unavailable("logout", done.error));
    },

    async describeMember(identity) {
      const actor: Actor = { role: identity.role, memberId: identity.memberId };
      const found = await withIdentity(deps.pool, actor, tx =>
        authRepository.findMemberById(tx, identity.memberId)
      );
      if (!found.success)
        return err(unavailable("describeMember", found.error));
      const member = found.value;
      return ok(
        member && member.estado === "ACTIVO" ? toSessionMember(member) : null
      );
    },
  };
}
