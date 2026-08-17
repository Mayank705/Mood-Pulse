import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { prisma } from "../db/prisma";
import { moodDisplay, rowsToCsv, rowsToExcelBuffer, rowsToPdfBuffer, ReportRow } from "../services/report.service";
import { daysAgo } from "../utils/timezone";
import { recordAudit } from "../services/audit.service";

const router = Router();
router.use(authenticate);

const reportQuery = z.object({
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  managerId: z.string().optional(),
  includeComments: z.coerce.boolean().default(false),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

// GET /api/reports/mood — role-scoped export. HR_ADMIN/SUPER_ADMIN only
// (REPORTS_EXPORT); comments are included only when explicitly requested
// AND the caller can see comments at all.
router.get("/mood", requirePermission(PERMISSIONS.REPORTS_EXPORT), async (req, res, next) => {
  try {
    const query = reportQuery.parse(req.query);
    const since = daysAgo(query.days);

    const responses = await prisma.moodResponse.findMany({
      where: {
        responseDate: { gte: since },
        employee: {
          ...(query.departmentId ? { departmentId: query.departmentId } : {}),
          ...(query.subDepartmentId ? { subDepartmentId: query.subDepartmentId } : {}),
          ...(query.managerId ? { managerId: query.managerId } : {}),
        },
      },
      include: {
        employee: {
          select: { name: true, employeeCode: true, department: { select: { name: true } }, subDepartment: { select: { name: true } }, manager: { select: { name: true } } },
        },
      },
      orderBy: { responseDate: "desc" },
      take: 20000,
    });

    const rows: ReportRow[] = responses.map((r) => ({
      employeeName: r.employee.name,
      employeeCode: r.employee.employeeCode,
      department: r.employee.department.name,
      subDepartment: r.employee.subDepartment.name,
      manager: r.employee.manager?.name ?? "—",
      date: r.responseDate.toISOString().slice(0, 10),
      mood: moodDisplay(r.mood),
      comment: query.includeComments ? r.comment ?? "" : "",
    }));

    await recordAudit({ actorId: req.user!.id, action: "EXPORT", targetType: "MoodReport", metadata: { format: query.format, rows: rows.length }, ipAddress: req.ip });

    if (query.format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=mood-report.csv");
      return res.send(rowsToCsv(rows));
    }
    if (query.format === "xlsx") {
      const buffer = await rowsToExcelBuffer(rows);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=mood-report.xlsx");
      return res.send(buffer);
    }
    const buffer = await rowsToPdfBuffer(rows, "Daily Pulse — Mood Report");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=mood-report.pdf");
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

export default router;
