import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./helpers";

const CORE = [
  "Web Development & Design",
  "App Development & Design",
  "Custom Software Development",
  "Search Engine Optimization",
  "Digital Marketing",
  "Ads Management",
  "UGC Content Creation",
  "Social Media Marketing",
  "Influencer Marketing",
];

test.describe("site-wide updates", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route}: one enquiry section directly above the footer, no old CTA band`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("section#contact")).toHaveCount(1);
      await expect(page.locator("section#contact form")).toHaveCount(1);
      await expect(page.locator("section#contact").getByRole("heading", { name: "Send Us an Enquiry" })).toBeVisible();
      // The contact section is the element immediately before the footer.
      const prevIsContact = await page.evaluate(() => document.querySelector("footer")?.previousElementSibling?.id === "contact");
      expect(prevIsContact).toBe(true);
      await expect(page.getByText("Ready to grow your brand?", { exact: false })).toHaveCount(0);
    });
  }

  test("FAQ is not in the desktop or mobile header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "FAQ" })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "FAQ" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Contact" }).first()).toBeVisible();
  });

  test("home and services pages list all eight core services", async ({ page }) => {
    for (const route of ["/", "/services"]) {
      await page.goto(route);
      const section = page.locator("section[aria-labelledby]").filter({ has: page.getByRole("heading", { name: "Our Core Services" }) });
      await expect(section).toHaveCount(1);
      for (const title of CORE) await expect(section.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
  });

  test("footer service links are the eight core services", async ({ page }) => {
    await page.goto("/");
    for (const title of CORE) await expect(page.locator("footer").getByRole("link", { name: title, exact: true })).toBeVisible();
  });

  test("service pages have no FAQ section", async ({ page }) => {
    for (const route of PUBLIC_ROUTES.filter((r) => r.startsWith("/services/"))) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: /common questions/i })).toHaveCount(0);
      await expect(page.locator("[id=faq-title]")).toHaveCount(0);
    }
  });

  test("a service page preselects its service in the shared form", async ({ page }) => {
    await page.goto("/services/ads-management");
    await expect(page.getByLabel(/Service you are interested in/)).toHaveValue("Ads Management");
  });

  test("shared form validation: required fields and invalid email", async ({ page }) => {
    await page.goto("/about");
    await page.waitForTimeout(3300);
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.locator("#f-firstName-err")).toBeVisible();
    await expect(page.locator("#f-email-err")).toBeVisible();
    await expect(page.locator("#f-message-err")).toBeVisible();
    await page.getByLabel(/First name/).fill("Test");
    await page.getByLabel(/Email address/).fill("not-an-email");
    await page.getByLabel(/How can we help/).fill("Checking validation of the shared form.");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.locator("#f-email-err")).toBeVisible();
  });

  test("no horizontal scroll at 320, 768 and 1280", async ({ page }) => {
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ["/", "/services", "/services/ugc-content-creation", "/about", "/contact"]) {
        await page.goto(route);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} @${width}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe("header: Home instead of Work; Our Work slider", () => {
  test("desktop and mobile menus have Home and no Work", async ({ page }) => {
    await page.goto("/about");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Work", exact: true })).toHaveCount(0);
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/services");
    await page.setViewportSize({ width: 390, height: 800 });
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobile = page.getByRole("navigation", { name: "Mobile" });
    await expect(mobile.getByRole("link", { name: "Work", exact: true })).toHaveCount(0);
    await mobile.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("/work redirects to the homepage Our Work section", async ({ page }) => {
    await page.goto("/work");
    await expect(page).toHaveURL(/\/#work$/);
    await expect(page.locator("#work")).toBeVisible();
  });

  test("Our Work is the third-from-last block (two sections, then the footer) and lists every project", async ({ page }) => {
    await page.goto("/");
    const order = await page.evaluate(() => [...document.querySelectorAll("main > div > section, main > section, body section")].map((s) => s.id || s.getAttribute("aria-labelledby")));
    const idx = order.indexOf("work");
    expect(idx).toBeGreaterThan(-1);
    expect(order.slice(idx + 1)).toHaveLength(2);
    expect(order.slice(idx + 1)).toEqual(["faq-title", "contact"]);
    const { query } = await import("./db");
    const rows = await query<{ n: number }>("SELECT COUNT(*) n FROM Project WHERE status = 'PUBLISHED'");
    await expect(page.locator("#work .swiper-slide")).toHaveCount(Number(rows[0].n));
  });
});
