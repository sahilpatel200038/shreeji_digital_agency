import { describe, expect, it } from "vitest";
import { blocksToHtml, sanitizeRichText } from "@/lib/rich-text";
import { countInternalLinks, mediaIdsInBlocks, parseBlocks, readingMinutes, type Block } from "@/lib/blocks/schema";
import { parseBlocksField } from "@/lib/content-helpers";

describe("sanitizeRichText", () => {
  it("keeps the formatting the editor produces", () => {
    const html =
      '<h2 style="text-align: center">Title</h2><p>Some <strong>bold</strong>, <em>italic</em> and <u>underlined</u> <span style="color: #c0392b">red</span> text with a <a href="/contact">link</a>.</p><ul><li><p>one</p></li></ul><ol><li><p>two</p></li></ol><blockquote><p>q</p></blockquote><img src="/media/12" alt="pic"><hr>';
    const out = sanitizeRichText(html);
    for (const part of ["<h2", "text-align:center", "<strong>bold</strong>", "<em>italic</em>", "<u>underlined</u>", "color:#c0392b", 'href="/contact"', "<ul>", "<ol>", "<blockquote>", 'src="/media/12"', "<hr />"]) {
      expect(out).toContain(part);
    }
  });

  it("removes scripts, event handlers, iframes and javascript: links", () => {
    const out = sanitizeRichText(
      '<p onclick="steal()">hi</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">x</a><img src="x" onerror="alert(1)"><a href="data:text/html;base64,AAAA">y</a>',
    );
    expect(out).not.toMatch(/script|onclick|onerror|iframe|javascript:|data:/i);
    expect(out).toContain("hi");
  });

  it("drops styles other than colour and alignment, and unsafe colour values", () => {
    const out = sanitizeRichText('<p style="position:fixed;top:0;background:url(javascript:1);color:expression(alert(1))">x</p><p style="text-align:right">y</p>');
    expect(out).not.toMatch(/position|background|expression/);
    expect(out).toContain("text-align:right");
  });

  it("only allows our own media path or https for images", () => {
    expect(sanitizeRichText('<img src="/media/5" alt="">')).toContain('src="/media/5"');
    expect(sanitizeRichText('<img src="https://cdn.example.com/a.png" alt="">')).toContain("https://cdn.example.com/a.png");
    expect(sanitizeRichText('<img src="http://example.com/a.png" alt="">')).not.toContain("<img");
    expect(sanitizeRichText('<img src="/etc/passwd" alt="">')).not.toContain("passwd");
    expect(sanitizeRichText('<img src="data:image/png;base64,AAAA" alt="">')).not.toContain("data:");
  });

  it("opens external links safely", () => {
    const out = sanitizeRichText('<a href="https://example.com">e</a><a href="/about">i</a>');
    expect(out).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(out).toContain('<a href="/about">i</a>');
  });
});

describe("blocksToHtml (legacy posts open in the rich text editor)", () => {
  const blocks: Block[] = [
    { type: "heading", level: 2, text: "Why <b>SEO</b>" },
    { type: "paragraph", text: "A **bold** claim, *italic* and [a link](/contact)." },
    { type: "list", ordered: true, items: ["first", "second"] },
    { type: "image", mediaId: 7, alt: "chart", caption: "Figure 1" },
    { type: "quote", text: "Quoted", cite: "Someone" },
    { type: "faq", items: [{ question: "Q?", answer: "A." }] },
    { type: "divider" },
  ];

  it("keeps every block's content", () => {
    const html = sanitizeRichText(blocksToHtml(blocks));
    expect(html).toContain("<h2>Why &lt;b&gt;SEO&lt;/b&gt;</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain('<a href="/contact">a link</a>');
    expect(html).toContain("<ol>");
    expect(html).toContain('src="/media/7"');
    expect(html).toContain("Figure 1");
    expect(html).toContain("Quoted");
    expect(html).toContain("<h3>Q?</h3>");
    expect(html).toContain("<hr />");
  });
});

describe("richtext blocks", () => {
  const rich: Block[] = [{ type: "richtext", html: '<p>Hello world, see <a href="/contact">contact</a></p><img src="/media/9" alt="">' }];

  it("validates, counts words, links and images", () => {
    expect(parseBlocks(rich)).toEqual(rich);
    expect(readingMinutes(rich)).toBe(1);
    expect(countInternalLinks(rich)).toBe(1);
    expect(mediaIdsInBlocks(rich)).toEqual([9]);
  });

  it("is sanitised when a form is saved", () => {
    const saved = parseBlocksField(JSON.stringify([{ type: "richtext", html: '<p onclick="x()">ok</p><script>alert(1)</script>' }]));
    expect(saved).toEqual([{ type: "richtext", html: "<p>ok</p>" }]);
  });
});
