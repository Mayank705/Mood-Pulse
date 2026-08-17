import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { requirePermission } from "../rbac/authorize";
import { PERMISSIONS } from "../rbac/permissions";
import { validateBody } from "../middleware/validate";
import { getOrgSettings } from "../services/settings.service";
import { prisma } from "../db/prisma";
import { recordAudit } from "../services/audit.service";

const router = Router();
router.use(authenticate);

router.get("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (_req, res, next) => {
  try {
    const { settings } = await getOrgSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const updateSchema = z.object({
  checkinStartTime: z.string().regex(timeRegex).optional(),
  checkinEndTime: z.string().regex(timeRegex).optional(),
  mandatory: z.boolean().optional(),
  allowLateCheckins: z.boolean().optional(),
  promptDelaySeconds: z.number().int().min(0).max(3600).optional(),
  lowMoodThresholdCount: z.number().int().min(1).max(30).optional(),
  lowMoodWindowDays: z.number().int().min(1).max(90).optional(),
  decliningWindowDays: z.number().int().min(6).max(180).optional(),
  retentionDays: z.number().int().min(30).max(3650).optional(),
  timezone: z.string().optional(),
});

// Settings changes never touch historical MoodResponse rows — only future
// prompting behavior and future trend-window calculations, so past
// analytics are never silently rewritten (spec §21).
router.put("/", requirePermission(PERMISSIONS.SETTINGS_MANAGE), validateBody(updateSchema), async (req, res, next) => {
  try {
    const { settings } = await getOrgSettings();
    const updated = await prisma.setting.update({ where: { id: settings.id }, data: req.body });
    await recordAudit({ actorId: req.user!.id, action: "SETTINGS_CHANGE", targetType: "Setting", targetId: updated.id, metadata: { fields: Object.keys(req.body) }, ipAddress: req.ip });
    res.json({ settings: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
