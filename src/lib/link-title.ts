import { siteUrl } from "@/lib/env";

const INTERNAL_ORIGIN = new URL(siteUrl).origin;

const PAGE_TITLES: Record<string, string> = {
  "/": "Shreeji Digital Agency homepage",
  "/about": "About Shreeji Digital Agency",
  "/blog": "Shreeji Digital Agency blog",
  "/contact": "Contact Shreeji Digital Agency",
  "/cookie-policy": "Cookie policy",
  "/faq": "Frequently asked questions",
  "/privacy-policy": "Privacy policy",
  "/services": "Shreeji Digital Agency services",
  "/terms-and-conditions": "Terms and conditions",
};

const UPPERCASE_TERMS = new Set(["api", "seo", "ugc", "ui", "ux"]);

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => (UPPERCASE_TERMS.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

export function linkTitle(href: string, context?: string): string {
  if (!href.trim()) return context ? `Open ${context}` : "Open link";
  if (/^mailto:/i.test(href)) return "Email Shreeji Digital Agency";
  if (/^tel:/i.test(href)) return "Call Shreeji Digital Agency";

  let destination: URL;
  try {
    destination = new URL(href, INTERNAL_ORIGIN);
  } catch {
    return context ? `Open ${context}` : "Open link";
  }

  if (destination.hostname === "wa.me" || destination.hostname.endsWith(".whatsapp.com")) {
    return "Chat with Shreeji Digital Agency on WhatsApp";
  }

  const socialPlatforms: Record<string, string> = {
    "facebook.com": "Facebook",
    "instagram.com": "Instagram",
    "linkedin.com": "LinkedIn",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "x.com": "X",
    "twitter.com": "X",
  };
  const socialHost = Object.keys(socialPlatforms).find(
    (host) => destination.hostname === host || destination.hostname.endsWith(`.${host}`),
  );
  if (socialHost) return `Visit Shreeji Digital Agency on ${socialPlatforms[socialHost]}`;

  if (destination.hostname.includes("google.") && destination.pathname.includes("/maps")) {
    return "View Shreeji Digital Agency on Google Maps";
  }

  if (destination.origin !== INTERNAL_ORIGIN) {
    return context ? `Visit ${context}` : `Visit ${destination.hostname}`;
  }

  const { pathname, hash } = destination;
  if (hash === "#main") return "Skip to main content";
  if (hash === "#work") return "View our work";
  if (hash === "#contact") return "Go to the contact form";
  if (hash === "#services") return "View our services";
  if (hash) return context ? `Go to ${context}` : `Go to ${titleFromSlug(hash.slice(1))} section`;

  const pageTitle = PAGE_TITLES[pathname];
  if (pageTitle) return pageTitle;
  if (pathname.startsWith("/services/")) return `${titleFromSlug(pathname.slice("/services/".length))} services`;
  if (pathname.startsWith("/blog/category/")) {
    return `Browse ${titleFromSlug(pathname.slice("/blog/category/".length))} articles`;
  }
  if (pathname.startsWith("/blog/")) return `Read ${titleFromSlug(pathname.slice("/blog/".length))} article`;

  return context ? `Go to ${context}` : `Open ${titleFromSlug(pathname.replace(/^\/+|\/+$/g, "")) || "page"}`;
}
