import { absoluteUrl } from "@/lib/env";
import type { SiteSettings } from "@/lib/settings/schema";

type Json = Record<string, unknown>;

/** Serialise JSON-LD safely for embedding in a <script> tag. */
export function jsonLdString(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function sameAs(s: SiteSettings): string[] {
  return Object.values(s.social).filter((v): v is string => typeof v === "string" && v.startsWith("https://"));
}

export function organizationSchema(s: SiteSettings, logoMediaId?: number | null): Json {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": absoluteUrl("/#organization"),
    name: s.general.siteName,
    legalName: s.general.legalName,
    url: absoluteUrl("/"),
    description: s.general.description,
    ...(logoMediaId ? { logo: absoluteUrl(`/media/${logoMediaId}`), image: absoluteUrl(`/media/${logoMediaId}`) } : {}),
    telephone: s.contact.phone,
    email: s.contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: s.contact.address,
      addressLocality: s.contact.locality,
      addressRegion: s.contact.region,
      addressCountry: s.contact.country,
    },
    areaServed: [s.contact.locality, "India"],
    sameAs: sameAs(s),
  };
}

export function websiteSchema(s: SiteSettings): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    url: absoluteUrl("/"),
    name: s.general.siteName,
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-IN",
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function serviceSchema(args: { name: string; description: string; path: string; categoryName?: string; s: SiteSettings }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
    serviceType: args.categoryName ?? args.name,
    provider: { "@id": absoluteUrl("/#organization") },
    areaServed: [args.s.contact.locality, "India"],
  };
}

export function faqSchema(items: { question: string; answer: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

export function blogPostingSchema(args: {
  headline: string;
  description: string;
  path: string;
  imageMediaId?: number | null;
  datePublished: Date | null;
  dateModified: Date;
  authorName: string;
  s: SiteSettings;
}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: args.headline,
    description: args.description,
    mainEntityOfPage: absoluteUrl(args.path),
    ...(args.imageMediaId ? { image: absoluteUrl(`/media/${args.imageMediaId}`) } : {}),
    datePublished: args.datePublished?.toISOString(),
    dateModified: args.dateModified.toISOString(),
    author: { "@type": "Person", name: args.authorName },
    publisher: { "@id": absoluteUrl("/#organization") },
    inLanguage: "en-IN",
  };
}

export function itemListSchema(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
  };
}

export function webPageSchema(type: "ContactPage" | "AboutPage" | "CollectionPage" | "WebPage", name: string, path: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": type,
    name,
    url: absoluteUrl(path),
    isPartOf: { "@id": absoluteUrl("/#website") },
  };
}
