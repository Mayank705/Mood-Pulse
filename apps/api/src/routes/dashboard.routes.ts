import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { getFlaggedEmployees, getOverview } from "../services/analytics.service";

const router = Router();
router.use(authenticate);

const overviewQuery = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  managerId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// GET /api/dashboard/overview — the org-wide (or filtered) summary cards +
// daily trend chart data that drives the top of the HR/Admin dashboard.
router.get("/overview", requirePermission(PERMISSIONS.ANALYTICS_VIEW_ORG), async (req, res, next) => {
  try {
    const filter = overviewQuery.parse(req.query);
    const overview = await getOverview(filter);
    res.json({ overview });
  } catch (err) {
    next(err);
  }
});

router.get("/flagged-employees", requirePermission(PERMISSIONS.ANALYTICS_VIEW_ORG), async (req, res, next) => {
  try {
    const filter = overviewQuery.parse(req.query);
    const flagged = await getFlaggedEmployees(filter);
    res.json({ flagged });
  } catch (err) {
    next(err);
  }
});

export default router;
