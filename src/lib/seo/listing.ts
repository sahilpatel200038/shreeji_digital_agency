import { cache } from "react";
import { db } from "@/lib/db";
import type { SeoInput } from "@/lib/seo/metadata";

/**
 * The public pages that are built from code rather than a CMS Page record. Their SEO lives in a normal SeoMeta
 * row (same fields and panel as pages, posts and services); the Setting "seoPages" maps each key to that row.
 * `defaults` are used for any field the admin leaves empty.
 */
export const LISTING_PAGES = {
  home: {
    label: "Homepage",
    path: "/",
    defaults: { title: "", description: "" }, // site-wide defaults from Settings > SEO apply
  },
  services: {
    label: "Services",
    path: "/services",
    defaults: {
      title: "Digital Marketing & Web Development Services | Shreeji Marketing",
      description: "Brand strategy, digital marketing, SEO, lead generation, web and app development, hosting and design services from Shreeji Marketing in Ahmedabad.",
    },
  },
  blog: {
    label: "Blog",
    path: "/blog",
    defaults: {
      title: "Blog: Marketing, SEO & Web Insights | Shreeji Marketing",
      description: "Practical articles on digital marketing, SEO, branding and web development from the team at Shreeji Marketing.",
    },
  },
  faq: {
    label: "FAQ",
    path: "/faq",
    defaults: {
      title: "FAQ: Working with Shreeji Marketing",
      description: "Answers to common questions about our services, timelines, minimum engagement, reporting and working with startups.",
    },
  },
} as const;

export type ListingKey = keyof typeof LISTING_PAGES;
export const LISTING_KEYS = Object.keys(LISTING_PAGES) as ListingKey[];
export const isListingKey = (k: string): k is ListingKey => (LISTING_KEYS as string[]).includes(k);

const readMap = cache(async (): Promise<Partial<Record<ListingKey, number>>> => {
  const row = await db.setting.findUnique({ where: { key: "seoPages" } }).catch(() => null);
  const v = (row?.value ?? {}) as Record<string, unknown>;
  const out: Partial<Record<ListingKey, number>> = {};
  for (const k of LISTING_KEYS) if (typeof v[k] === "number") out[k] = v[k] as number;
  return out;
}) ;

/** The saved SEO row for a listing page, or null when the admin has not edited it yet. */
export async function getListingSeoRow(key: ListingKey) {
  const id = (await readMap())[key];
  return id ? db.seoMeta.findUnique({ where: { id } }).catch(() => null) : null;
}

/** SEO input for buildMetadata: saved values win, empty ones fall back to the built-in text. */
export async function listingSeo(key: ListingKey): Promise<NonNullable<SeoInput>> {
  const row = await getListingSeoRow(key);
  const d = LISTING_PAGES[key].defaults;
  return {
    title: row?.title?.trim() || d.title || null,
    description: row?.description?.trim() || d.description || null,
    canonicalUrl: row?.canonicalUrl,
    robotsIndex: row?.robotsIndex ?? true,
    robotsFollow: row?.robotsFollow ?? true,
    ogTitle: row?.ogTitle,
    ogDescription: row?.ogDescription,
    ogMediaId: row?.ogMediaId,
  };
}

/** Keys the admin has excluded from sitemap.xml. */
export async function listingKeysOutOfSitemap(): Promise<Set<ListingKey>> {
  const map = await readMap();
  const out = new Set<ListingKey>();
  for (const k of LISTING_KEYS) {
    const id = map[k];
    if (!id) continue;
    const row = await db.seoMeta.findUnique({ where: { id }, select: { includeInSitemap: true, robotsIndex: true } }).catch(() => null);
    if (row && (!row.includeInSitemap || !row.robotsIndex)) out.add(k);
  }
  return out;
}
