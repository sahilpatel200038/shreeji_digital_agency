import { expect, type Page } from "@playwright/test";

export const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@shreeji.local";
export const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ShreejiAdmin#2026!";

export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: /^Password/ }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function loginOk(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
}

/** A 1x1 transparent PNG. */
export const TINY_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

export const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/services",
  "/services/brand-strategy",
  "/services/digital-marketing",
  "/services/media-planning",
  "/services/creative-production",
  "/services/influencer-marketing",
  "/services/analytics-insights",
  "/services/lead-generation",
  "/services/seo",
  "/services/web-development-design",
  "/services/app-development-design",
  "/services/whatsapp-marketing",
  "/services/google-business-profile-optimization",
  "/services/custom-software-development",
  "/services/ads-management",
  "/services/ugc-content-creation",
  "/services/social-media-marketing",
  "/services/web-hosting",
  "/services/ui-ux-graphics-design",
  "/blog",
  "/blog/how-to-plan-a-digital-marketing-campaign",
  "/blog/category/seo",
  "/faq",
  "/contact",
  "/privacy-policy",
  "/terms-and-conditions",
  "/cookie-policy",
];

/** Visible alert boxes, excluding Next.js's hidden route announcer (which also has role="alert"). */
export const alertOf = (p: Page) => p.locator('[role="alert"]:not(#__next-route-announcer__)');
