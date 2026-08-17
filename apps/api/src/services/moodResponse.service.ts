import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { calendarDateKey, isWithinWindow } from "../utils/timezone";
import { MOOD_VALUE, MoodLevel } from "../types/enums";
import { ApiError } from "../middleware/errorHandler";
import { getOrgSettings } from "./settings.service";

export async function getTodayStatus(employeeId: string) {
  const { settings } = await getOrgSettings();
  const today = calendarDateKey(settings.timezone);

  const existing = await prisma.moodResponse.findUnique({
    where: { employeeId_responseDate: { employeeId, responseDate: today } },
  });

  const withinWindow = isWithinWindow(settings.checkinStartTime, settings.checkinEndTime, settings.timezone);
  const shouldPrompt =
    !existing && settings.mandatory !== undefined && (withinWindow || settings.allowLateCheckins);

  return {
    alreadySubmitted: Boolean(existing),
    submittedAt: existing?.responseTime ?? null,
    withinWindow,
    allowLateCheckins: settings.allowLateCheckins,
    shouldPrompt,
    promptDelaySeconds: settings.promptDelaySeconds,
    checkinStartTime: settings.checkinStartTime,
    checkinEndTime: settings.checkinEndTime,
  };
}

interface SubmitMoodInput {
  employeeId: string;
  mood: MoodLevel;
  comment?: string;
}

export async function submitMood({ employeeId, mood, comment }: SubmitMoodInput) {
  const { settings } = await getOrgSettings();
  const withinWindow = isWithinWindow(settings.checkinStartTime, settings.checkinEndTime, settings.timezone);

  if (!withinWindow && !settings.allowLateCheckins) {
    throw new ApiError(403, "Today's check-in window has closed");
  }

  const today = calendarDateKey(settings.timezone);

  try {
    const response = await prisma.moodResponse.create({
      data: {
        employeeId,
        mood,
        moodValue: MOOD_VALUE[mood],
        comment: comment?.trim() ? comment.trim().slice(0, 500) : null,
        responseDate: today,
        responseTime: new Date(),
      },
    });
    return response;
  } catch (err) {
    // The unique(employeeId, responseDate) DB constraint is the ultimate
    // guard against duplicate submissions (e.g. a double-click or retried
    // network request racing this same check) — translate it into a clean
    // 409 rather than a raw Prisma error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "A response has already been recorded for today");
    }
    throw err;
  }
}
