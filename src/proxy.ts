import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normalizePath } from "@/lib/safe-url";

const SESSION_COOKIE = "shreeji_session";
const CACHE_MS = 30_000;

type Rule = { to: string; status: number; id: number };
let cache: { at: number; rules: Map<string, Rule> } | null = null;

/** Redirect table, cached in-process (takes effect within ~30s of an admin change). */
async function getRules(): Promise<Map<string, Rule>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rules;
  try {
    const rows = await db.redirect.findMany({ where: { isActive: true } });
    cache = { at: Date.now(), rules: new Map(rows.map((r) => [r.fromPath, { to: r.toPath, status: r.statusCode, id: r.id }])) };
  } catch {
    // DB unavailable: keep serving the site without redirects rather than failing every request.
    cache = { at: Date.now() - CACHE_MS + 5_000, rules: cache?.rules ?? new Map() };
  }
  return cache.rules;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // Optimistic gate only. Real authorisation happens server-side in every page and action.
    if (!pathname.startsWith("/admin/login") && !request.cookies.get(SESSION_COOKIE)) {
      const url = new URL("/admin/login", request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }
    // One id per admin request; activity-log entries written by the same request share it.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", crypto.randomUUID());
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const rules = await getRules();
  const rule = rules.get(normalizePath(pathname));
  if (rule) {
    const target = /^https:\/\//i.test(rule.to) ? new URL(rule.to) : new URL(rule.to, request.url);
    void db.redirect.update({ where: { id: rule.id }, data: { hits: { increment: 1 } } }).catch(() => {});
    return NextResponse.redirect(target, rule.status as 301 | 302 | 307 | 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|media/|brand/|icon\\.png|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|webp|avif|gif|svg|ico|css|js|map|txt|woff2?)$).*)"],
};
