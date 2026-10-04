import type { IRouter } from "express";
import {
  logoutContract,
  redeemLoginLinkContract,
  refreshSessionContract,
  requestLoginLinkContract,
  sessionContract,
} from "../../shared/auth/contract";
import { apiError, type ApiError } from "../../shared/errors";
import { err, ok, type Result } from "../../shared/result";
import { mountRoute, type CookieJar, type RouteDeps } from "../http/route";
import {
  ACCESS_COOKIE_PATH,
  authCookieNames,
  readCookie,
  REFRESH_COOKIE_PATH,
} from "./cookies";
import type { AuthError, AuthOutcome, Granted } from "./service";
import type { AuthModule } from "./module";

const unavailable = (_error: AuthError): ApiError =>
  apiError(
    "SERVICE_UNAVAILABLE",
    "El servicio de acceso no está disponible. Intenta de nuevo en unos minutos."
  );

/** Respuesta sobre rechazos: mismo mensaje para enlace inválido, vencido o ya usado. */
const rejection = (outcome: Exclude<AuthOutcome, Granted>): ApiError =>
  outcome.reason === "REUSED"
    ? apiError(
        "UNAUTHENTICATED",
        "Tu sesión ya no es válida. Inicia sesión de nuevo."
      )
    : apiError(
        "UNAUTHENTICATED",
        "El enlace no es válido o ya caducó. Solicita uno nuevo."
      );

export function mountAuthRoutes(
  target: IRouter,
  auth: AuthModule,
  route: RouteDeps
): void {
  const names = authCookieNames(auth.cookieSecure);

  const setSession = (cookies: CookieJar, granted: Granted): void => {
    cookies.set(names.access, granted.accessToken, {
      maxAgeSeconds: auth.ttls.accessSeconds,
      path: ACCESS_COOKIE_PATH,
    });
    cookies.set(names.refresh, granted.refreshToken, {
      maxAgeSeconds: auth.ttls.refreshSeconds,
      path: REFRESH_COOKIE_PATH,
    });
  };
  const clearSession = (cookies: CookieJar): void => {
    cookies.clear(names.access, ACCESS_COOKIE_PATH);
    cookies.clear(names.refresh, REFRESH_COOKIE_PATH);
  };

  const conclude = (
    result: Result<AuthOutcome, AuthError>,
    cookies: CookieJar
  ): Result<{ member: Granted["member"] }, ApiError> => {
    if (!result.success) return err(unavailable(result.error));
    if (result.value.kind === "rejected") {
      clearSession(cookies);
      return err(rejection(result.value));
    }
    setSession(cookies, result.value);
    return ok({ member: result.value.member });
  };

  mountRoute(
    target,
    requestLoginLinkContract,
    async ({ body }) => {
      const sent = await auth.service.requestLoginLink(body.email);
      return sent.success
        ? ok({ ok: true as const })
        : err(unavailable(sent.error));
    },
    route
  );

  mountRoute(
    target,
    redeemLoginLinkContract,
    async ({ body }, { cookies }) =>
      conclude(await auth.service.redeemLoginLink(body.token), cookies),
    route
  );

  mountRoute(
    target,
    refreshSessionContract,
    async (_input, { req, cookies }) => {
      const token = readCookie(req.headers.cookie, names.refresh);
      if (!token) {
        clearSession(cookies);
        return err(apiError("UNAUTHENTICATED", "No hay una sesión activa."));
      }
      return conclude(await auth.service.refresh(token), cookies);
    },
    route
  );

  mountRoute(
    target,
    logoutContract,
    async (_input, { req, cookies }) => {
      const token = readCookie(req.headers.cookie, names.refresh);
      clearSession(cookies);
      if (token) await auth.service.logout(token);
      return ok({ ok: true as const });
    },
    route
  );

  mountRoute(
    target,
    sessionContract,
    async (_input, { identity }) => {
      if (!identity) return ok({ member: null });
      const member = await auth.service.describeMember(identity);
      return member.success
        ? ok({ member: member.value })
        : err(unavailable(member.error));
    },
    route
  );
}

/** Rutas /auth cuando no hay base de datos: respuesta honesta, nunca un éxito simulado. */
export function mountAuthUnavailable(target: IRouter, route: RouteDeps): void {
  const off = () =>
    Promise.resolve(
      err(
        apiError(
          "SERVICE_UNAVAILABLE",
          "El acceso de miembros aún no está habilitado."
        )
      )
    );
  mountRoute(target, requestLoginLinkContract, off, route);
  mountRoute(target, redeemLoginLinkContract, off, route);
  mountRoute(target, refreshSessionContract, off, route);
  mountRoute(target, logoutContract, off, route);
  mountRoute(
    target,
    sessionContract,
    () => Promise.resolve(ok({ member: null })),
    route
  );
}
