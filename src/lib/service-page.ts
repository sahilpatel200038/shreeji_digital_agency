import { z } from "zod";
import { isSafeHref } from "@/lib/safe-url";

const text = (max: number, def: string) => z.string().trim().max(max).default(def);
const link = (def: string) => z.string().trim().max(300).default(def).refine((v) => v === "" || isSafeHref(v), "Use /path, #section or https:// link");
const flag = z.boolean().default(true);

/**
 * Per-service wording and section visibility for /services/[slug], stored in Service.pageOptions.
 * Every default is the wording the page used before this was editable, so a service without saved
 * options renders exactly as it always did.
 */
export const servicePageOptionsSchema = z.object({
  primaryLabel: text(40, "Get a free consultation"),
  primaryHref: link("#contact"),
  secondaryLabel: text(40, "See our work"),
  secondaryHref: link("/#work"),
  /** Empty = "About {service title}". */
  introTitle: text(120, ""),
  benefitsEyebrow: text(60, "Why it matters"),
  benefitsTitle: text(120, "What you gain"),
  includedEyebrow: text(60, "Scope"),
  includedTitle: text(120, "What is included"),
  includedText: text(300, "The exact scope is agreed with you before work starts."),
  processEyebrow: text(60, "Process"),
  processTitle: text(120, "How we deliver"),
  faqEyebrow: text(60, "FAQ"),
  faqTitle: text(120, "Questions about this service"),
  projectsEyebrow: text(60, "Related work"),
  projectsTitle: text(120, "Projects in this area"),
  relatedEyebrow: text(60, "Related services"),
  relatedTitle: text(120, "You may also need"),
  showIntro: flag,
  showBenefits: flag,
  showIncluded: flag,
  showContent: flag,
  showProcess: flag,
  showFaqs: flag,
  showProjects: flag,
  showRelated: flag,
});

export type ServicePageOptions = z.infer<typeof servicePageOptionsSchema>;

export const SERVICE_PAGE_DEFAULTS: ServicePageOptions = servicePageOptionsSchema.parse({});

/** Stored JSON merged with defaults. Invalid stored data falls back to defaults rather than breaking the page. */
export function readServicePageOptions(raw: unknown): ServicePageOptions {
  const parsed = servicePageOptionsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : SERVICE_PAGE_DEFAULTS;
}

export const SERVICE_SECTION_FLAGS = [
  ["showIntro", "Intro text"],
  ["showBenefits", "Why-it-matters cards"],
  ["showIncluded", "Scope checklist"],
  ["showContent", "Extra content blocks"],
  ["showProcess", "Delivery steps"],
  ["showFaqs", "FAQ list"],
  ["showProjects", "Projects list"],
  ["showRelated", "Services slider"],
] as const satisfies readonly (readonly [keyof ServicePageOptions, string])[];

/** Reads the "Page sections" fields of the service form. Unchecked boxes are absent from FormData, so they mean "hidden". */
export function servicePageOptionsFromForm(fd: FormData) {
  const raw: Record<string, unknown> = {};
  for (const key of Object.keys(SERVICE_PAGE_DEFAULTS) as (keyof ServicePageOptions)[]) {
    raw[key] = typeof SERVICE_PAGE_DEFAULTS[key] === "boolean" ? fd.get(`po_${key}`) === "on" : String(fd.get(`po_${key}`) ?? "");
  }
  return servicePageOptionsSchema.safeParse(raw);
}
