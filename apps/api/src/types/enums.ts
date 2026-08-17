import { z } from "zod";

// Kept as plain string unions (validated at the API boundary via zod) rather
// than Prisma enums, so the schema stays portable across SQLite/SQL
// Server/Postgres. See prisma/schema.prisma header comment.

export const ROLES = ["EMPLOYEE", "MANAGER", "HR_ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);

export const EMPLOYMENT_STATUSES = ["ACTIVE", "ON_LEAVE", "TERMINATED"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export const employmentStatusSchema = z.enum(EMPLOYMENT_STATUSES);

// Ordered from most positive to most negative — order matters for trend math.
export const MOOD_LEVELS = ["VERY_HAPPY", "GOOD", "OKAY", "NOT_GREAT", "VERY_LOW"] as const;
export type MoodLevel = (typeof MOOD_LEVELS)[number];
export const moodLevelSchema = z.enum(MOOD_LEVELS);

// Internal-only numeric mapping. Never sent to, or accepted from, the
// employee-facing check-in UI.
export const MOOD_VALUE: Record<MoodLevel, number> = {
  VERY_HAPPY: 5,
  GOOD: 4,
  OKAY: 3,
  NOT_GREAT: 2,
  VERY_LOW: 1,
};

export const MOOD_EMOJI: Record<MoodLevel, string> = {
  VERY_HAPPY: "😄",
  GOOD: "🙂",
  OKAY: "😐",
  NOT_GREAT: "😟",
  VERY_LOW: "😢",
};

export const MOOD_LABEL: Record<MoodLevel, string> = {
  VERY_HAPPY: "Very Happy",
  GOOD: "Good",
  OKAY: "Okay",
  NOT_GREAT: "Not Great",
  VERY_LOW: "Very Low",
};

export const AUDIT_ACTIONS = [
  "LOGIN",
  "MOOD_SUBMIT",
  "VIEW_EMPLOYEE_DATA",
  "EXPORT",
  "PERMISSION_CHANGE",
  "HIERARCHY_CHANGE",
  "SETTINGS_CHANGE",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
