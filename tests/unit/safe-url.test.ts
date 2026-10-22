import { describe, expect, it } from "vitest";
import { isSafeHref, isSafeRedirectTarget, normalizePath, safeAdminNext } from "@/lib/safe-url";

describe("isSafeHref", () => {
  it.each(["/contact", "/services/seo", "#top", "https://example.com/x", "mailto:a@b.co", "tel:+919512494494"])("allows %s", (v) => {
    expect(isSafeHref(v)).toBe(true);
  });
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "//evil.com", "/\\evil.com", "http://insecure.com", "vbscript:x", "", " ", "https://a b.com", "/a\nb", "ftp://x"])("rejects %j", (v) => {
    expect(isSafeHref(v)).toBe(false);
  });
});

describe("isSafeRedirectTarget", () => {
  it("allows internal paths and https", () => {
    expect(isSafeRedirectTarget("/new")).toBe(true);
    expect(isSafeRedirectTarget("https://example.com/a")).toBe(true);
  });
  it("blocks protocol-relative, javascript and http", () => {
    for (const v of ["//evil.com", "javascript:alert(1)", "http://example.com", "/\\evil", "mailto:a@b.co"]) expect(isSafeRedirectTarget(v)).toBe(false);
  });
});

describe("safeAdminNext", () => {
  it("only allows admin paths", () => {
    expect(safeAdminNext("/admin/pages?x=1")).toBe("/admin/pages?x=1");
    expect(safeAdminNext("https://evil.com")).toBe("/admin");
    expect(safeAdminNext("//evil.com")).toBe("/admin");
    expect(safeAdminNext("/administrator")).toBe("/admin");
    expect(safeAdminNext("/admin/login")).toBe("/admin");
    expect(safeAdminNext("/admin\\evil")).toBe("/admin");
    expect(safeAdminNext(null)).toBe("/admin");
  });
});

describe("normalizePath", () => {
  it("lowercases, strips query and trailing slash", () => {
    expect(normalizePath("/Old-Page/?a=1#x")).toBe("/old-page");
    expect(normalizePath("/")).toBe("/");
  });
});
