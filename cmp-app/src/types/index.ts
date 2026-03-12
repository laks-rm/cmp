export const PERMISSION_MODULES = [
  "DASHBOARD",
  "SOURCES",
  "TASKS",
  "TASK_EXECUTION",
  "REVIEW_QUEUE",
  "FINDINGS",
  "REPORTS",
  "AUDIT_LOG",
  "USER_MANAGEMENT",
  "ROLE_MANAGEMENT",
  "ENTITY_CONFIG",
  "TEAM_CONFIG",
  "WORKFLOW_CONFIG",
  "NOTIFICATION_CONFIG",
] as const;

export const PERMISSION_ACTIONS = ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "EXPORT", "ADMIN_CONFIG"] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  initials: string;
  roleId: string;
  roleName: string;
  entityIds: string[];
  teamIds: string[];
};
