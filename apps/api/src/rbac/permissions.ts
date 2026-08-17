import { Role } from "../types/enums";

export const PERMISSIONS = {
  MOOD_SUBMIT_OWN: "mood:submit_own",
  TEAM_VIEW: "team:view", // manager's own direct reports
  ANALYTICS_VIEW_ORG: "analytics:view_org",
  ANALYTICS_VIEW_DEPARTMENT: "analytics:view_department",
  EMPLOYEE_VIEW_DIRECTORY: "employee:view_directory",
  EMPLOYEE_VIEW_COMMENTS: "employee:view_comments",
  HIERARCHY_MANAGE: "hierarchy:manage",
  SETTINGS_MANAGE: "settings:manage",
  USERS_MANAGE: "users:manage",
  AUDIT_VIEW: "audit:view",
  REPORTS_EXPORT: "reports:export",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  EMPLOYEE: [PERMISSIONS.MOOD_SUBMIT_OWN],
  MANAGER: [PERMISSIONS.MOOD_SUBMIT_OWN, PERMISSIONS.TEAM_VIEW, PERMISSIONS.EMPLOYEE_VIEW_COMMENTS],
  HR_ADMIN: [
    PERMISSIONS.MOOD_SUBMIT_OWN,
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.ANALYTICS_VIEW_ORG,
    PERMISSIONS.ANALYTICS_VIEW_DEPARTMENT,
    PERMISSIONS.EMPLOYEE_VIEW_DIRECTORY,
    PERMISSIONS.EMPLOYEE_VIEW_COMMENTS,
    PERMISSIONS.HIERARCHY_MANAGE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  SUPER_ADMIN: Object.values(PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
