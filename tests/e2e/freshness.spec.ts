import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { PUBLIC_ROUTES } from "./helpers";

test.describe("shared section structure: .container > .row", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route}: every section, banner and the footer use .container > .row`, async ({ page }) => {
      await page.goto(route);
      const bad = await page.evaluate(() =>
        [...document.querySelectorAll("section.section, header.section, footer.section, header.sticky")]
          .filter((el) => !el.querySelector(":scope > .container > .row"))
          .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].slice(0, 3).join(".")}`),
      );
      expect(bad, route).toEqual([]);
      const count = await page.locator("main section.section, main header.section").count();
      expect(count, route).toBeGreaterThanOrEqual(2);
      // one container width everywhere
      const widths = await page.evaluate(() => [...new Set([...document.querySelectorAll(".container")].map((c) => Math.round(c.getBoundingClientRect().width)))]);
      expect(widths, route).toHaveLength(1);
    });
  }
});

test.describe("admin edits reach the public site", () => {
  test.use({ storageState: AUTH_FILE });

  async function setTagline(page: Page, value: string | null) {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "General", exact: true }) });
    const field = card.getByLabel("Tagline");
    const original = await field.inputValue();
    await field.fill(value ?? original);
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");
    return original;
  }

  test("a visitor with the site already open sees an edit: on return to the tab, and on navigation after the cache window", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const stamp = `FRESH-${Date.now()}`;
    const visitor = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await visitor.goto("/");
    await visitor.getByRole("link", { name: "About", exact: true }).first().click();
    await expect(visitor).toHaveURL(/\/about/);
    await visitor.waitForTimeout(1500); // prefetches land in the browser cache

    const original = await setTagline(page, stamp);
    try {
      // A brand-new page load sees it straight away.
      const fresh = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
      await expect.poll(async () => { await fresh.goto("/", { waitUntil: "domcontentloaded" }); return (await fresh.content()).includes(stamp); }, { timeout: 15_000 }).toBe(true);

      // The open tab: leave and come back (simulated visibility change) refreshes the page in place.
      await visitor.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await visitor.waitForTimeout(10_500);
      await visitor.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await visitor.getByRole("link", { name: "Home", exact: true }).first().click();
      await expect(visitor).toHaveURL(/\/$/);
      await expect(visitor.locator("main")).toContainText(stamp, { timeout: 15_000 });
    } finally {
      await setTagline(page, original);
    }
  });

  test("client-side navigation shows fresh content once the 30s browser cache window has passed", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const stamp = `NAV-${Date.now()}`;
    const visitor = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    await visitor.goto("/about");
    await visitor.waitForTimeout(1500);
    const original = await setTagline(page, stamp);
    try {
      await visitor.waitForTimeout(31_000);
      await visitor.getByRole("link", { name: "Home", exact: true }).first().click();
      await expect(visitor).toHaveURL(/\/$/);
      await expect(visitor.locator("main")).toContainText(stamp, { timeout: 15_000 });
    } finally {
      await setTagline(page, original);
    }
  });

  test("project: create appears in the homepage slider, edit replaces the name, delete removes it; stays correct on revisit", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const name = `E2E Fresh ${Date.now().toString(36)}`;
    const renamed = `${name} renamed`;
    const visitor = await (await browser.newContext({ storageState: { cookies: [], origins: [] } })).newPage();
    const slider = () => visitor.locator("#work .swiper-slide");
    const seen = async (text: string) => {
      await visitor.goto("/", { waitUntil: "domcontentloaded" });
      return (await slider().filter({ hasText: text }).count()) > 0;
    };

    try {
      await page.goto("/admin/projects/new");
      await page.getByLabel("Project name").fill(name);
      await page.getByLabel("Scope tags").fill("E2E, Freshness");
      await page.getByRole("button", { name: "Create project" }).click();
      await expect(page).toHaveURL(/\/admin\/projects\/\d+/);

      await expect.poll(() => seen(name), { timeout: 20_000 }).toBe(true);

      // edit
      await page.getByLabel("Project name").fill(renamed);
      await page.getByRole("button", { name: "Save project" }).click();
      await expect(page.getByRole("status")).toBeVisible();
      await expect.poll(() => seen(renamed), { timeout: 20_000 }).toBe(true);
      expect(await slider().filter({ hasText: `${name}` }).filter({ hasNotText: "renamed" }).count()).toBe(0);

      // revisit through client-side navigation: still the new name
      await visitor.getByRole("link", { name: "Blog", exact: true }).first().click();
      await visitor.getByRole("link", { name: "Home", exact: true }).first().click();
      await expect(visitor.locator("#work")).toContainText(renamed);

      // delete through the admin UI, then it must be gone from the public slider
      await page.goto("/admin/projects");
      const row = page.getByRole("row", { name: new RegExp(renamed) });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(row).toHaveCount(0, { timeout: 15_000 });
      await expect.poll(() => seen(renamed), { timeout: 20_000 }).toBe(false);
    } finally {
      // safety net: never leave the test project behind if an assertion above failed
      await page.goto("/admin/projects");
      const leftover = page.getByRole("row", { name: /E2E Fresh/ });
      for (let i = 0; i < 3 && (await leftover.count()) > 0; i++) {
        await leftover.first().getByRole("button", { name: "Delete" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
        await expect(leftover).toHaveCount(0, { timeout: 15_000 });
        await page.goto("/admin/projects");
      }
    }
  });
});
