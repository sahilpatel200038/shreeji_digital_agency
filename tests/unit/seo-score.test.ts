import { describe, expect, it } from "vitest";
import { scoreSeo } from "@/lib/seo/score";
import { jsonLdString } from "@/lib/seo/schema";
import { seoSchema } from "@/lib/validation/seo";

const goodBlocks = [
  { type: "heading" as const, level: 2 as const, text: "Technical SEO basics for business websites" },
  { type: "paragraph" as const, text: `Technical SEO basics help search engines find your pages. ${"More helpful words about the topic. ".repeat(30)} See our [SEO services](/services/seo).` },
];

describe("scoreSeo", () => {
  it("passes a well-optimised page", () => {
    const r = scoreSeo({
      title: "Technical SEO Basics for Business Websites",
      description: "Technical SEO basics every business website should cover: crawling, speed, sitemaps and structured data in plain language.",
      slug: "technical-seo-basics",
      focusKeyword: "technical SEO basics",
      blocks: goodBlocks,
      fallbackTitle: "x",
      published: true,
    });
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("flags missing basics", () => {
    const r = scoreSeo({ slug: "A Very Long Slug With Many Words Here", blocks: [], fallbackTitle: "Hi" });
    const failed = r.checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failed).toEqual(expect.arrayContaining(["title", "desc", "kw", "content", "links", "slug"]));
    expect(r.score).toBeLessThan(50);
  });

  it("flags published noindex pages and bad canonicals", () => {
    const r = scoreSeo({ slug: "x", blocks: [], fallbackTitle: "x", published: true, robotsIndex: false, canonicalUrl: "http://nope" });
    expect(r.checks.find((c) => c.id === "index")?.ok).toBe(false);
    expect(r.checks.find((c) => c.id === "canonical")?.ok).toBe(false);
  });

  it("flags images without alt text", () => {
    const r = scoreSeo({ slug: "x", blocks: [], fallbackTitle: "x", imagesMissingAlt: 2 });
    expect(r.checks.find((c) => c.id === "alt")?.ok).toBe(false);
  });
});

describe("jsonLdString", () => {
  it("escapes characters that could break out of a script tag", () => {
    const out = jsonLdString({ name: "</script><script>alert(1)</script>&" });
    expect(out).not.toContain("</script>");
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>&");
  });
});

describe("seoSchema", () => {
  const base = { title: "", description: "", canonicalUrl: "", robotsIndex: true, robotsFollow: true, includeInSitemap: true, focusKeyword: "", secondaryKeywords: [], ogTitle: "", ogDescription: "", ogMediaId: null, structuredData: "AUTO" };
  it("normalises empty strings to null", () => {
    const r = seoSchema.parse(base);
    expect(r.title).toBeNull();
    expect(r.canonicalUrl).toBeNull();
  });
  it("rejects non-https canonical URLs", () => {
    expect(seoSchema.safeParse({ ...base, canonicalUrl: "http://x.com" }).success).toBe(false);
    expect(seoSchema.safeParse({ ...base, canonicalUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(seoSchema.safeParse({ ...base, canonicalUrl: "https://x.com/a" }).success).toBe(true);
  });
  it("caps secondary keywords", () => {
    expect(seoSchema.safeParse({ ...base, secondaryKeywords: Array(11).fill("k") }).success).toBe(false);
  });
});
