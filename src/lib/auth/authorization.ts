export type Role = "CASEWORKER" | "REVIEWER" | "SUPERVISOR" | "AUDITOR" | "SUPPORT_READ_ONLY" | "ADMIN";

const permissions = {
  CASEWORKER: ["case:read", "case:write", "document:write", "packet:generate", "application:sign", "application:deliver"],
  REVIEWER: ["case:read", "packet:review", "packet:approve"],
  SUPERVISOR: ["case:read", "packet:review", "packet:approve", "packet:escalation", "user:read"],
  AUDITOR: ["case:read", "audit:read", "export:read"],
  SUPPORT_READ_ONLY: ["system:read"],
  ADMIN: ["case:read", "audit:read", "program:write", "template:write", "submission:configure", "user:read", "user:manage", "lifecycle:manage"],
} as const;

export type Permission = (typeof permissions)[Role][number];

export function hasPermission(role: string, permission: string) {
  return role in permissions && (permissions[role as Role] as readonly string[]).includes(permission);
}

export function canAccessRole(role: string, allowed: Role[]) {
  return allowed.includes(role as Role);
}
