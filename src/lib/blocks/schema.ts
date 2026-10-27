import { z } from "zod";
import { isSafeHref } from "@/lib/safe-url";
import { htmlToText } from "@/lib/html-text";

const href = z.string().trim().max(500).refine(isSafeHref, "Use an internal path (/contact), https:// link, mailto: or tel:");

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3)]), text: z.string().trim().min(1).max(200) }),
  // Sanitised HTML from the rich text editor (blog posts). Sanitised again on render.
  z.object({ type: z.literal("richtext"), html: z.string().max(200_000) }),
  z.object({ type: z.literal("paragraph"), text: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("list"), ordered: z.boolean(), items: z.array(z.string().trim().min(1).max(500)).min(1).max(50) }),
  z.object({
    type: z.literal("image"),
    mediaId: z.number().int().positive(),
    alt: z.string().trim().max(500),
    caption: z.string().trim().max(300).optional().default(""),
  }),
  z.object({ type: z.literal("quote"), text: z.string().trim().min(1).max(1000), cite: z.string().trim().max(200).optional().default("") }),
  z.object({ type: z.literal("callout"), title: z.string().trim().max(150).optional().default(""), text: z.string().trim().min(1).max(1000) }),
  z.object({
    type: z.literal("cta"),
    title: z.string().trim().min(1).max(150),
    text: z.string().trim().max(400).optional().default(""),
    label: z.string().trim().min(1).max(60),
    href,
  }),
  z.object({
    type: z.literal("faq"),
    items: z
      .array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(2000) }))
      .min(1)
      .max(30),
  }),
  z.object({ type: z.literal("divider") }),
]);

export const blocksSchema = z.array(blockSchema).max(200);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Heading",
  richtext: "Rich text",
  paragraph: "Paragraph",
  list: "List",
  image: "Image",
  quote: "Quote",
  callout: "Callout",
  cta: "Call to action",
  faq: "FAQ",
  divider: "Divider",
};

export function emptyBlock(type: BlockType): Block {
  switch (type) {
    case "heading":
      return { type, level: 2, text: "" };
    case "richtext":
      return { type, html: "" };
    case "paragraph":
      return { type, text: "" };
    case "list":
      return { type, ordered: false, items: [""] };
    case "image":
      return { type, mediaId: 0, alt: "", caption: "" };
    case "quote":
      return { type, text: "", cite: "" };
    case "callout":
      return { type, title: "", text: "" };
    case "cta":
      return { type, title: "", text: "", label: "Contact us", href: "/contact" };
    case "faq":
      return { type, items: [{ question: "", answer: "" }] };
    case "divider":
      return { type };
  }
}

/** Plain text of all blocks, used for reading time and SEO checks. */
export function blocksToText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "richtext":
        parts.push(htmlToText(b.html));
        break;
      case "heading":
      case "paragraph":
        parts.push(b.text);
        break;
      case "list":
        parts.push(...b.items);
        break;
      case "quote":
        parts.push(b.text);
        break;
      case "callout":
        parts.push(b.title, b.text);
        break;
      case "cta":
        parts.push(b.title, b.text);
        break;
      case "faq":
        for (const i of b.items) parts.push(i.question, i.answer);
        break;
      default:
        break;
    }
  }
  return parts.filter(Boolean).join("\n");
}

export function readingMinutes(blocks: Block[]): number {
  const words = blocksToText(blocks).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Parse stored JSON defensively; never throw on bad data. */
export function parseBlocks(value: unknown): Block[] {
  const parsed = blocksSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

/** All media ids referenced by blocks. */
export function mediaIdsInBlocks(blocks: Block[]): number[] {
  return blocks.flatMap((b) => {
    if (b.type === "image") return [b.mediaId];
    if (b.type === "richtext") return [...b.html.matchAll(/\/media\/(\d+)/g)].map((m) => Number(m[1]));
    return [];
  });
}

/** Count internal links ("/..." markdown links) inside paragraph text. */
export function countInternalLinks(blocks: Block[]): number {
  let n = 0;
  const re = /\]\((\/[^)\s]*)\)/g;
  for (const b of blocks) {
    if (b.type === "richtext") {
      n += [...b.html.matchAll(/href="\/[^"/][^"]*"|href="\/"/g)].length;
      continue;
    }
    const texts = b.type === "paragraph" ? [b.text] : b.type === "list" ? b.items : b.type === "cta" ? [b.href] : [];
    for (const t of texts) {
      if (b.type === "cta") {
        if (t.startsWith("/")) n++;
      } else n += [...t.matchAll(re)].length;
    }
  }
  return n;
}
