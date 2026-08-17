import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { env } from "../config/env";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Timezone is deliberately not hard-coded: it defaults to the org's
 * configured timezone (Asia/Kolkata initially) but every helper below
 * accepts an override so multi-region orgs can be supported later without
 * touching call sites.
 */

export function nowInTz(tz: string = env.appTimezone) {
  return dayjs().tz(tz);
}

/** Normalizes "now" (or a given instant) to a UTC-midnight Date representing the org-local calendar date — the value stored/matched in MoodResponse.responseDate. */
export function calendarDateKey(tz: string = env.appTimezone, at?: Date): Date {
  const local = at ? dayjs(at).tz(tz) : dayjs().tz(tz);
  return new Date(Date.UTC(local.year(), local.month(), local.date()));
}

export function isWithinWindow(startHHmm: string, endHHmm: string, tz: string = env.appTimezone): boolean {
  const local = nowInTz(tz);
  const [startH, startM] = startHHmm.split(":").map(Number);
  const [endH, endM] = endHHmm.split(":").map(Number);
  const minutesNow = local.hour() * 60 + local.minute();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  return minutesNow >= startMinutes && minutesNow <= endMinutes;
}

export function daysAgo(n: number, tz: string = env.appTimezone): Date {
  const local = nowInTz(tz).subtract(n, "day");
  return new Date(Date.UTC(local.year(), local.month(), local.date()));
}

export default dayjs;
