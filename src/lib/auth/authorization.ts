export type Role = "CASEWORKER" | "REVIEWER" | "ADMIN";

const permissions = {
  CASEWORKER: ["case:read", "case:write", "document:write", "packet:generate", "application:sign", "application:deliver"],
  REVIEWER: ["case:read", "packet:review", "packet:approve"],
  ADMIN: ["case:read", "program:write", "template:write", "submission:configure", "user:read", "user:manage"],
} as const;

export type Permission = (typeof permissions)[Role][number];

export function hasPermission(role: string, permission: string) {
  return role in permissions && (permissions[role as Role] as readonly string[]).includes(permission);
}

export function canAccessRole(role: string, allowed: Role[]) {
  return allowed.includes(role as Role);
}
