import { createHash, createSecretKey, type KeyObject } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { ROLES, type Identity } from "../../shared/identity";
import { err, ok, tryAsync, type Result } from "../../shared/result";

export type JwtConfig = Readonly<{
  secret: string;
  /** Secreto anterior: se acepta SOLO para verificar durante una rotación. */
  previousSecret?: string;
  issuer: string;
  audience: string;
  ttlSeconds: number;
  now?: () => Date;
}>;

export type JwtError = Readonly<{ kind: "INVALID_TOKEN" }>;

export type JwtService = Readonly<{
  sign: (identity: Identity) => Promise<string>;
  verify: (token: string) => Promise<Result<Identity, JwtError>>;
}>;

const ClaimsSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
});

const keyId = (secret: string): string =>
  createHash("sha256").update(secret).digest("hex").slice(0, 16);

/**
 * Access token HS256 de vida corta. El algoritmo se FIJA al verificar (rechaza `none` y cualquier
 * otro), y `kid` permite rotar el secreto sin invalidar de golpe las sesiones activas.
 */
export function createJwtService(config: JwtConfig): JwtService {
  const signingKey = createSecretKey(Buffer.from(config.secret));
  const currentKid = keyId(config.secret);
  const keys = new Map<string, KeyObject>([[currentKid, signingKey]]);
  if (config.previousSecret) {
    keys.set(
      keyId(config.previousSecret),
      createSecretKey(Buffer.from(config.previousSecret))
    );
  }
  const now = config.now ?? (() => new Date());

  return {
    sign: identity => {
      const issuedAt = Math.floor(now().getTime() / 1000);
      return new SignJWT({ role: identity.role })
        .setProtectedHeader({ alg: "HS256", kid: currentKid, typ: "JWT" })
        .setSubject(identity.memberId)
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setJti(crypto.randomUUID())
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + config.ttlSeconds)
        .sign(signingKey);
    },
    verify: async token => {
      const verified = await tryAsync(
        () =>
          jwtVerify(
            token,
            header => {
              const key = header.kid ? keys.get(header.kid) : undefined;
              if (!key) return Promise.reject(new Error("kid desconocido"));
              return Promise.resolve(key);
            },
            {
              algorithms: ["HS256"],
              issuer: config.issuer,
              audience: config.audience,
              currentDate: now(),
            }
          ),
        (): JwtError => ({ kind: "INVALID_TOKEN" })
      );
      if (!verified.success) return verified;
      const claims = ClaimsSchema.safeParse(verified.value.payload);
      return claims.success
        ? ok({ memberId: claims.data.sub, role: claims.data.role })
        : err({ kind: "INVALID_TOKEN" });
    },
  };
}
