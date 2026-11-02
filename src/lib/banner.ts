import { meaningfulImageDescription } from "@/lib/image-alt";

/** Banner (hero) images: an admin-chosen media item, else the bundled photo for that page. */
export type BannerMedia = { id: number; checksum?: string | null; altText?: string | null; title?: string | null } | null | undefined;

export type BannerKey = "home" | "about" | "contact" | "services" | "blog" | "faq" | "default";

const FALLBACKS: Record<BannerKey, { src: string; alt: string; title: string }> = {
  home: {
    src: "/images/banners/home.webp",
    alt: "A marketing team planning a campaign with sticky notes on a whiteboard",
    title: "Digital Marketing Agency – Shreeji Digital Agency",
  },
  about: { src: "/images/banners/about.webp", alt: "A team collaborating around a table with laptops", title: "Shreeji Digital Agency team collaboration" },
  contact: { src: "/images/banners/contact.webp", alt: "A classic telephone against a dark wall", title: "Contact Shreeji Digital Agency" },
  services: { src: "/images/banners/services.webp", alt: "A laptop showing a marketing analytics dashboard", title: "Digital marketing and development services" },
  blog: { src: "/images/banners/blog.webp", alt: "A laptop, notebook and coffee on a writer's desk", title: "Shreeji Digital Agency blog" },
  faq: { src: "/images/banners/faq.webp", alt: "Hand writing notes in a notebook", title: "Shreeji Digital Agency frequently asked questions" },
  default: { src: "/images/banners/default.webp", alt: "Colleagues celebrating a successful meeting", title: "Shreeji Digital Agency" },
};

export type BannerImageData = {
  src: string;
  alt: string;
  title: string;
  fallbackSrc: string;
  fallbackAlt: string;
  fallbackTitle: string;
};

/** Page slugs that have their own bundled photo; any other CMS page uses the default. */
export function bannerKeyForSlug(slug: string): BannerKey {
  return slug === "about" || slug === "contact" ? slug : "default";
}

export function resolveBanner(key: BannerKey, media?: BannerMedia, alt?: string, title?: string): BannerImageData {
  const fb = FALLBACKS[key];
  if (media) {
    const imageAlt = meaningfulImageDescription(media.altText, alt || fb.alt);
    return {
      src: `/media/${media.id}${media.checksum ? `?v=${media.checksum.slice(0, 8)}` : ""}`,
      alt: imageAlt,
      title: meaningfulImageDescription(media.title, title || imageAlt),
      fallbackSrc: fb.src,
      fallbackAlt: fb.alt,
      fallbackTitle: fb.title,
    };
  }
  return { src: fb.src, alt: fb.alt, title: fb.title, fallbackSrc: fb.src, fallbackAlt: fb.alt, fallbackTitle: fb.title };
}
