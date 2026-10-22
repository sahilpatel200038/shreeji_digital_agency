import type { Metadata } from "next";
import { absoluteUrl, allowIndexing } from "@/lib/env";
import { getSettings } from "@/lib/settings/get";
import { truncate } from "@/lib/utils";

export type SeoInput = {
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogMediaId?: number | null;
} | null;

type Args = {
  seo?: SeoInput;
  fallbackTitle: string;
  fallbackDescription?: string;
  path: string;
  imageMediaId?: number | null;
  type?: "website" | "article";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
  /** Force noindex regardless of seo settings (filters, search results...). */
  noindex?: boolean;
};

export async function buildMetadata(args: Args): Promise<Metadata> {
  const s = await getSettings();
  const seo = args.seo ?? null;
  const title = seo?.title?.trim() || s.seo.titleTemplate.replace("%s", args.fallbackTitle);
  const description = truncate(
    seo?.description?.trim() || args.fallbackDescription?.trim() || s.seo.defaultDescription,
    300,
  );
  const canonical = seo?.canonicalUrl?.trim() || absoluteUrl(args.path);
  const index = allowIndexing && !args.noindex && (seo?.robotsIndex ?? true);
  const follow = allowIndexing && !args.noindex && (seo?.robotsFollow ?? true);
  const imageId = seo?.ogMediaId ?? args.imageMediaId ?? s.seo.ogMediaId;
  const images = imageId ? [{ url: absoluteUrl(`/media/${imageId}`) }] : undefined;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    robots: { index, follow },
    openGraph: {
      type: args.type ?? "website",
      siteName: s.general.siteName,
      locale: "en_IN",
      url: canonical,
      title: seo?.ogTitle?.trim() || title,
      description: seo?.ogDescription?.trim() || description,
      images,
      ...(args.type === "article"
        ? {
            publishedTime: args.publishedTime?.toISOString(),
            modifiedTime: args.modifiedTime?.toISOString(),
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: seo?.ogTitle?.trim() || title,
      description: seo?.ogDescription?.trim() || description,
      images: images?.map((i) => i.url),
    },
  };
}
