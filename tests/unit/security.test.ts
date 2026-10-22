import { describe, expect, it } from "vitest";
import { evaluateWindow } from "@/lib/rate-limit";
import { can, PERMISSIONS } from "@/lib/auth/permissions";
import { csvCell, toCsv } from "@/lib/csv";
import { passwordProblems } from "@/lib/auth/password";
import { leadSchema, looksLikeSpam } from "@/lib/validation/lead";
import { settingsGuard } from "./helpers";

describe("evaluateWindow (rate limiting)", () => {
  const t0 = new Date("2026-01-01T00:00:00Z");
  const min = (n: number) => new Date(t0.getTime() + n * 60_000);
  it("allows up to the limit then blocks", () => {
    let state = null as { count: number; windowStart: Date } | null;
    const results = [];
    for (let i = 0; i < 6; i++) {
      const r = evaluateWindow(state, min(i), 5, 15 * 60_000);
      state = { count: r.count, windowStart: r.windowStart };
      results.push(r.allowed);
    }
    expect(results).toEqual([true, true, true, true, true, false]);
  });
  it("reports retry-after and resets after the window", () => {
    const blocked = evaluateWindow({ count: 5, windowStart: t0 }, min(1), 5, 15 * 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(14 * 60);
    const reset = evaluateWindow({ count: 5, windowStart: t0 }, min(16), 5, 15 * 60_000);
    expect(reset.allowed).toBe(true);
    expect(reset.count).toBe(1);
  });
});

describe("permissions matrix", () => {
  it("super admin has everything", () => {
    for (const p of PERMISSIONS) expect(can("SUPER_ADMIN", p)).toBe(true);
  });
  it("editor is limited to content and media", () => {
    expect(can("EDITOR", "content:write")).toBe(true);
    expect(can("EDITOR", "media:write")).toBe(true);
    for (const p of ["content:delete", "media:delete", "menus:write", "leads:read", "leads:export", "redirects:write", "settings:write", "settings:scripts", "users:manage", "audit:read", "system-page:delete"] as const) {
      expect(can("EDITOR", p)).toBe(false);
    }
  });
  it("admin cannot manage users, scripts or delete system pages or leads", () => {
    for (const p of ["users:manage", "settings:scripts", "system-page:delete", "leads:delete"] as const) expect(can("ADMIN", p)).toBe(false);
    for (const p of ["content:delete", "leads:read", "leads:export", "settings:write", "redirects:write", "menus:write"] as const) expect(can("ADMIN", p)).toBe(true);
  });
  it("unknown roles get nothing", () => {
    expect(can("HACKER" as never, "content:write")).toBe(false);
  });
});

describe("csv export", () => {
  it("neutralises formula injection", () => {
    for (const v of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) expect(csvCell(v).replace(/^"/, "")).toMatch(/^'/);
  });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(toCsv(["a"], [["x"], [null]])).toBe("a\r\nx\r\n");
  });
});

describe("password policy", () => {
  it("rejects weak passwords", () => {
    for (const p of ["short1A", "alllowercase123", "ALLUPPERCASE123", "NoNumbersHereAtAll"]) expect(passwordProblems(p)).not.toBeNull();
  });
  it("accepts strong ones", () => expect(passwordProblems("Correct-Horse-9-Battery")).toBeNull());
});

describe("lead validation", () => {
  const ok = { firstName: "Asha", lastName: "", email: " ASHA@Example.com ", phone: "", company: "", service: "", message: "I would like a quote please." };
  it("normalises email and accepts valid input", () => {
    const r = leadSchema.safeParse(ok);
    expect(r.success && r.data.email).toBe("asha@example.com");
  });
  it("rejects bad email, short message, bad phone", () => {
    expect(leadSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...ok, message: "hi" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...ok, phone: "abc" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...ok, firstName: "" }).success).toBe(false);
  });
  it("flags link-stuffed messages as spam", () => {
    expect(looksLikeSpam("buy http://a.com http://b.com http://c.com now")).toBe(true);
    expect(looksLikeSpam("see our site https://a.com")).toBe(false);
  });
});

describe("settings schemas", () => {
  it("only accept well-formed analytics ids (no script injection)", () => {
    expect(settingsGuard({ ga4: "G-ABC123XYZ9", gtm: "", gscToken: "" })).toBe(true);
    expect(settingsGuard({ ga4: "G-1');alert(1);//", gtm: "", gscToken: "" })).toBe(false);
    expect(settingsGuard({ ga4: "", gtm: "GTM-AB12CD\"></script>", gscToken: "" })).toBe(false);
    expect(settingsGuard({ ga4: "", gtm: "", gscToken: "<script>" })).toBe(false);
  });
});
