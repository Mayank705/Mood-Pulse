import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { validateBody } from "../middleware/validate";
import { prisma } from "../db/prisma";
import { ApiError } from "../middleware/errorHandler";
import { getOverview } from "../services/analytics.service";
import { recordAudit } from "../services/audit.service";
import { uploadWorkbook } from "../middleware/upload";
import { departmentsTemplateBuffer, importDepartmentsFromBuffer } from "../services/importExport.service";
import { syncDepartmentsFromSharePoint } from "../services/sharepointSync.service";

const router = Router();
router.use(authenticate);

async function requireOrganization() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new ApiError(400, "Organization not initialized");
  return org;
}

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
    const org = await requireOrganization();
    const department = await prisma.department.create({ data: { name: req.body.name, organizationId: org.id } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Department", targetId: department.id, metadata: { op: "create" }, ipAddress: req.ip });
    res.status(201).json({ department });
  } catch (err) {
    next(err);
  }
});

const renameSchema = z.object({ name: z.string().min(1) });

router.patch("/:id", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), validateBody(renameSchema), async (req, res, next) => {
  try {
    const department = await prisma.department.update({ where: { id: req.params.id }, data: { name: req.body.name } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Department", targetId: department.id, metadata: { op: "rename" }, ipAddress: req.ip });
    res.json({ department });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (req, res, next) => {
  try {
    const [subDeptCount, employeeCount] = await Promise.all([
      prisma.subDepartment.count({ where: { departmentId: req.params.id } }),
      prisma.employee.count({ where: { departmentId: req.params.id } }),
    ]);
    if (subDeptCount > 0 || employeeCount > 0) {
      throw new ApiError(409, "This department still has sub-departments or employees — move or remove those first");
    }
    await prisma.department.delete({ where: { id: req.params.id } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "Department", targetId: req.params.id, metadata: { op: "delete" }, ipAddress: req.ip });
    res.status(204).end();
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

router.patch(
  "/:id/sub-departments/:subId",
  requirePermission(PERMISSIONS.HIERARCHY_MANAGE),
  validateBody(renameSchema),
  async (req, res, next) => {
    try {
      const subDepartment = await prisma.subDepartment.update({ where: { id: req.params.subId }, data: { name: req.body.name } });
      await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "SubDepartment", targetId: subDepartment.id, metadata: { op: "rename" }, ipAddress: req.ip });
      res.json({ subDepartment });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/:id/sub-departments/:subId", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (req, res, next) => {
  try {
    const employeeCount = await prisma.employee.count({ where: { subDepartmentId: req.params.subId } });
    if (employeeCount > 0) {
      throw new ApiError(409, "This sub-department still has employees — move or remove them first");
    }
    await prisma.subDepartment.delete({ where: { id: req.params.subId } });
    await recordAudit({ actorId: req.user!.id, action: "HIERARCHY_CHANGE", targetType: "SubDepartment", targetId: req.params.subId, metadata: { op: "delete" }, ipAddress: req.ip });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/departments/import/template — downloadable .xlsx starter file
// with the exact column headers the importer expects.
router.get("/import/template", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), async (_req, res, next) => {
  try {
    const buffer = await departmentsTemplateBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=departments-template.xlsx");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/departments/import — bulk-create/update departments and
// sub-departments from an uploaded .xlsx file. Safe to re-run: existing
// department/sub-department names are left as-is (upsert), never duplicated.
router.post("/import", requirePermission(PERMISSIONS.HIERARCHY_MANAGE), (req, res, next) => {
  uploadWorkbook(req, res, async (err) => {
    if (err) return next(new ApiError(400, err.message));
    try {
      if (!req.file) throw new ApiError(400, "No file uploaded — attach an .xlsx file as 'file'");
      const org = await requireOrganization();
      const summary = await importDepartmentsFromBuffer(req.file.buffer, org.id);
      await recordAudit({
        actorId: req.user!.id,
        action: "HIERARCHY_CHANGE",
        targetType: "Department",
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

// POST /api/departments/import/sharepoint — same import logic as /import,
// sourced from a workbook stored in SharePoint instead of an upload. See
// docs/DEPLOYMENT.md for the Entra ID app registration this requires.
router.post(
  "/import/sharepoint",
  requirePermission(PERMISSIONS.HIERARCHY_MANAGE),
  validateBody(sharePointImportSchema),
  async (req, res, next) => {
    try {
      const org = await requireOrganization();
      const summary = await syncDepartmentsFromSharePoint(req.body, org.id);
      await recordAudit({
        actorId: req.user!.id,
        action: "HIERARCHY_CHANGE",
        targetType: "Department",
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
