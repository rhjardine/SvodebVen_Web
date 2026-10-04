import { z } from "zod";
import { defineRoute } from "../contracts/define";
import { ROLES } from "../identity";

export const AUTH_BASE = "/api/v1/auth" as const;

/** Lo único que el navegador sabe de la persona autenticada (sin tokens, sin correo de terceros). */
export const SessionMemberSchema = z.object({
  id: z.uuid(),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  role: z.enum(ROLES),
});
export type SessionMember = z.output<typeof SessionMemberSchema>;

const MemberEnvelope = z.object({ member: SessionMemberSchema });
const Accepted = z.object({ ok: z.literal(true) });

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email().max(254));

/** Token del enlace mágico: 32 bytes en base64url (43 caracteres). */
export const LoginTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Respuesta uniforme exista o no la cuenta (no se enumeran correos). */
export const requestLoginLinkContract = defineRoute({
  method: "POST",
  path: `${AUTH_BASE}/login-link`,
  auth: "public",
  idempotent: false,
  csrf: true,
  cache: "no-store",
  successStatus: 202,
  body: z.object({ email: EmailSchema }),
  response: Accepted,
});

/** El canje es POST (un escáner de correo que hace GET no consume el enlace). */
export const redeemLoginLinkContract = defineRoute({
  method: "POST",
  path: `${AUTH_BASE}/redeem`,
  auth: "public",
  idempotent: false,
  csrf: true,
  cache: "no-store",
  successStatus: 200,
  body: z.object({ token: LoginTokenSchema }),
  response: MemberEnvelope,
});

export const refreshSessionContract = defineRoute({
  method: "POST",
  path: `${AUTH_BASE}/refresh`,
  auth: "public",
  idempotent: false,
  csrf: true,
  cache: "no-store",
  successStatus: 200,
  response: MemberEnvelope,
});

export const logoutContract = defineRoute({
  method: "POST",
  path: `${AUTH_BASE}/logout`,
  auth: "public",
  idempotent: false,
  csrf: true,
  cache: "no-store",
  successStatus: 200,
  response: Accepted,
});

export const sessionContract = defineRoute({
  method: "GET",
  path: `${AUTH_BASE}/session`,
  auth: "optional",
  idempotent: false,
  cache: "no-store",
  successStatus: 200,
  response: z.object({ member: SessionMemberSchema.nullable() }),
});
