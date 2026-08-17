import { Router } from "express";
import { authenticate } from "../auth/middleware";
import { ApiError } from "../middleware/errorHandler";
import { prisma } from "../db/prisma";
import { getEmployeeTrend, getOverview } from "../services/analytics.service";
import { daysAgo } from "../utils/timezone";

const router = Router();
router.use(authenticate);

function assertManagerAccess(req: import("express").Request, managerId: string) {
  const user = req.user!;
  if (user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN") return;
  if (user.role === "MANAGER" && user.id === managerId) return;
  throw new ApiError(403, "You do not have permission to view this team");
}

// GET /api/managers/:id/team — direct reports with current mood + 7-day
// trend, for the Manager Dashboard "Team Mood" table.
router.get("/:id/team", async (req, res, next) => {
  try {
    assertManagerAccess(req, req.params.id);

    const reports = await prisma.employee.findMany({
      where: { managerId: req.params.id, employmentStatus: "ACTIVE" },
      select: { id: true, name: true, employeeCode: true, jobTitle: true },
      orderBy: { name: "asc" },
    });

    const team = await Promise.all(
      reports.map(async (employee) => {
        const { trend, history } = await getEmployeeTrend(employee.id, 7);
        const latest = history[history.length - 1];
        return {
          employee,
          currentMood: latest?.mood ?? null,
          responseCount: history.length,
          sevenDayTrend: history.map((h) => ({ date: h.responseDate, mood: h.mood })),
          trendDirection: trend.direction,
          insights: trend.insights,
        };
      })
    );

    res.json({ team });
  } catch (err) {
    next(err);
  }
});

// GET /api/managers/:id/team-analytics — aggregate view of the whole team.
router.get("/:id/team-analytics", async (req, res, next) => {
  try {
    assertManagerAccess(req, req.params.id);
    const overview = await getOverview({ managerId: req.params.id, from: daysAgo(29) });
    res.json({ overview });
  } catch (err) {
    next(err);
  }
});

export default router;
