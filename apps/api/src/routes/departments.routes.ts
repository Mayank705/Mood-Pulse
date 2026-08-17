import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { validateBody } from "../middleware/validate";
import { prisma } from "../db/prisma";
import { getOverview } from "../services/analytics.service";
import { recordAudit } from "../services/audit.service";

const router = Router();
router.use(authenticate);

// GET /api/departments — full hierarchy tree, used to power the cascading
// Department -> Sub-department -> Manager -> Employee filter everywhere in
// the admin dashboard.
router.get("/", requirePermission(PERMISSIONS.ANALYTICS_VIEW_DEPARTMENT), async (_req, res, next) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        subDepartments: {
          include: {
            employees: {
              where: { role: { in: ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"] }, employmentStatus: "ACTIVE" },
              select: { id: true, name: true, employeeCode: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/analytics", requirePermission(PERMISSIONS.ANALYTICS_VIEW_DEPARTMENT), async (req, res, next) => {
  try {
    const overview = await getOverview({ departmentId: req.params.id });
    await recordAudit({ actorId: req.user!.id, action: "VIEW_EMPLOYEE_DATA", targetType: "DepartmentAnalytics", targetId: req.params.id, ipAddress: req.ip });
    res.json({ overview });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/sub-departments/:subId/analytics", requirePermission(PERMISSIONS.ANALYTICS_VIEW_DEPARTMENT), async (req, res, next) => {
  try {
    const overview = await getOverview({ subDepartmentId: req.params.subId });
    res.json({ overview });
  } catch (err) {
    next(err);
  }
});

const createDeptSchema = z.object({ name: z.string().min(1) });

router.post("/", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), validateBody(createDeptSchema), async (req, res, next) => {
  try {
    const org = await prisma.organization.findFirst();
    if (!org) return res.status(400).json({ error: "Organization not initialized" });
    const department = await prisma.department.create({ data: { name: req.body.name, organizationId: org.id } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Department", targetId: department.id, metadata: { op: "create" }, ipAddress: req.ip });
    res.status(201).json({ department });
  } catch (err) {
    next(err);
  }
});

const createSubDeptSchema = z.object({ name: z.string().min(1) });

router.post("/:id/sub-departments", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), validateBody(createSubDeptSchema), async (req, res, next) => {
  try {
    const subDepartment = await prisma.subDepartment.create({ data: { name: req.body.name, departmentId: req.params.id } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "SubDepartment", targetId: subDepartment.id, metadata: { op: "create" }, ipAddress: req.ip });
    res.status(201).json({ subDepartment });
  } catch (err) {
    next(err);
  }
});

export default router;
