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
import { uploadWorkbook } from "../middleware/upload";
import { employeesExportBuffer, employeesTemplateBuffer, importEmployeesFromBuffer } from "../services/importExport.service";
import { syncEmployeesFromSharePoint } from "../services/sharepointSync.service";

const router = Router();
router.use(authenticate);

async function requireOrganization() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new ApiError(400, "Organization not initialized");
  return org;
}

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
  // "manager.manager" is the skip-level manager — surfaced in the UI as
  // "Co-SuperCoach" alongside "manager" as "SuperCoach". There is no
  // separate stored field for this: it's always derived from the same
  // managerId chain, so it can never drift out of sync with the org chart.
  manager: { select: { id: true, name: true, employeeCode: true, manager: { select: { id: true, name: true, employeeCode: true } } } },
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

// GET /api/employees/export — every current employee, in the same column
// shape as the import template. Download, edit (BU, Competency,
// SuperCoach Email, title, role, even Employment Status), re-upload
// through /import to apply the changes — rows are matched back by
// Employee ID so this updates in place. Registered before "/:id" below:
// as a literal single-segment route it would otherwise be shadowed by
// that dynamic one.
router.get("/export", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (_req, res, next) => {
  try {
    const buffer = await employeesExportBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=employees-current.xlsx");
    res.send(buffer);
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

// DELETE /api/employees/:id — a soft delete (employmentStatus -> TERMINATED),
// never a hard delete. Historical MoodResponse rows stay intact and keep
// contributing to past trend/analytics data; the employee simply stops
// being check-in-eligible and drops out of active-employee views.
router.delete("/:id", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (req, res, next) => {
  try {
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: { employmentStatus: "TERMINATED" },
      select: employeeSelect,
    });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Employee", targetId: employee.id, metadata: { op: "deactivate" }, ipAddress: req.ip });
    res.json({ employee });
  } catch (err) {
    next(err);
  }
});

// GET /api/employees/import/template — downloadable .xlsx starter file.
router.get("/import/template", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (_req, res, next) => {
  try {
    const buffer = await employeesTemplateBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=employees-template.xlsx");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/employees/import — bulk-create/update employees from an
// uploaded .xlsx file. Missing departments/sub-departments referenced by
// name are created automatically; manager relationships are resolved by
// email in a second pass, so row order in the spreadsheet doesn't matter.
router.post("/import", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), (req, res, next) => {
  uploadWorkbook(req, res, async (err) => {
    if (err) return next(new ApiError(400, err.message));
    try {
      if (!req.file) throw new ApiError(400, "No file uploaded — attach an .xlsx file as 'file'");
      const org = await requireOrganization();
      const summary = await importEmployeesFromBuffer(req.file.buffer, org.id);
      await recordAudit({
        actorId: req.user!.id,
        action: "HIERARCHY_CHANGE",
        targetType: "Employee",
        metadata: { op: "import", ...summary, errors: undefined },
        ipAddress: req.ip,
      });
      res.json({ summary });
    } catch (e) {
      next(e);
    }
  });
});

const sharePointImportSchema = z.object({
  siteHostname: z.string().min(1),
  sitePath: z.string().min(1),
  filePath: z.string().min(1),
});

// POST /api/employees/import/sharepoint — same import logic as /import,
// sourced from a workbook stored in SharePoint. See docs/DEPLOYMENT.md for
// the Entra ID app registration and Graph API permissions this requires.
router.post(
  "/import/sharepoint",
  requirePermission(PERMISSIONS.HIERARCHY_MANAGE),
  validateBody(sharePointImportSchema),
  async (req, res, next) => {
    try {
      const org = await requireOrganization();
      const summary = await syncEmployeesFromSharePoint(req.body, org.id);
      await recordAudit({
        actorId: req.user!.id,
        action: "HIERARCHY_CHANGE",
        targetType: "Employee",
        metadata: { op: "sharepoint_sync", ...summary, errors: undefined },
        ipAddress: req.ip,
      });
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
