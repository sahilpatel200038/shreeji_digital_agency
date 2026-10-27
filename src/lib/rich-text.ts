import sanitizeHtml from "sanitize-html";
import type { Block } from "@/lib/blocks/schema";

/** Colour values the editor can produce (hex, rgb(a), hsl or a plain keyword). Anything else is dropped. */
const COLOR = [/^#[0-9a-f]{3,8}$/i, /^rgba?\(\s*[\d.\s,%]+\)$/i, /^hsla?\(\s*[\d.\s,%deg]+\)$/i, /^[a-z]{3,20}$/i];
const ALIGN = [/^(left|right|center|justify)$/];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "span", "ul", "ol", "li", "blockquote", "a", "img", "hr", "code", "pre"],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    p: ["style"],
    h2: ["style"],
    h3: ["style"],
    h4: ["style"],
    li: ["style"],
    span: ["style"],
  },
  allowedStyles: {
    "*": { "text-align": ALIGN, color: COLOR },
  },
  // Links: only web, mail and phone links. Images: only our own media route or https.
  allowedSchemes: ["https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? "";
      const external = /^https?:\/\//i.test(href);
      const next: Record<string, string> = { href };
      if (external) {
        next.target = "_blank";
        next.rel = "noopener noreferrer";
      }
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => {
      const src = attribs.src ?? "";
      // Relative media paths are the only non-https source allowed.
      const ok = /^\/media\/\d+(\?[a-z0-9=&]*)?$/i.test(src) || /^https:\/\//i.test(src);
      return { tagName, attribs: ok ? { ...attribs, loading: "lazy" } : {} };
    },
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
};

/** Makes editor or pasted HTML safe to store and to render with dangerouslySetInnerHTML. Allow-list based; scripts, events, styles other than colour/alignment and javascript: URLs are removed. */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Converts the tiny inline markdown used by the older block editor (**bold**, *italic*, [text](url)) to HTML. */
function inlineToHtml(text: string): string {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>");
}

/** Turns legacy blocks into one HTML string so existing posts open in the rich text editor without losing content. */
export function blocksToHtml(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "richtext":
        out.push(b.html);
        break;
      case "heading":
        out.push(`<h${b.level}>${inlineToHtml(b.text)}</h${b.level}>`);
        break;
      case "paragraph":
        out.push(`<p>${inlineToHtml(b.text)}</p>`);
        break;
      case "list": {
        const tag = b.ordered ? "ol" : "ul";
        out.push(`<${tag}>${b.items.map((i) => `<li><p>${inlineToHtml(i)}</p></li>`).join("")}</${tag}>`);
        break;
      }
      case "image":
        out.push(`<p><img src="/media/${b.mediaId}" alt="${esc(b.alt)}"></p>${b.caption ? `<p><em>${esc(b.caption)}</em></p>` : ""}`);
        break;
      case "quote":
        out.push(`<blockquote><p>${inlineToHtml(b.text)}</p>${b.cite ? `<p>— ${esc(b.cite)}</p>` : ""}</blockquote>`);
        break;
      case "callout":
        out.push(`<blockquote>${b.title ? `<p><strong>${esc(b.title)}</strong></p>` : ""}<p>${inlineToHtml(b.text)}</p></blockquote>`);
        break;
      case "cta":
        out.push(`<h3>${esc(b.title)}</h3>${b.text ? `<p>${esc(b.text)}</p>` : ""}<p><a href="${esc(b.href)}">${esc(b.label)}</a></p>`);
        break;
      case "faq":
        out.push(b.items.map((i) => `<h3>${esc(i.question)}</h3><p>${esc(i.answer)}</p>`).join(""));
        break;
      case "divider":
        out.push("<hr>");
        break;
    }
  }
  return out.join("");
}
