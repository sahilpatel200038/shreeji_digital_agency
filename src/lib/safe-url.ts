const CONTROL_OR_SPACE = /[\u0000- \u007f]/;

/** Hrefs allowed in CMS content and menus: internal paths, anchors, https, mailto, tel. */
export function isSafeHref(value: string): boolean {
  const v = value.trim();
  if (!v || CONTROL_OR_SPACE.test(v)) return false;
  if (v.startsWith("//") || v.startsWith("/\\")) return false;
  if (v.startsWith("/") || v.startsWith("#")) return true;
  try {
    return ["https:", "mailto:", "tel:"].includes(new URL(v).protocol);
  } catch {
    return false;
  }
}

/** Redirect targets: internal absolute path, or https URL. */
export function isSafeRedirectTarget(value: string): boolean {
  const v = value.trim();
  if (!v || CONTROL_OR_SPACE.test(v)) return false;
  if (v.startsWith("//") || v.startsWith("/\\")) return false;
  if (v.startsWith("/")) return true;
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/** Only allow post-login redirects to admin routes. */
export function safeAdminNext(value: string | null | undefined): string {
  if (!value) return "/admin";
  const isAdminPath = value === "/admin" || value.startsWith("/admin/") || value.startsWith("/admin?");
  if (!isAdminPath || value.includes("\\")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

export function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export function normalizePath(path: string): string {
  const [p] = path.split(/[?#]/);
  const cleaned = p.replace(/\/+$/, "") || "/";
  return cleaned.toLowerCase();
}
