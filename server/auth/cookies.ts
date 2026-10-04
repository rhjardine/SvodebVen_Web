/**
 * Nombres y lectura de cookies de sesión. En producción (HTTPS):
 * - `__Host-` exige Secure, Path=/ y sin Domain → acceso.
 * - `__Secure-` exige Secure → refresco, restringido a Path=/api/v1/auth.
 */
export type AuthCookieNames = Readonly<{ access: string; refresh: string }>;

export const REFRESH_COOKIE_PATH = "/api/v1/auth";
export const ACCESS_COOKIE_PATH = "/";

export const authCookieNames = (secure: boolean): AuthCookieNames =>
  secure
    ? { access: "__Host-svodeb_at", refresh: "__Secure-svodeb_rt" }
    : { access: "svodeb_at", refresh: "svodeb_rt" };

export function readCookie(
  header: string | undefined,
  name: string
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    return value.length > 0 && value.length <= 4096 ? value : null;
  }
  return null;
}
