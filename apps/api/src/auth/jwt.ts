import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Role } from "../types/enums";

/**
 * Claims shape mirrors what we project out of a real Entra ID ID token
 * (oid, email, name, plus our own `role`/`employeeId` claims resolved via
 * the employee directory). This lets AUTH_MODE flip from "dev" to "entra"
 * without changing anything downstream of `authenticate()`.
 */
export interface AppClaims {
  sub: string; // employee.id
  employeeCode: string;
  email: string;
  name: string;
  role: Role;
  oid?: string; // Entra ID object id, when applicable
}

export function signAppToken(claims: AppClaims): string {
  return jwt.sign(claims, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyAppToken(token: string): AppClaims {
  return jwt.verify(token, env.jwtSecret) as AppClaims;
}
