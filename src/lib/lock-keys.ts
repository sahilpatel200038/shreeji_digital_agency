import { can, type Permission, type Role } from "@/lib/auth/permissions";

/** Edit-lock keys, validation and messages: pure code (no database) so client, server and unit tests can share it. See edit-lock.ts. */

/** One key per page or module; a form may hold several. */
export const lockKey = {
  page: (id: number) => `page:${id}`,
  post: (id: number) => `post:${id}`,
  service: (id: number) => `service:${id}`,
  project: (id: number) => `project:${id}`,
  team: (id: number) => `team:${id}`,
  testimonial: (id: number) => `testimonial:${id}`,
  faq: (id: number) => `faq:${id}`,
  user: (id: number) => `user:${id}`,
  menu: (key: string) => `menu:${key}`,
  setting: (group: string) => `setting:${group}`,
  chrome: (name: string) => `chrome:${name}`,
};

const KEY_PATTERN = /^[a-z][a-z-]{1,20}:[A-Za-z0-9_-]{1,80}$/;

/** Which permission a user needs before they may take a lock with this key prefix. */
const PERMISSION_BY_PREFIX: Record<string, Permission> = {
  page: "content:write",
  post: "content:write",
  service: "content:write",
  project: "content:write",
  team: "content:write",
  testimonial: "content:write",
  faq: "content:write",
  setting: "settings:write",
  chrome: "settings:write",
  menu: "menus:write",
  user: "users:manage",
};

const NOUN_BY_PREFIX: Record<string, string> = {
  page: "page",
  post: "post",
  service: "service",
  project: "project",
  team: "team member",
  testimonial: "testimonial",
  faq: "FAQ",
  setting: "settings section",
  chrome: "page",
  menu: "menu",
  user: "user",
};

export function isValidLockKey(key: unknown): key is string {
  return typeof key === "string" && key.length <= 120 && KEY_PATTERN.test(key) && key.split(":")[0] in PERMISSION_BY_PREFIX;
}

export function canLock(user: { role: Role }, key: string): boolean {
  const perm = PERMISSION_BY_PREFIX[key.split(":")[0]];
  return Boolean(perm) && can(user.role, perm);
}

const nounFor = (key: string) => NOUN_BY_PREFIX[key.split(":")[0]] ?? "page";

export function conflictMessage(key: string, holderName: string, sameUser: boolean) {
  const noun = nounFor(key);
  return sameUser
    ? `This ${noun} was opened for editing in another browser tab or window of yours, so this one is now read-only. Reload this page to edit here again.`
    : `This ${noun} is currently being edited by ${holderName}. Please wait until they finish or the editing lock is released.`;
}
