import { createHash, randomBytes } from "node:crypto";

/** Token opaco de 32 bytes; solo su hash SHA-256 se guarda en la base de datos. */
export type OpaqueToken = Readonly<{ token: string; hash: Buffer }>;

export const hashToken = (token: string): Buffer =>
  createHash("sha256").update(token).digest();

export function generateToken(): OpaqueToken {
  const token = randomBytes(32).toString("base64url");
  return Object.freeze({ token, hash: hashToken(token) });
}
