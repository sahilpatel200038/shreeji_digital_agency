import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { closeDb, query } from "./db";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./helpers";

export const AUTH_FILE = "test-results/admin-state.json";

export default async function globalSetup(config: FullConfig) {
  // Start every run without leftover throttling or fixtures from previous runs.
  await query("DELETE FROM RateLimit");
  await cleanup();
  mkdirSync("test-results", { recursive: true });

  // Log in once and reuse the session, so the suite does not trip the login throttle.
  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByRole("textbox", { name: /^Password/ }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
  await closeDb();
}

export async function cleanup() {
  await query("DELETE FROM Page WHERE slug LIKE 'e2e-%'");
  await query("DELETE FROM Post WHERE slug LIKE 'e2e-%'");
  await query("DELETE FROM Service WHERE slug LIKE 'e2e-%'");
  await query("DELETE FROM Redirect WHERE fromPath LIKE '/e2e-%' OR toPath LIKE '/e2e-%'");
  await query("DELETE FROM `Lead` WHERE email LIKE 'e2e-%'");
  await query("DELETE FROM Testimonial WHERE name LIKE 'E2E %'");
  await query("DELETE FROM Media WHERE folder = 'e2e'");
  await query("DELETE FROM User WHERE email LIKE 'e2e-%'");
  await query("DELETE FROM MenuItem WHERE label LIKE 'E2E %'");
  await query("DELETE FROM Project WHERE name LIKE 'E2E %'");
  await query("DELETE FROM Faq WHERE question LIKE 'E2E %'");
  await query("DELETE FROM TeamMember WHERE name LIKE 'E2E %'");
  await query("DELETE FROM EditLock");
  await query("DELETE FROM EditLockRequest");
}
