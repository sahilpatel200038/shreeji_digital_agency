import type { MetadataRoute } from "next";
import { absoluteUrl, allowIndexing } from "@/lib/env";
import { LISTING_PAGES, listingKeysOutOfSitemap } from "@/lib/seo/listing";
import { getSitemapEntries } from "@/lib/data/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!allowIndexing) return [];
  const { pages, services, posts, categories } = await getSitemapEntries();
  const hidden = await listingKeysOutOfSitemap();
  const fixed = (["home", "services", "blog", "faq"] as const).filter((k) => !hidden.has(k)).map((k) => LISTING_PAGES[k].path).map((p) => ({
    url: absoluteUrl(p),
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1 : 0.8,
  }));
  return [
    ...fixed,
    ...services.map((s) => ({ url: absoluteUrl(`/services/${s.slug}`), lastModified: s.updatedAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...pages
      .filter((p) => !["home", "faq"].includes(p.slug))
      .map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...categories.map((c) => ({ url: absoluteUrl(`/blog/category/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.4 })),
  ];
}
