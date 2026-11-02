const SERVICE_IMAGE_ALTS: Record<string, string> = {
  "digital-marketing": "Digital Marketing Services by Shreeji Digital Agency",
  "influencer-marketing": "Influencer Marketing Services",
  seo: "Search Engine Optimization Services",
  "web-development-design": "Website and Mobile App Development Services",
  "custom-software-development": "Custom Software Development Services",
  "ads-management": "Google and Meta Ads Management Services",
  "ugc-content-creation": "User Generated Content Creation Services",
  "social-media-marketing": "Social Media Marketing Services",
  "app-development-design": "A hand holding a smartphone displaying a mobile app dashboard, with a laptop and monitor in the background",
  "whatsapp-marketing": "A smartphone displaying WhatsApp and other messaging apps on a textured surface",
  "google-business-profile-optimization": "A shop owner serving a customer at a local store counter while the customer holds a smartphone",
};

const SERVICE_IMAGE_TITLES: Record<string, string> = {
  "app-development-design": "Mobile app dashboard displayed on a smartphone",
  "whatsapp-marketing": "Smartphone displaying WhatsApp and other messaging apps",
  "google-business-profile-optimization": "Shop owner serving a customer at a local store counter",
};

const GENERIC_IMAGE_DESCRIPTION = /^(?:image|photo|picture|illustration|illustrative photo)$|:\s*illustrative photo$|\s+(?:image|photo|picture|illustration)$/i;

export function meaningfulImageDescription(value: string | null | undefined, fallback: string): string {
  const description = value?.trim();
  return description && !GENERIC_IMAGE_DESCRIPTION.test(description) ? description : fallback;
}

export function serviceImageAlt(slug: string, title: string, currentAlt?: string | null): string {
  return meaningfulImageDescription(currentAlt, SERVICE_IMAGE_ALTS[slug] ?? `${title} services by Shreeji Digital Agency`);
}

export function serviceImageTitle(slug: string, title: string, currentTitle?: string | null): string {
  return meaningfulImageDescription(currentTitle, SERVICE_IMAGE_TITLES[slug] ?? `${title} services`);
}
