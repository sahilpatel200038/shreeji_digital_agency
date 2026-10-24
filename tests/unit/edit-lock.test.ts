import { describe, expect, it } from "vitest";
import { canLock, conflictMessage, isValidLockKey, lockKey } from "@/lib/lock-keys";
import { parseMenuItems } from "@/lib/menu-items";

describe("edit-lock keys", () => {
  it("builds one stable key per resource", () => {
    expect(lockKey.service(5)).toBe("service:5");
    expect(lockKey.setting("home")).toBe("setting:home");
    expect(lockKey.menu("footer-company")).toBe("menu:footer-company");
    expect(lockKey.chrome("header")).toBe("chrome:header");
  });

  it("accepts every key the app builds and rejects anything else", () => {
    for (const k of [lockKey.page(1), lockKey.post(2), lockKey.team(3), lockKey.setting("seo-faq"), lockKey.menu("footer-legal"), lockKey.user(9)]) expect(isValidLockKey(k), k).toBe(true);
    for (const bad of ["", "nonsense", "service:", ":5", "unknown:5", "service:5:6", "service:a b", "service:" + "x".repeat(81), "../../etc:1", 5, null, undefined, {}]) {
      expect(isValidLockKey(bad), String(bad)).toBe(false);
    }
  });

  it("only lets a user lock what they may edit", () => {
    expect(canLock({ role: "EDITOR" }, "team:1")).toBe(true);
    expect(canLock({ role: "EDITOR" }, "setting:home")).toBe(false);
    expect(canLock({ role: "EDITOR" }, "menu:header")).toBe(false);
    expect(canLock({ role: "ADMIN" }, "menu:header")).toBe(true);
    expect(canLock({ role: "ADMIN" }, "user:1")).toBe(false);
    expect(canLock({ role: "SUPER_ADMIN" }, "user:1")).toBe(true);
    expect(canLock({ role: "SUPER_ADMIN" }, "bogus:1")).toBe(false);
  });

  it("names the other editor in the message", () => {
    expect(conflictMessage("page:1", "Asha Shah", false)).toBe("This page is currently being edited by Asha Shah. Please wait until they finish or the editing lock is released.");
    expect(conflictMessage("team:1", "Asha Shah", false)).toContain("team member");
    expect(conflictMessage("page:1", "Me", true)).toContain("another browser tab");
  });
});

describe("menu items parsing (header and footer links)", () => {
  const item = (over: Record<string, unknown> = {}) => ({ key: "a", parentKey: null, label: "Home", href: "/", openInNewTab: false, isActive: true, ...over });

  it("accepts valid items", () => {
    const items = parseMenuItems(JSON.stringify([item(), item({ key: "b", parentKey: "a", label: "Child", href: "https://example.com/x" })]));
    expect(items).toHaveLength(2);
  });

  it("rejects unsafe links, missing labels, bad parents and nesting deeper than one level", () => {
    expect(() => parseMenuItems(JSON.stringify([item({ href: "javascript:alert(1)" })]))).toThrow(/Use \/path/);
    expect(() => parseMenuItems(JSON.stringify([item({ href: "//evil.example" })]))).toThrow();
    expect(() => parseMenuItems(JSON.stringify([item({ label: "  " })]))).toThrow(/needs a label/);
    expect(() => parseMenuItems(JSON.stringify([item({ parentKey: "missing" })]))).toThrow(/invalid parent/);
    expect(() => parseMenuItems(JSON.stringify([item({ parentKey: "a" })]))).toThrow(/invalid parent/);
    expect(() => parseMenuItems(JSON.stringify([item(), item({ key: "b", parentKey: "a" }), item({ key: "c", parentKey: "b" })]))).toThrow(/one level/);
  });

  it("rejects garbage and names the menu in the message", () => {
    expect(() => parseMenuItems("not json")).toThrow(/could not be read/);
    expect(() => parseMenuItems(JSON.stringify([item({ href: "javascript:1" })]), "Navigation")).toThrow(/^Navigation: Item 1:/);
    expect(parseMenuItems(null)).toEqual([]);
    expect(() => parseMenuItems(JSON.stringify(Array.from({ length: 41 }, (_, i) => item({ key: `k${i}` }))))).toThrow();
  });
});
