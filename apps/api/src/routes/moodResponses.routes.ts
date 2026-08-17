import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../auth/middleware";
import { validateBody } from "../middleware/validate";
import { moodLevelSchema } from "../types/enums";
import { getTodayStatus, submitMood } from "../services/moodResponse.service";
import { recordAudit } from "../services/audit.service";

const router = Router();
router.use(authenticate);

// GET /api/mood-responses/today — whether the check-in should be shown, and
// whether one was already submitted. This is the only "history" an
// employee's own client is allowed to query for themselves.
router.get("/today", async (req, res, next) => {
  try {
    const status = await getTodayStatus(req.user!.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

const submitSchema = z.object({
  mood: moodLevelSchema,
  comment: z.string().max(500).optional(),
});

// POST /api/mood-responses — an employee submits their own check-in only.
// There is no employeeId in the body: identity comes solely from the
// authenticated token, so nobody can submit on another employee's behalf.
router.post("/", validateBody(submitSchema), async (req, res, next) => {
  try {
    const response = await submitMood({ employeeId: req.user!.id, mood: req.body.mood, comment: req.body.comment });
    await recordAudit({ actorId: req.user!.id, action: "MOOD_SUBMIT", targetType: "MoodResponse", targetId: response.id, ipAddress: req.ip });
    res.status(201).json({ ok: true, submittedAt: response.responseTime });
  } catch (err) {
    next(err);
  }
});

export default router;
