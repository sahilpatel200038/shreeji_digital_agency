import { describe, expect, it } from "vitest";
import { actionTypeFor, diffFields, moduleFor, sanitizeValues } from "@/lib/audit-format";
import { parseLogFilters, zonedDayStart } from "@/lib/audit-query";

describe("actionTypeFor", () => {
  it.each([
    ["login", "LOGIN"],
    ["logout", "LOGOUT"],
    ["login.failed", "LOGIN_FAILED"],
    ["page.create", "CREATE"],
    ["media.upload", "CREATE"],
    ["page.update", "UPDATE"],
    ["service.reorder", "UPDATE"],
    ["user.password-reset", "UPDATE"],
    ["faq.delete", "DELETE"],
    ["post.publish", "PUBLISH"],
    ["post.unpublish", "UNPUBLISH"],
    ["lead.export", "EXPORT"],
    ["something", "OTHER"],
  ])("%s -> %s", (action, type) => expect(actionTypeFor(action)).toBe(type));
});

describe("moduleFor", () => {
  it("maps entity types to admin module names and falls back to the raw type", () => {
    expect(moduleFor("page")).toBe("Pages");
    expect(moduleFor("team")).toBe("Team");
    expect(moduleFor("unknown-thing")).toBe("unknown-thing");
  });
});

describe("sanitizeValues", () => {
  it("redacts sensitive keys at any depth and never stores their values", () => {
    const out = sanitizeValues({ name: "A", passwordHash: "x", nested: { apiKey: "k", authToken: "t", ok: 1 } });
    expect(JSON.stringify(out)).not.toMatch(/"x"|"k"|"t"/);
    expect(out).toMatchObject({ name: "A", passwordHash: "[redacted]", nested: { apiKey: "[redacted]", authToken: "[redacted]", ok: 1 } });
  });
  it("shortens long text and returns null for empty input", () => {
    const long = "a".repeat(1000);
    expect((sanitizeValues({ t: long }) as { t: string }).t.length).toBeLessThan(400);
    expect(sanitizeValues({})).toBeNull();
    expect(sanitizeValues(null)).toBeNull();
  });
});

describe("diffFields", () => {
  it("keeps only changed fields with previous and new values", () => {
    const d = diffFields({ a: 1, b: "x", c: null }, { a: 1, b: "y", c: 5 });
    expect(d).toEqual({ before: { b: "x", c: null }, after: { b: "y", c: 5 } });
  });
  it("returns null when nothing changed, and treats equal dates as equal", () => {
    expect(diffFields({ a: 1, d: new Date(1000) }, { a: 1, d: new Date(1000) })).toBeNull();
  });
  it("respects the key allow-list", () => {
    expect(diffFields({ a: 1, secret: 1 }, { a: 2, secret: 2 }, ["a"])).toEqual({ before: { a: 1 }, after: { a: 2 } });
  });
});

describe("zonedDayStart", () => {
  it("returns midnight in the zone as a UTC instant (IST = UTC+5:30)", () => {
    expect(zonedDayStart("2026-10-16", "Asia/Kolkata")?.toISOString()).toBe("2026-10-15T18:30:00.000Z");
    expect(zonedDayStart("2026-10-16", "UTC")?.toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });
  it("rejects anything that is not a real calendar date", () => {
    for (const bad of [undefined, "", "2026-13-01", "2026-02-30", "16/10/2026", "2026-10-16T00:00"]) expect(zonedDayStart(bad as string)).toBeNull();
  });
});

describe("parseLogFilters", () => {
  it("defaults to newest first, page 1, no filters", () => {
    const f = parseLogFilters({});
    expect(f.sort).toBe("desc");
    expect(f.page).toBe(1);
    expect(f.where).toEqual({});
  });
  it("ignores invalid action types, bad ids and bad pages", () => {
    const f = parseLogFilters({ actionType: "DROP TABLE", userId: "abc", page: "-4", from: "nope" });
    expect(f.where).toEqual({});
    expect(f.page).toBe(1);
  });
  it("makes the end date inclusive", () => {
    const f = parseLogFilters({ from: "2026-10-01", to: "2026-10-02" });
    const range = (f.where as { AND: { createdAt: { gte: Date; lt: Date } }[] }).AND[0].createdAt;
    expect(range.lt.getTime() - range.gte.getTime()).toBe(2 * 24 * 3600 * 1000);
  });
  it("combines search, action, module and user filters", () => {
    const f = parseLogFilters({ q: "home", actionType: "UPDATE", module: "Pages", userId: "3", sort: "asc" });
    expect((f.where as { AND: unknown[] }).AND).toHaveLength(4);
    expect(f.sort).toBe("asc");
  });
});
