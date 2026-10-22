/** Banner (hero) images: an admin-chosen media item, else the bundled photo for that page. */
export type BannerMedia = { id: number; checksum?: string | null; altText?: string | null } | null | undefined;

export type BannerKey = "home" | "about" | "contact" | "services" | "blog" | "faq" | "default";

const FALLBACKS: Record<BannerKey, { src: string; alt: string }> = {
  home: { src: "/images/banners/home.webp", alt: "A marketing team planning a campaign with sticky notes on a whiteboard" },
  about: { src: "/images/banners/about.webp", alt: "A team collaborating around a table with laptops" },
  contact: { src: "/images/banners/contact.webp", alt: "A classic telephone against a dark wall" },
  services: { src: "/images/banners/services.webp", alt: "A laptop showing a marketing analytics dashboard" },
  blog: { src: "/images/banners/blog.webp", alt: "A laptop, notebook and coffee on a writer's desk" },
  faq: { src: "/images/banners/faq.webp", alt: "Hand writing notes in a notebook" },
  default: { src: "/images/banners/default.webp", alt: "Colleagues celebrating a successful meeting" },
};

export type BannerImageData = { src: string; alt: string; fallbackSrc: string };

/** Page slugs that have their own bundled photo; any other CMS page uses the default. */
export function bannerKeyForSlug(slug: string): BannerKey {
  return slug === "about" || slug === "contact" ? slug : "default";
}

export function resolveBanner(key: BannerKey, media?: BannerMedia, alt?: string): BannerImageData {
  const fb = FALLBACKS[key];
  if (media) {
    return {
      src: `/media/${media.id}${media.checksum ? `?v=${media.checksum.slice(0, 8)}` : ""}`,
      alt: media.altText || alt || fb.alt,
      fallbackSrc: fb.src,
    };
  }
  return { src: fb.src, alt: fb.alt, fallbackSrc: fb.src };
}
