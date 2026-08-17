import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission, canAccessEmployee, resolveManagedEmployeeIds } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { validateBody, validateQuery } from "../middleware/validate";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { employmentStatusSchema, roleSchema } from "../types/enums";
import { getEmployeeTrend } from "../services/analytics.service";
import { recordAudit } from "../services/audit.service";

const router = Router();
router.use(authenticate);

const employeeSelect = {
  id: true,
  employeeCode: true,
  name: true,
  email: true,
  jobTitle: true,
  employmentStatus: true,
  role: true,
  dateJoined: true,
  department: { select: { id: true, name: true } },
  subDepartment: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true, employeeCode: true } },
} as const;

const directoryQuery = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  managerId: z.string().optional(),
  search: z.string().optional(),
});

// GET /api/employees — org directory. HR/Admin see everyone; a Manager sees
// only their reporting subtree (server-enforced, not just hidden in the UI).
router.get("/", async (req, res, next) => {
  try {
    const query = directoryQuery.parse(req.query);
    const user = req.user!;

    let scopeWhere: Record<string, unknown> = {};
    if (user.role === "MANAGER") {
      const managed = await resolveManagedEmployeeIds(user.id);
      scopeWhere = { id: { in: Array.from(managed) } };
    } else if (user.role !== "HR_ADMIN" && user.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "You do not have permission to view the employee directory");
    }

    const employees = await prisma.employee.findMany({
      where: {
        employmentStatus: "ACTIVE",
        ...scopeWhere,
        ...(query.departmentId ? { departmentId: query.departmentId } : {}),
        ...(query.subDepartmentId ? { subDepartmentId: query.subDepartmentId } : {}),
        ...(query.managerId ? { managerId: query.managerId } : {}),
        ...(query.search
          ? { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }, { employeeCode: { contains: query.search } }] }
          : {}),
      },
      select: employeeSelect,
      orderBy: { name: "asc" },
      take: 500,
    });
    res.json({ employees });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!(await canAccessEmployee(req, req.params.id))) {
      throw new ApiError(403, "You do not have permission to view this employee");
    }
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id }, select: employeeSelect });
    if (!employee) throw new ApiError(404, "Employee not found");

    await recordAudit({ actorId: req.user!.id, action: "VIEW_EMPLOYEE_DATA", targetType: "Employee", targetId: employee.id, ipAddress: req.ip });
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

const historyQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// GET /api/employees/:id/mood-history — trend + per-day history. Comments
// are stripped unless the caller holds EMPLOYEE_VIEW_COMMENTS, so a manager
// without comment access still sees mood/trend but not free-text content.
router.get("/:id/mood-history", async (req, res, next) => {
  try {
    if (!(await canAccessEmployee(req, req.params.id))) {
      throw new ApiError(403, "You do not have permission to view this employee's history");
    }
    const { days } = historyQuery.parse(req.query);
    const { trend, history } = await getEmployeeTrend(req.params.id, days);

    const user = req.user!;
    const canSeeComments = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN" || (user.role === "MANAGER" && (await canAccessEmployee(req, req.params.id)));

    await recordAudit({ actorId: user.id, action: "VIEW_EMPLOYEE_DATA", targetType: "MoodHistory", targetId: req.params.id, ipAddress: req.ip });

    res.json({
      trend,
      history: history.map((h) => ({
        responseDate: h.responseDate,
        mood: h.mood,
        moodValue: h.moodValue,
        comment: canSeeComments ? h.comment : undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const createEmployeeSchema = z.object({
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  departmentId: z.string(),
  subDepartmentId: z.string(),
  managerId: z.string().optional(),
  jobTitle: z.string().min(1),
  role: roleSchema.default("EMPLOYEE"),
  employmentStatus: employmentStatusSchema.default("ACTIVE"),
  dateJoined: z.coerce.date(),
});

// Employee hierarchy is synchronized from an HR master system in
// production (see docs/ARCHITECTURE.md §Sync). This endpoint is what that
// sync job — or an HR admin doing manual onboarding — calls.
router.post("/", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), validateBody(createEmployeeSchema), async (req, res, next) => {
  try {
    const employee = await prisma.employee.create({ data: req.body, select: employeeSelect });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Employee", targetId: employee.id, metadata: { op: "create" }, ipAddress: req.ip });
    res.status(201).json({ employee });
  } catch (err) {
    next(err);
  }
});

const updateEmployeeSchema = createEmployeeSchema.partial();

router.put("/:id", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), validateBody(updateEmployeeSchema), async (req, res, next) => {
  try {
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data: req.body, select: employeeSelect });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Employee", targetId: employee.id, metadata: { op: "update", fields: Object.keys(req.body) }, ipAddress: req.ip });
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

const roleUpdateSchema = z.object({ role: roleSchema });

router.patch("/:id/role", requirePermission(PERMISSIONS.USERS_MANAGE), validateBody(roleUpdateSchema), async (req, res, next) => {
  try {
    const employee = await prisma.employee.update({ where: { id: req.params.id }, data: { role: req.body.role }, select: employeeSelect });
    await recordAudit({ actorId: req.user!.id, action: "PERMISSION_CHANGE", targetType: "Employee", targetId: employee.id, metadata: { newRole: req.body.role }, ipAddress: req.ip });
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

export default router;
