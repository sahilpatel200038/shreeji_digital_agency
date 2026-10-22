import { describe, expect, it } from "vitest";
import { blocksSchema, countInternalLinks, parseBlocks, readingMinutes, mediaIdsInBlocks, type Block } from "@/lib/blocks/schema";

describe("blocksSchema", () => {
  it("accepts valid blocks", () => {
    const r = blocksSchema.safeParse([
      { type: "heading", level: 2, text: "Hi" },
      { type: "paragraph", text: "Body [link](/contact)" },
      { type: "list", ordered: false, items: ["a"] },
      { type: "cta", title: "T", label: "Go", href: "/contact" },
      { type: "image", mediaId: 3, alt: "x" },
      { type: "divider" },
    ]);
    expect(r.success).toBe(true);
  });

  it("rejects H1 (reserved for the page template)", () => {
    expect(blocksSchema.safeParse([{ type: "heading", level: 1, text: "x" }]).success).toBe(false);
  });

  it("rejects unsafe CTA links", () => {
    for (const href of ["javascript:alert(1)", "//evil.com", "data:text/html,x", "http://insecure.com"]) {
      expect(blocksSchema.safeParse([{ type: "cta", title: "T", label: "L", href }]).success).toBe(false);
    }
  });

  it("rejects unknown block types and raw HTML blocks", () => {
    expect(blocksSchema.safeParse([{ type: "html", html: "<script>alert(1)</script>" }]).success).toBe(false);
  });

  it("rejects empty text and oversize content", () => {
    expect(blocksSchema.safeParse([{ type: "paragraph", text: "   " }]).success).toBe(false);
    expect(blocksSchema.safeParse([{ type: "paragraph", text: "x".repeat(5001) }]).success).toBe(false);
  });
});

describe("parseBlocks", () => {
  it("never throws on bad stored data", () => {
    expect(parseBlocks(null)).toEqual([]);
    expect(parseBlocks("nope")).toEqual([]);
    expect(parseBlocks([{ type: "bad" }])).toEqual([]);
  });
});

describe("helpers", () => {
  const blocks: Block[] = [
    { type: "paragraph", text: "See [services](/services) and [x](https://example.com)." },
    { type: "image", mediaId: 7, alt: "", caption: "" },
    { type: "cta", title: "T", text: "", label: "L", href: "/contact" },
  ];
  it("counts internal links only", () => expect(countInternalLinks(blocks)).toBe(2));
  it("finds media ids", () => expect(mediaIdsInBlocks(blocks)).toEqual([7]));
  it("reading time is at least 1 minute", () => expect(readingMinutes(blocks)).toBe(1));
  it("reading time scales with words", () => expect(readingMinutes([{ type: "paragraph", text: "word ".repeat(1000) }])).toBe(5));
});
