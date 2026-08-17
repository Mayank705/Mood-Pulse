import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { signAppToken } from "./jwt";
import { Role } from "../types/enums";
import { recordAudit } from "../services/audit.service";

/**
 * Dev-only stand-in for the Entra ID sign-in flow.
 *
 * In production (AUTH_MODE=entra) the client authenticates against Microsoft
 * Entra ID via MSAL, and the API validates the resulting access token
 * against the tenant's JWKS endpoint (see auth/entraProvider.ts). There is
 * no password store here, no production secrets, and this router is never
 * mounted when AUTH_MODE=entra (see routes/auth.routes.ts).
 *
 * "Login" here simply proves the caller knows a seeded corporate email —
 * it exists purely so the app is runnable and demoable without an Azure
 * tenant.
 */

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
});

router.post("/dev-login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const employee = await prisma.employee.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!employee || employee.employmentStatus !== "ACTIVE") {
    return res.status(401).json({ error: "No active account found for that email" });
  }

  const token = signAppToken({
    sub: employee.id,
    employeeCode: employee.employeeCode,
    email: employee.email,
    name: employee.name,
    role: employee.role as Role,
  });

  await recordAudit({
    actorId: employee.id,
    action: "LOGIN",
    ipAddress: req.ip,
  });

  res.json({ token, employee: { id: employee.id, name: employee.name, email: employee.email, role: employee.role } });
});

// Lightweight directory so the dev-login screens can offer a picker instead
// of requiring the tester to know seeded emails.
router.get("/dev-directory", async (_req, res) => {
  const employees = await prisma.employee.findMany({
    where: { employmentStatus: "ACTIVE" },
    select: { email: true, name: true, role: true, jobTitle: true },
    orderBy: [{ role: "desc" }, { name: "asc" }],
    take: 50,
  });
  res.json({ employees });
});

export default router;
