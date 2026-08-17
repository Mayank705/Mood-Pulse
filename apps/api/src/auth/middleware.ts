import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { verifyAppToken, AppClaims } from "./jwt";
import { prisma } from "../db/prisma";
import { Role } from "../types/enums";

export interface AuthenticatedUser {
  id: string; // employee.id
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  departmentId: string;
  subDepartmentId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Every route behind this middleware gets a fully resolved, DB-backed
 * identity — never trusting role/claims baked into a client-held token
 * alone. This is what makes RBAC enforcement server-side rather than
 * UI-hiding: even if a client forged a JWT role claim, the employee's
 * *current* role and employment status are re-read from the directory on
 * every request.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length);

  try {
    let employeeId: string;

    if (env.authMode === "dev") {
      const claims: AppClaims = verifyAppToken(token);
      employeeId = claims.sub;
    } else {
      // Production path: validate against Entra ID, then resolve the
      // employee by entraObjectId (see auth/entraProvider.ts).
      const { verifyEntraToken } = await import("./entraProvider");
      const entraClaims = await verifyEntraToken(token);
      const employee = await prisma.employee.findUnique({ where: { entraObjectId: entraClaims.oid } });
      if (!employee) return res.status(401).json({ error: "No employee record linked to this account" });
      employeeId = employee.id;
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || employee.employmentStatus !== "ACTIVE") {
      return res.status(401).json({ error: "Account is not active" });
    }

    req.user = {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      email: employee.email,
      role: employee.role as Role,
      managerId: employee.managerId,
      departmentId: employee.departmentId,
      subDepartmentId: employee.subDepartmentId,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient role for this action" });
    }
    next();
  };
}
