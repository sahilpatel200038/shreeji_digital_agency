import { describe, expect, it } from "vitest";
import { meaningfulImageDescription, serviceImageAlt, serviceImageTitle } from "@/lib/image-alt";
import { linkTitle } from "@/lib/link-title";
import { resolveBanner } from "@/lib/banner";

describe("meaningful image descriptions", () => {
  it("replaces missing and generic service media alt text with contextual descriptions", () => {
    expect(serviceImageAlt("digital-marketing", "Digital Marketing", "Digital Marketing: illustrative photo")).toBe(
      "Digital Marketing Services by Shreeji Digital Agency",
    );
    expect(serviceImageAlt("whatsapp-marketing", "WhatsApp Marketing")).toContain("messaging apps on a textured surface");
    expect(serviceImageAlt("app-development-design", "App Development & Design")).toContain("mobile app dashboard");
    expect(serviceImageAlt("google-business-profile-optimization", "Google Business Profile Optimization")).toContain("shop owner serving a customer");
    expect(serviceImageTitle("whatsapp-marketing", "WhatsApp Marketing")).toContain("WhatsApp and other messaging apps");
  });

  it("keeps descriptive source alt text and provides fallbacks for empty values", () => {
    expect(meaningfulImageDescription("A customer paying at a counter", "Fallback")).toBe("A customer paying at a counter");
    expect(meaningfulImageDescription("  ", "Shreeji Digital Agency Logo")).toBe("Shreeji Digital Agency Logo");
    expect(meaningfulImageDescription("Digital Marketing image", "Digital marketing campaign services")).toBe("Digital marketing campaign services");
  });

  it("uses the reviewed home banner title and accurate alt text after an image fallback", () => {
    const banner = resolveBanner("home");
    expect(banner.title).toBe("Digital Marketing Agency – Shreeji Digital Agency");
    expect(banner.fallbackAlt).toBe("A marketing team planning a campaign with sticky notes on a whiteboard");
  });
});

describe("destination-based link titles", () => {
  it.each([
    ["#main", "Skip to main content"],
    ["/#work", "View our work"],
    ["#process", "Go to Process section"],
    ["/services/seo", "SEO services"],
    ["mailto:info@shreejidigitalagency.com", "Email Shreeji Digital Agency"],
    ["tel:+919512494494", "Call Shreeji Digital Agency"],
    ["https://wa.me/919512494494", "Chat with Shreeji Digital Agency on WhatsApp"],
    ["https://www.instagram.com/shreeji_marketing__/", "Visit Shreeji Digital Agency on Instagram"],
  ])("returns an informative title for %s", (href, title) => {
    expect(linkTitle(href)).toBe(title);
  });
});
