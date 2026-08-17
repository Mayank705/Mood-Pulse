export type Role = "EMPLOYEE" | "MANAGER" | "HR_ADMIN" | "SUPER_ADMIN";

// "MANAGER" stays the stored/API role value everywhere (RBAC, imports,
// role-change endpoint) — this is purely the org's own vocabulary for it,
// shown wherever a role reaches the screen.
export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "SuperCoach",
  HR_ADMIN: "HR / Admin",
  SUPER_ADMIN: "Super Admin",
};

export type MoodLevel = "VERY_HAPPY" | "GOOD" | "OKAY" | "NOT_GREAT" | "VERY_LOW";

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

export interface AuthUser {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  departmentId: string;
  subDepartmentId: string;
}

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  jobTitle: string;
  employmentStatus: string;
  role: Role;
  dateJoined: string;
  department: { id: string; name: string };
  subDepartment: { id: string; name: string };
  // "manager" = SuperCoach (direct manager), "manager.manager" = Co-SuperCoach
  // (skip-level manager) — always derived from the same reporting chain.
  manager: { id: string; name: string; employeeCode: string; manager: { id: string; name: string; employeeCode: string } | null } | null;
}

export interface SubDepartmentNode {
  id: string;
  name: string;
  employees: { id: string; name: string; employeeCode: string }[]; // managers in this sub-dept
}

export interface DepartmentNode {
  id: string;
  name: string;
  subDepartments: SubDepartmentNode[];
}

export interface OverviewResult {
  totalEmployees: number;
  responsesToday: number;
  responseRate: number;
  positiveResponses: number;
  neutralResponses: number;
  lowResponses: number;
  employeesRequiringAttention: number;
  averageMoodValue: number | null;
  dailyTrend: { date: string; averageMoodValue: number | null; responseCount: number }[];
}

export interface TrendInsight {
  code: "REPEATED_LOW" | "DECLINING_TREND" | "SUDDEN_CHANGE";
  message: string;
}

export interface EmployeeTrend {
  direction: "improving" | "stable" | "declining" | "insufficient_data";
  averageMoodValue: number | null;
  responseCount: number;
  insights: TrendInsight[];
}

export interface MoodHistoryEntry {
  responseDate: string;
  mood: MoodLevel;
  moodValue: number;
  comment?: string;
}

export interface FlaggedEmployee {
  employee: {
    id: string;
    name: string;
    employeeCode: string;
    jobTitle: string;
    department: { name: string };
    manager: { name: string } | null;
  };
  trend: EmployeeTrend;
}

export interface TeamMember {
  employee: { id: string; name: string; employeeCode: string; jobTitle: string };
  currentMood: MoodLevel | null;
  responseCount: number;
  sevenDayTrend: { date: string; mood: MoodLevel }[];
  trendDirection: EmployeeTrend["direction"];
  insights: TrendInsight[];
}

export interface Settings {
  id: string;
  checkinStartTime: string;
  checkinEndTime: string;
  mandatory: boolean;
  allowLateCheckins: boolean;
  promptDelaySeconds: number;
  lowMoodThresholdCount: number;
  lowMoodWindowDays: number;
  decliningWindowDays: number;
  retentionDays: number;
  timezone: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: { name: string; employeeCode: string } | null;
}

export interface HierarchyFilterValue {
  departmentId?: string;
  subDepartmentId?: string;
  managerId?: string;
  employeeId?: string;
}

export interface RowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}

export interface SharePointFileRef {
  siteHostname: string;
  sitePath: string;
  filePath: string;
}
