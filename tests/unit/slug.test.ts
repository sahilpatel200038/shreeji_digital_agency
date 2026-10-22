import { describe, expect, it } from "vitest";
import { isValidSlug, RESERVED_SLUGS, slugify } from "@/lib/slug";

describe("slugify", () => {
  it("creates clean slugs", () => {
    expect(slugify("Web & App Development")).toBe("web-and-app-development");
    expect(slugify("  Hello,   World!  ")).toBe("hello-world");
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
    expect(slugify("---")).toBe("");
  });
  it("caps length", () => {
    expect(slugify("a".repeat(300)).length).toBeLessThanOrEqual(120);
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase-hyphen", () => expect(isValidSlug("my-page-2")).toBe(true));
  it.each(["", "My-Page", "a b", "a--b", "-a", "a-", "a/b", "../x", "a_b"])("rejects %j", (s) => expect(isValidSlug(s)).toBe(false));
});

describe("reserved slugs", () => {
  it("reserves system routes", () => {
    for (const s of ["admin", "api", "media", "services", "blog", "sitemap.xml"]) expect(RESERVED_SLUGS.has(s)).toBe(true);
  });
});
