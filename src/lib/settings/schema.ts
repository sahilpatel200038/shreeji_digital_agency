import { z } from "zod";
import { isSafeHref } from "@/lib/safe-url";
import { parseVideoUrl } from "@/lib/video";

const text = (max: number, def = "") => z.string().trim().max(max).default(def);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || /^https:\/\//i.test(v), "Must be an https:// URL");

export const generalSchema = z.object({
  siteName: text(80, "Shreeji Marketing"),
  legalName: text(120, "Shreeji Digital Agency"),
  tagline: text(120, "Digital Solution, Real Growth"),
  description: text(300, "Shreeji Marketing is a digital marketing and web development agency in Ahmedabad, India, offering brand strategy, SEO, lead generation, web and app development, and creative production."),
  footerBlurb: text(300, "A digital marketing and web development agency focused on clear strategy, honest reporting and growth you can measure."),
  copyright: text(160, "Shreeji Marketing. All rights reserved."),
});

export const contactSchema = z.object({
  phone: text(40, "+91 9512494494"),
  email: z.string().trim().max(190).default("info@shreejidigitalagency.com"),
  address: text(300, "3, Shreemad Elegance, Nr Kanba Hospital, Nikol, Ahmedabad, Gujarat, India"),
  locality: text(80, "Nikol, Ahmedabad"),
  region: text(80, "Gujarat"),
  country: text(2, "IN"),
  mapsUrl: optionalUrl,
  hours: text(200, ""),
  sectionEyebrow: text(60, "Contact us"),
  intro: text(400, "Tell us about your business and what you want to achieve. We will reply to arrange a free 30-minute consultation. No commitment required."),
  formTitle: text(80, "Send Us an Enquiry"),
  /** WhatsApp business number in international format. Empty = no floating WhatsApp button. */
  whatsapp: z
    .string()
    .trim()
    .max(24)
    .default("")
    .refine(
      (v) => v === "" || (/^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, "").length >= 8 && v.replace(/\D/g, "").length <= 15),
      "Enter a number with country code, e.g. +91 98765 43210",
    ),
  whatsappMessage: text(300, "Hello Shreeji Marketing, I would like to know more about your services."),
  /** Contact page (/contact) banner label and the strip of services under the form. */
  pageEyebrow: text(60, "Get in touch"),
  showServices: z.boolean().default(true),
  servicesTitle: text(120, "How we can help"),
  servicesText: text(300, "Tell us which of these you need in the form below."),
  /** Labels of the three contact details, shown in the enquiry section on every page. */
  visitLabel: text(40, "Visit us"),
  callLabel: text(40, "Call us"),
  emailLabel: text(40, "Email us"),
  mapsLabel: text(60, "Open in Google Maps"),
  hoursLabel: text(40, "Opening hours"),
});

export const socialSchema = z.object({
  instagram: optionalUrl.default("https://www.instagram.com/shreeji_marketing__"),
  facebook: optionalUrl.default("https://www.facebook.com/share/1BV2MHv8kr/"),
  linkedin: optionalUrl,
  youtube: optionalUrl,
  x: optionalUrl,
});

const titleText = z.object({ title: z.string().trim().max(80), text: z.string().trim().max(300) });

export const DEFAULT_WHY_US = [
  { title: "A dedicated team", text: "The same strategists, creatives and analysts stay with your account, so you are not re-explaining your business every month." },
  { title: "Strategy, creative and tech together", text: "Brand, marketing, design and web development under one roof keeps messaging and execution consistent." },
  { title: "Transparent reporting", text: "A live dashboard, weekly email updates and a monthly strategy call show you what is working." },
  { title: "Honest expectations", text: "We set realistic goals and timelines up front, and we never promise guaranteed rankings or results." },
];

export const DEFAULT_PROCESS = [
  { title: "Discovery", text: "An audit of your brand, market, competitors and opportunities." },
  { title: "Strategy", text: "A marketing blueprint with objectives, KPIs and creative direction." },
  { title: "Execution", text: "Campaigns launch and are optimised across channels as results come in." },
  { title: "Growth", text: "Ongoing analysis, iteration and scaling of what works." },
];

const safeLink = (def: string) =>
  z.string().trim().max(300).default(def).refine((v) => v === "" || isSafeHref(v), "Use /path, #section or https:// link");

const videoUrl = z
  .string()
  .trim()
  .max(500)
  .default("")
  .refine((v) => v === "" || parseVideoUrl(v) !== null, "Use an https:// YouTube or Vimeo link, a direct .mp4/.webm file, or an uploaded video");

export const DEFAULT_VIDEOS = [
  { title: "Project walkthrough", text: "A look at how we plan and deliver a campaign for our clients.", url: "" },
  { title: "Behind the work", text: "The team, the process and the results behind a recent project.", url: "" },
];

const flagOn = z.boolean().default(true);

export const DEFAULT_ABOUT_PILLS = ["Brand Strategy", "Digital Marketing", "Media Planning", "Creative Direction", "Analytics"];

export const homeSchema = z.object({
  /** Section visibility. The hero is always shown. */
  showAbout: flagOn,
  showServices: flagOn,
  showProcess: flagOn,
  showTestimonials: flagOn,
  showVideos: flagOn,
  showWork: flagOn,
  showFaq: flagOn,
  heroImageAlt: text(160, ""),
  aboutPills: z.array(z.string().trim().min(1).max(40)).max(8).default(DEFAULT_ABOUT_PILLS),
  aboutButtonLabel: text(40, "More about us"),
  aboutButtonHref: safeLink("/about"),
  servicesButtonLabel: text(40, "View all services"),
  processEyebrow: text(60, "How we work"),
  testimonialsEyebrow: text(60, "Clients"),
  faqEyebrow: text(60, "FAQ"),
  faqButtonLabel: text(40, "More questions"),
  aboutTitle: text(120, "Precision strategy. Unmatched results."),
  aboutText: text(400, "We are a digital marketing and web development agency in Ahmedabad. Strategists, creatives and analysts work together so the plan, the creative and the measurement stay connected."),
  whyUs: z.array(titleText).max(4).default(DEFAULT_WHY_US),
  processTitle: text(160, "A clear process from first call to ongoing growth"),
  process: z.array(titleText).max(6).default(DEFAULT_PROCESS),
  aboutEyebrow: text(60, "About us"),
  ctaPrimaryLabel: text(40, "Start Your Journey"),
  ctaPrimaryHref: safeLink("/contact"),
  ctaSecondaryLabel: text(40, "View Our Work"),
  ctaSecondaryHref: safeLink("#work"),
  servicesTitle: text(120, "Our Core Services"),
  servicesText: text(300, "Marketing, design and technology from one team, so every piece works together."),
  testimonialsTitle: text(120, "What clients say"),
  workTitle: text(120, "Projects we have delivered"),
  workText: text(300, "A selection of marketing and development work for our clients."),
  faqTitle: text(120, "Questions we are often asked"),
  videosEyebrow: text(60, "Work showcase"),
  videosTitle: text(120, "My Work in Action"),
  videosText: text(300, "Two short videos showing the projects and the work we do for our clients."),
  /** Exactly two cards; an empty url shows a "coming soon" placeholder. */
  videos: z.array(z.object({ title: z.string().trim().max(80), text: z.string().trim().max(200), url: videoUrl })).max(2).default(DEFAULT_VIDEOS),
  eyebrow: text(80, "Premium Marketing Agency"),
  headline: text(120, "Where Brands Command Attention"),
  subheadline: text(300, "Strategic marketing, design and technology that turns attention into measurable business growth."),
  showStats: z.boolean().default(false),
  stats: z
    .array(z.object({ label: z.string().trim().max(80), value: z.number().min(0).max(1_000_000), suffix: z.string().trim().max(8).default("") }))
    .max(6)
    .default([]),
});

const mediaId = z.number().int().positive().nullable().default(null);

/**
 * Banner (hero) content for the pages that are not CMS records. An empty image = the bundled photo for that page;
 * headings and intros default to the original wording.
 */
export const bannersSchema = z.object({
  home: mediaId,
  services: mediaId,
  blog: mediaId,
  faq: mediaId,
  /** About page: the photo beside the company profile text. Empty = the bundled office photo. */
  aboutProfile: mediaId,
  servicesTitle: text(120, "Services built around your growth"),
  servicesText: text(300, "Marketing, design and technology from one team, planned around your goals and reported on clearly."),
  aboutEyebrow: text(60, "Who we are"),
  teamEyebrow: text(60, "Leadership"),
  teamTitle: text(120, "Meet our leadership team"),
  aboutWorkTitle: text(120, "Work we are proud of"),
  aboutWorkText: text(300, "A selection of marketing and development projects for our clients."),
  blogTitle: text(120, "Insights for growing businesses"),
  blogText: text(300, "Practical guidance on marketing, SEO, branding and web development."),
  faqTitle: text(120, "Frequently asked questions"),
  faqText: text(300, "Quick answers about how we work. Cannot find yours? Ask us."),
  /** Wording of the listing pages' own sections (banner label, section headings, call-to-action band). */
  servicesEyebrow: text(60, "Our services"),
  servicesCoreEyebrow: text(60, "What we do"),
  servicesCoreTitle: text(120, "Our Core Services"),
  servicesMoreEyebrow: text(60, "Also available"),
  servicesMoreTitle: text(120, "More ways we can help"),
  blogEyebrow: text(60, "Our blog"),
  blogServicesTitle: text(120, "Services that grow your brand"),
  blogServicesText: text(300, "Put these articles into practice with our team."),
  faqEyebrow: text(60, "FAQ"),
  faqCtaTitle: text(120, "Still have a question?"),
  faqCtaText: text(300, "Send us a message and we will reply with a clear answer."),
  faqCtaLabel: text(40, "Contact us"),
  faqServicesTitle: text(120, "Explore our services"),
  /** Services slider under the text of standard CMS pages (privacy, terms, ...). */
  pageServicesTitle: text(120, "Our core services"),
});

/** The site header. Empty logo = the bundled mark; the navigation links themselves are the "header" menu. */
export const headerSchema = z.object({
  logoMediaId: mediaId,
  /** Text lock-up beside the logo, two lines. */
  brandName: text(30, "SHREEJI"),
  brandTagline: text(30, "MARKETING"),
  showCta: z.boolean().default(true),
  ctaLabel: text(40, "Book Free Consultation"),
  ctaHref: safeLink("/contact"),
  ctaNewTab: z.boolean().default(false),
});

/**
 * The site footer. The description, tagline and copyright live in `general`, phone/email/address in `contact`,
 * social links in `social` and the link lists in the footer menus; Admin > Footer edits all of them in one place.
 */
export const footerSchema = z.object({
  logoMediaId: mediaId,
  brandName: text(30, "SHREEJI"),
  brandTagline: text(30, "MARKETING"),
  servicesHeading: text(40, "Services"),
  companyHeading: text(40, "Company"),
  contactHeading: text(40, "Contact"),
  showServices: flagOn,
  /** How many main services the footer lists (0 hides none; use showServices to hide the column). */
  servicesLimit: z.number().int().min(1).max(30).default(12),
  showContact: flagOn,
  showSocial: flagOn,
  /** Small line at the bottom right. Empty hides it. */
  bottomLine: text(120, "Strategy · Story · Scale"),
});

export const analyticsSchema = z.object({
  ga4: z.string().trim().default("").refine((v) => v === "" || /^G-[A-Z0-9]{4,20}$/.test(v), "Format: G-XXXXXXXXXX"),
  gtm: z.string().trim().default("").refine((v) => v === "" || /^GTM-[A-Z0-9]{4,12}$/.test(v), "Format: GTM-XXXXXXX"),
  gscToken: z.string().trim().default("").refine((v) => v === "" || /^[A-Za-z0-9_-]{10,100}$/.test(v), "Letters, numbers, - and _ only"),
});

export const seoDefaultsSchema = z.object({
  titleTemplate: text(100, "%s | Shreeji Marketing"),
  defaultTitle: text(120, "Shreeji Marketing - Digital Marketing & Web Development Agency in Ahmedabad"),
  defaultDescription: text(300, "Brand strategy, digital marketing, SEO, lead generation and web development from Shreeji Marketing in Ahmedabad. Book a free consultation."),
  ogMediaId: z.number().int().positive().nullable().default(null),
});

export const SETTING_SCHEMAS = {
  general: generalSchema,
  contact: contactSchema,
  social: socialSchema,
  home: homeSchema,
  banners: bannersSchema,
  header: headerSchema,
  footer: footerSchema,
  analytics: analyticsSchema,
  seo: seoDefaultsSchema,
} as const;

export type SettingGroup = keyof typeof SETTING_SCHEMAS;

export type SiteSettings = {
  general: z.infer<typeof generalSchema>;
  contact: z.infer<typeof contactSchema>;
  social: z.infer<typeof socialSchema>;
  home: z.infer<typeof homeSchema>;
  banners: z.infer<typeof bannersSchema>;
  header: z.infer<typeof headerSchema>;
  footer: z.infer<typeof footerSchema>;
  analytics: z.infer<typeof analyticsSchema>;
  seo: z.infer<typeof seoDefaultsSchema>;
};

export const isSafeSocial = isSafeHref;
