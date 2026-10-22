import type { Block } from "@/lib/blocks/schema";
import { blocksToText, countInternalLinks } from "@/lib/blocks/schema";
import { isValidSlug } from "@/lib/slug";

export type SeoCheck = { id: string; label: string; ok: boolean; hint: string };

export type SeoScoreInput = {
  title?: string | null;
  description?: string | null;
  slug: string;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  blocks: Block[];
  fallbackTitle: string;
  /** Extra text that counts as page content (service intro, excerpt...). */
  extraText?: string;
  imagesMissingAlt?: number;
  published?: boolean;
};

const has = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/** Transparent content-quality checklist. NOT a prediction of Google rankings. */
export function scoreSeo(i: SeoScoreInput): { score: number; checks: SeoCheck[] } {
  const title = (i.title?.trim() || i.fallbackTitle).trim();
  const desc = i.description?.trim() ?? "";
  const kw = i.focusKeyword?.trim() ?? "";
  const text = `${i.extraText ?? ""}\n${blocksToText(i.blocks)}`;
  const firstPara = (i.blocks.find((b) => b.type === "paragraph") as { text: string } | undefined)?.text ?? i.extraText ?? "";
  const headings = i.blocks.filter((b) => b.type === "heading").map((b) => (b as { text: string }).text).join(" ");
  const canonicalOk = !i.canonicalUrl || /^https:\/\/[^\s]+$/.test(i.canonicalUrl);

  const checks: SeoCheck[] = [
    { id: "title", label: "SEO title is set", ok: Boolean(i.title?.trim()), hint: "Add a custom SEO title (otherwise the page title is used)." },
    { id: "title-len", label: "Title length is 30–60 characters", ok: title.length >= 30 && title.length <= 60, hint: `Currently ${title.length} characters.` },
    { id: "desc", label: "Meta description is set", ok: desc.length > 0, hint: "Write a concise summary for search results." },
    { id: "desc-len", label: "Description length is 70–160 characters", ok: desc.length >= 70 && desc.length <= 160, hint: `Currently ${desc.length} characters.` },
    { id: "kw", label: "Focus keyword is set", ok: kw.length > 0, hint: "Choose the main phrase this page should be found for." },
    { id: "kw-title", label: "Focus keyword appears in the title", ok: kw.length > 0 && has(title, kw), hint: "Use the keyword naturally in the title." },
    { id: "kw-desc", label: "Focus keyword appears in the description", ok: kw.length > 0 && has(desc, kw), hint: "Mention the keyword naturally in the description." },
    { id: "kw-intro", label: "Focus keyword appears in the opening text", ok: kw.length > 0 && has(firstPara, kw), hint: "Use the keyword naturally in the first paragraph." },
    { id: "kw-heading", label: "Focus keyword appears in a heading", ok: kw.length > 0 && has(headings, kw), hint: "Include the keyword in a subheading where it reads naturally." },
    { id: "kw-slug", label: "Focus keyword appears in the URL", ok: kw.length > 0 && has(i.slug, kw.toLowerCase().replace(/[^a-z0-9]+/g, "-")), hint: "Optional: a readable slug containing the keyword." },
    { id: "slug", label: "URL slug is readable (≤ 5 words)", ok: isValidSlug(i.slug) && i.slug.split("-").length <= 5, hint: "Short, lowercase, hyphenated slugs work best." },
    { id: "content", label: "Page has enough content (≥ 150 words)", ok: text.split(/\s+/).filter(Boolean).length >= 150, hint: "Thin pages rarely satisfy search intent." },
    { id: "alt", label: "All images have alt text", ok: (i.imagesMissingAlt ?? 0) === 0, hint: `${i.imagesMissingAlt ?? 0} image(s) missing alt text.` },
    { id: "links", label: "Has at least one internal link", ok: countInternalLinks(i.blocks) > 0, hint: "Link to a related page using [text](/path)." },
    { id: "canonical", label: "Canonical URL is valid (or empty)", ok: canonicalOk, hint: "Must start with https://." },
    { id: "index", label: "Indexing setting looks intentional", ok: !(i.published && i.robotsIndex === false), hint: "This published page is set to noindex." },
  ];
  const passed = checks.filter((c) => c.ok).length;
  return { score: Math.round((passed / checks.length) * 100), checks };
}
