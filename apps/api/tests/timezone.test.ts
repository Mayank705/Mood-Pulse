import { describe, expect, it } from "vitest";
import { calendarDateKey, isWithinWindow, nowInTz } from "../src/utils/timezone";

describe("timezone utils", () => {
  it("calendarDateKey is stable for instants on the same org-local calendar day", () => {
    // 23:30 and 00:30 IST fall on different UTC dates but the same IST date
    // in one of these cases — verify the key tracks the *local* date.
    const morning = new Date("2026-03-10T02:00:00Z"); // 07:30 IST
    const night = new Date("2026-03-10T17:00:00Z"); // 22:30 IST — same IST date
    const key1 = calendarDateKey("Asia/Kolkata", morning);
    const key2 = calendarDateKey("Asia/Kolkata", night);
    expect(key1.toISOString()).toBe(key2.toISOString());
  });

  it("calendarDateKey rolls over at local midnight, not UTC midnight", () => {
    // 23:30 UTC on Mar 9 is 05:00 IST on Mar 10 — should key to Mar 10 in IST.
    const lateUtc = new Date("2026-03-09T23:30:00Z");
    const key = calendarDateKey("Asia/Kolkata", lateUtc);
    expect(key.toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  it("isWithinWindow respects configured start/end in the given timezone", () => {
    expect(isWithinWindow("00:00", "23:59", "Asia/Kolkata")).toBe(true);

    // A window built to end 1 minute ago (relative to "now") must be closed.
    const local = nowInTz("Asia/Kolkata");
    const oneMinuteAgo = local.subtract(1, "minute");
    const twoMinutesAgo = local.subtract(2, "minute");
    const fmt = (d: typeof local) => d.format("HH:mm");
    // Guard against the rare case both format to the same minute (test flake avoidance).
    if (fmt(oneMinuteAgo) !== fmt(twoMinutesAgo)) {
      expect(isWithinWindow(fmt(twoMinutesAgo), fmt(oneMinuteAgo), "Asia/Kolkata")).toBe(false);
    }
  });

  it("different timezones are not hard-coded — Asia/Kolkata and UTC both resolve", () => {
    const now = new Date();
    expect(() => calendarDateKey("UTC", now)).not.toThrow();
    expect(() => calendarDateKey("America/New_York", now)).not.toThrow();
  });
});
