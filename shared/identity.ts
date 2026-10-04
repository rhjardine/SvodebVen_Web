/**
 * Identidad verificada de quien hace la petición. La construye el servidor a partir
 * del JWT validado (nunca de datos enviados por el cliente) y alimenta a RLS.
 */
export const ROLES = ["member", "secretaria", "tesoreria", "admin"] as const;
export type Role = (typeof ROLES)[number];

export type Identity = Readonly<{
  /** UUID del miembro (también de las cuentas de staff). */
  memberId: string;
  role: Role;
}>;

export const isStaff = (role: Role): boolean => role !== "member";
