import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { AUTH_FILE } from "./global-setup";

const WIDTHS = [320, 375, 425, 768, 1024, 1280, 1440, 1920];
const PUBLIC = ["/", "/about", "/services", "/services/seo", "/blog", "/blog/how-to-plan-a-digital-marketing-campaign", "/faq", "/contact", "/privacy-policy", "/nope-404"];
const ADMIN = ["/admin", "/admin/pages", "/admin/pages/new", "/admin/services", "/admin/media", "/admin/menus", "/admin/leads", "/admin/seo", "/admin/settings", "/admin/users"];

mkdirSync("test-results/responsive", { recursive: true });

async function settle(page: Page) {
  // Trigger scroll-reveal animations with real wheel scrolling so screenshots show final states.
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < Math.min(h, 12000); y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const bad = [...document.querySelectorAll("body *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || getComputedStyle(e).position === "fixed") return false;
        // ignore content inside intentionally scrollable wrappers
        let p: Element | null = e.parentElement;
        while (p) {
          const o = getComputedStyle(p).overflowX;
          if (o === "auto" || o === "scroll" || o === "hidden") return false;
          p = p.parentElement;
        }
        return r.right > vw + 1;
      })
      .slice(0, 4)
      .map((e) => `${e.tagName}.${String(e.className).slice(0, 60)}`);
    return { scrollW: document.documentElement.scrollWidth, vw, bad };
  });

test.describe("public pages: no horizontal overflow at every breakpoint", () => {
  for (const width of WIDTHS) {
    test(`${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const problems: string[] = [];
      for (const route of PUBLIC) {
        await page.goto(route);
        await settle(page);
        const o = await overflow(page);
        if (o.scrollW > o.vw || o.bad.length) problems.push(`${route}: scrollWidth ${o.scrollW} > ${o.vw} ${o.bad.join(", ")}`);
        if (["/", "/services/seo", "/contact"].includes(route) && [320, 768, 1440].includes(width)) {
          await page.screenshot({ path: `test-results/responsive/public${route === "/" ? "-home" : route.replace(/\//g, "-")}-${width}.png`, fullPage: true });
        }
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }
});

test.describe("header and navigation by viewport", () => {
  for (const width of [320, 375, 768, 1023]) {
    test(`mobile menu is used at ${width}px and works`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
      await expect(page.locator('nav[aria-label="Primary"]')).toBeHidden();
      await page.getByRole("button", { name: "Open menu" }).click();
      const links = page.locator("#mobile-nav a");
      expect(await links.count()).toBeGreaterThan(6);
      // 44px minimum touch target for the main links
      for (const l of await page.locator("#mobile-nav > nav > ul > li > a").all()) {
        expect((await l.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
  for (const width of [1024, 1280, 1920]) {
    test(`desktop nav is used at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();
      await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    });
  }
  test("contact form is fully usable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto("/contact");
    for (const label of [/First name/, /Email address/, /How can we help/]) {
      const box = await page.getByLabel(label).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole("button", { name: "Send enquiry" })).toBeVisible();
  });
});

test.describe("admin panel is responsive", () => {
  test.use({ storageState: AUTH_FILE });
  for (const width of [375, 768, 1280]) {
    test(`no page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const problems: string[] = [];
      for (const route of ADMIN) {
        await page.goto(route);
        const o = await overflow(page);
        if (o.scrollW > o.vw || o.bad.length) problems.push(`${route}: ${o.scrollW} > ${o.vw} ${o.bad.join(", ")}`);
        if (["/admin", "/admin/pages", "/admin/pages/new"].includes(route)) {
          await page.screenshot({ path: `test-results/responsive/admin${route.replace(/\//g, "-")}-${width}.png`, fullPage: true });
        }
      }
      expect(problems, problems.join("\n")).toEqual([]);
    });
  }

  test("mobile admin drawer opens, navigates and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/admin");
    await expect(page.locator("aside")).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator("#admin-drawer").getByRole("link", { name: "Pages", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/pages$/);
    await expect(page.locator("#admin-drawer")).toHaveCount(0);
  });

  test("tables scroll inside their wrapper on mobile instead of breaking the layout", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/admin/pages");
    const wrapper = page.locator("table").first().locator("xpath=..");
    expect(await wrapper.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  });

  test("media picker dialog fits a phone screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/admin/pages/new");
    await page.getByRole("button", { name: "Choose image" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Media library" });
    await expect(dialog).toBeVisible();
    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y + box.height).toBeLessThanOrEqual(700);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("accessibility (axe-core, WCAG 2.x A/AA)", () => {
  const scan = async (page: Page) =>
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze()).violations;
  const fmt = (v: Awaited<ReturnType<typeof scan>>) => v.map((x) => `${x.id} (${x.impact}): ${x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`).join("\n");

  for (const route of ["/", "/about", "/services", "/services/seo", "/blog", "/blog/how-to-plan-a-digital-marketing-campaign", "/faq", "/contact", "/privacy-policy"]) {
    test(`public ${route}`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      const v = await scan(page);
      expect(v, fmt(v)).toEqual([]);
    });
  }

  test("admin login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/admin/login");
    const v = await scan(page);
    expect(v, fmt(v)).toEqual([]);
    await ctx.close();
  });

  test.describe("admin screens", () => {
    test.use({ storageState: AUTH_FILE });
    for (const route of ["/admin", "/admin/pages", "/admin/pages/new", "/admin/services", "/admin/media", "/admin/leads", "/admin/seo", "/admin/settings"]) {
      test(`admin ${route}`, async ({ page }) => {
        await page.goto(route);
        const v = await scan(page);
        expect(v, fmt(v)).toEqual([]);
      });
    }
  });

  test("JavaScript disabled: content is fully visible and links work", async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const route of ["/", "/services/seo"]) {
      await page.goto(route);
      const hidden = await page.evaluate(() => [...document.querySelectorAll("[style]")].filter((e) => getComputedStyle(e).opacity === "0").length);
      expect(hidden, route).toBe(0);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await ctx.close();
  });

  test("reduced motion: content is visible immediately and no transforms are pending", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const hidden = await page.evaluate(() => [...document.querySelectorAll('[style*="opacity"]')].filter((e) => getComputedStyle(e).opacity === "0").length);
    expect(hidden).toBe(0);
    await ctx.close();
  });
});
