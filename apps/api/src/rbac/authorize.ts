import { NextFunction, Request, Response } from "express";
import { hasPermission, Permission } from "./permissions";
import { prisma } from "../db/prisma";

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

/**
 * Recursively resolves every employee id reachable from `managerId` via the
 * manager->reports chain (their whole reporting subtree), plus the manager
 * themself. Used to scope MANAGER access to "their team" without letting
 * them reach across the org by guessing employee ids.
 */
export async function resolveManagedEmployeeIds(managerId: string): Promise<Set<string>> {
  const ids = new Set<string>([managerId]);
  let frontier = [managerId];
  while (frontier.length > 0) {
    const reports = await prisma.employee.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    frontier = reports.map((r) => r.id).filter((id) => !ids.has(id));
    frontier.forEach((id) => ids.add(id));
  }
  return ids;
}

/**
 * Authorization check for "can req.user view this employee's data":
 * SUPER_ADMIN / HR_ADMIN — org-wide; MANAGER — self + their reporting
 * subtree; EMPLOYEE — self only.
 */
export async function canAccessEmployee(req: Request, targetEmployeeId: string): Promise<boolean> {
  const user = req.user!;
  if (user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN") return true;
  if (user.id === targetEmployeeId) return true;
  if (user.role === "MANAGER") {
    const managed = await resolveManagedEmployeeIds(user.id);
    return managed.has(targetEmployeeId);
  }
  return false;
}
