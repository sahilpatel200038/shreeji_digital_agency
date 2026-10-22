export type Role = "SUPER_ADMIN" | "ADMIN" | "EDITOR";

export const PERMISSIONS = [
  "content:write",
  "content:delete",
  "system-page:delete",
  "media:write",
  "media:delete",
  "menus:write",
  "leads:read",
  "leads:export",
  "leads:delete",
  "redirects:write",
  "settings:write",
  "settings:scripts",
  "users:manage",
  "audit:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  SUPER_ADMIN: new Set(PERMISSIONS),
  ADMIN: new Set<Permission>([
    "content:write",
    "content:delete",
    "media:write",
    "media:delete",
    "menus:write",
    "leads:read",
    "leads:export",
    "redirects:write",
    "settings:write",
    "audit:read",
  ]),
  EDITOR: new Set<Permission>(["content:write", "media:write"]),
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  EDITOR: "Editor",
};
