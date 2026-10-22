import { describe, expect, it } from "vitest";
import { readServicePageOptions, SERVICE_PAGE_DEFAULTS, servicePageOptionsFromForm } from "@/lib/service-page";
import { coerceContactForm, coerceHomeForm } from "@/lib/settings/forms";
import { SETTING_SCHEMAS } from "@/lib/settings/schema";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("service page options", () => {
  it("defaults to the wording the page always used", () => {
    expect(SERVICE_PAGE_DEFAULTS.primaryLabel).toBe("Get a free consultation");
    expect(SERVICE_PAGE_DEFAULTS.benefitsTitle).toBe("What you gain");
    expect(SERVICE_PAGE_DEFAULTS.processTitle).toBe("How we deliver");
    expect(Object.values(SERVICE_PAGE_DEFAULTS).filter((v) => typeof v === "boolean").every(Boolean)).toBe(true);
  });

  it("falls back to defaults for missing or corrupt stored data", () => {
    expect(readServicePageOptions(null)).toEqual(SERVICE_PAGE_DEFAULTS);
    expect(readServicePageOptions({ primaryHref: "javascript:alert(1)" })).toEqual(SERVICE_PAGE_DEFAULTS);
    expect(readServicePageOptions({ benefitsTitle: "Custom" }).benefitsTitle).toBe("Custom");
  });

  it("treats unticked section boxes as hidden and rejects unsafe links", () => {
    const hidden = servicePageOptionsFromForm(form({ po_primaryLabel: "Talk to us", po_primaryHref: "/contact", po_showBenefits: "on" }));
    expect(hidden.success && hidden.data.showBenefits).toBe(true);
    expect(hidden.success && hidden.data.showProcess).toBe(false);
    expect(hidden.success && hidden.data.primaryLabel).toBe("Talk to us");
    expect(servicePageOptionsFromForm(form({ po_primaryHref: "javascript:alert(1)" })).success).toBe(false);
  });
});

describe("home / contact form coercion", () => {
  it("keeps the section switches when the legacy Settings form (no switches) is saved", () => {
    const raw: Record<string, unknown> = { showFaq: false, aboutPills: ["A"] };
    coerceHomeForm(form({ headline: "Hello" }), raw);
    expect(raw.showFaq).toBe(false);
    expect(raw.aboutPills).toEqual(["A"]);
  });

  it("applies switches and pills from the dedicated Home screen", () => {
    const raw: Record<string, unknown> = {};
    coerceHomeForm(form({ sectionsForm: "1", showAbout: "on", aboutPills: "One\n\n Two \n" }), raw);
    const home = SETTING_SCHEMAS.home.parse(raw);
    expect(home.showAbout).toBe(true);
    expect(home.showFaq).toBe(false);
    expect(home.aboutPills).toEqual(["One", "Two"]);
  });

  it("only reads the services-strip switch from the Contact screen", () => {
    const legacy: Record<string, unknown> = { showServices: true };
    coerceContactForm(form({ phone: "1" }), legacy);
    expect(legacy.showServices).toBe(true);
    const screen: Record<string, unknown> = { showServices: true };
    coerceContactForm(form({ contactPageForm: "1" }), screen);
    expect(screen.showServices).toBe(false);
  });

  it("new settings fields default to the previous hard-coded wording", () => {
    const home = SETTING_SCHEMAS.home.parse({});
    expect(home.aboutButtonLabel).toBe("More about us");
    expect(home.aboutPills).toHaveLength(5);
    expect(SETTING_SCHEMAS.contact.parse({}).servicesTitle).toBe("How we can help");
  });
});
