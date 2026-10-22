/** Pure helpers for activity logs (no database access, so they are unit-testable). */

export const ACTION_TYPES = ["CREATE", "UPDATE", "DELETE", "PUBLISH", "UNPUBLISH", "LOGIN", "LOGOUT", "LOGIN_FAILED", "EXPORT", "OTHER"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_LABELS: Record<ActionType, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  PUBLISH: "Publish",
  UNPUBLISH: "Unpublish",
  LOGIN: "Login",
  LOGOUT: "Logout",
  LOGIN_FAILED: "Failed login",
  EXPORT: "Export",
  OTHER: "Other",
};

const MODULES: Record<string, string> = {
  page: "Pages",
  post: "Blog posts",
  "post-category": "Blog posts",
  service: "Services",
  project: "Projects",
  testimonial: "Testimonials",
  faq: "FAQs",
  team: "Team",
  media: "Media",
  menu: "Menus",
  setting: "Settings",
  "site-page": "Site pages",
  redirect: "Redirects",
  lead: "Leads",
  user: "Users",
};

/** The fixed list of modules, for the filter drop-down. */
export const MODULE_NAMES = [...new Set(Object.values(MODULES))].sort();

export function moduleFor(entityType: string): string {
  return MODULES[entityType] ?? entityType;
}

/** "page.update" -> UPDATE, "login" -> LOGIN, "media.upload" -> CREATE. */
export function actionTypeFor(action: string): ActionType {
  if (action === "login") return "LOGIN";
  if (action === "logout") return "LOGOUT";
  if (action === "login.failed") return "LOGIN_FAILED";
  const verb = action.split(".").pop() ?? "";
  if (verb === "create" || verb === "upload") return "CREATE";
  if (verb === "delete") return "DELETE";
  if (verb === "publish") return "PUBLISH";
  if (verb === "unpublish") return "UNPUBLISH";
  if (verb === "export") return "EXPORT";
  return action.includes(".") ? "UPDATE" : "OTHER";
}

const SENSITIVE_KEY = /pass(word)?|secret|token|hash|authorization|cookie|api[-_]?key/i;
const MAX_VALUE_LENGTH = 300;
const MAX_KEYS = 40;

function clean(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 3) return "[nested]";
  if (Array.isArray(value)) return value.length > 20 ? `[${value.length} items]` : value.map((v) => clean(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : clean(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Makes a value safe to store: sensitive keys redacted, long text and deep nesting trimmed. */
export function sanitizeValues(values: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!values) return null;
  const out = clean(values) as Record<string, unknown>;
  return Object.keys(out).length ? out : null;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
}

/** Keeps only the fields that changed, as { before, after }. Returns null when nothing changed. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys?: readonly string[],
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of keys ?? Object.keys(after)) {
    if (!same(before[k], after[k])) {
      b[k] = before[k] ?? null;
      a[k] = after[k] ?? null;
    }
  }
  return Object.keys(a).length ? { before: b, after: a } : null;
}
