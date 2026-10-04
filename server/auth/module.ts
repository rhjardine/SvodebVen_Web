import type { Request } from "express";
import { apiError, type ApiError } from "../../shared/errors";
import type { Identity } from "../../shared/identity";
import { err, ok, type Result } from "../../shared/result";
import { authCookieNames, readCookie } from "./cookies";
import type { JwtService } from "./jwt";
import type { AuthService } from "./service";

/** Lo que `createApp` necesita del módulo de autenticación. */
export type AuthModule = Readonly<{
  service: AuthService;
  resolveIdentity: (req: Request) => Promise<Result<Identity | null, ApiError>>;
  /** Limitadores y política de cookies que `createApp` aplica a /auth. */
  cookieSecure: boolean;
  ttls: Readonly<{ accessSeconds: number; refreshSeconds: number }>;
}>;

export function createAuthModule(
  input: Readonly<{
    service: AuthService;
    jwt: JwtService;
    cookieSecure: boolean;
    ttls: Readonly<{ accessSeconds: number; refreshSeconds: number }>;
  }>
): AuthModule {
  const names = authCookieNames(input.cookieSecure);
  return {
    service: input.service,
    cookieSecure: input.cookieSecure,
    ttls: input.ttls,
    resolveIdentity: async req => {
      const token = readCookie(req.headers.cookie, names.access);
      if (!token) return ok(null);
      const verified = await input.jwt.verify(token);
      return verified.success
        ? ok(verified.value)
        : err(
            apiError(
              "UNAUTHENTICATED",
              "Tu sesión expiró. Inicia sesión de nuevo."
            )
          );
    },
  };
}
