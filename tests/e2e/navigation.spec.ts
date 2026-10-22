import { expect, test } from "@playwright/test";

test.describe("navigation behaviour", () => {
  test("desktop: choosing a services submenu item closes the dropdown and opens the page at the top", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/about");
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Services" }).hover();
    const item = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Search Engine Optimization", exact: true });
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/services\/seo$/);
    await expect(item).toBeHidden(); // dropdown closed although the pointer is still over it
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("mobile: menu closes on choosing a link, including the current page, and the new page starts at the top", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.getByRole("button", { name: "Open menu" }).click();
    const mobile = page.getByRole("navigation", { name: "Mobile" });
    await mobile.getByRole("link", { name: "Search Engine Optimization", exact: true }).click();
    await expect(page).toHaveURL(/\/services\/seo$/);
    await expect(mobile).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    // link to the page we are already on
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.getByRole("button", { name: "Open menu" }).click();
    await mobile.getByRole("link", { name: "Search Engine Optimization", exact: true }).click();
    await expect(mobile).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("a link in the page body also lands at the top of the next page", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/blog");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("link", { name: "Contact", exact: true }).first().click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test.describe("page transitions", () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  const nav = (page: import("@playwright/test").Page, name: string) => page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name, exact: true });

  test("moving between pages is a client-side navigation (no reload) and back/forward work", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
    for (const [name, url] of [["About", /\/about$/], ["Blog", /\/blog$/], ["Contact", /\/contact$/], ["Home", /\/$/]] as const) {
      await nav(page, name).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator("main h1")).toBeVisible();
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/contact$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/blog$/);
    await page.goForward();
    await expect(page).toHaveURL(/\/contact$/);
    expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept), "page was fully reloaded").toBe(1);
  });

  test("no blank or half-faded frames while navigating between banner pages", async ({ page }) => {
    await page.goto("/about");
    await page.evaluate(() => {
      const w = window as unknown as { __bad: string[] };
      w.__bad = [];
      const tick = () => {
        const main = document.querySelector("main");
        const banner = main?.querySelector(".section--banner");
        const h1 = banner?.querySelector("h1");
        if (!banner || !h1) w.__bad.push("no banner");
        else {
          for (let el: Element | null = h1; el && el !== document.body; el = el.parentElement) {
            if (parseFloat(getComputedStyle(el).opacity) < 1) w.__bad.push(`opacity<1 on ${el.tagName}.${el.className}`.slice(0, 80));
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    for (const name of ["Blog", "Contact", "About"]) {
      await nav(page, name).click();
      await page.waitForTimeout(900);
    }
    const bad = await page.evaluate(() => (window as unknown as { __bad: string[] }).__bad);
    expect([...new Set(bad)]).toEqual([]);
  });

  test("a fast navigation shows no loader at all", async ({ page }) => {
    await page.goto("/about");
    await page.evaluate(() => {
      const w = window as unknown as { __seen: number };
      w.__seen = 0;
      new MutationObserver(() => {
        if (document.querySelector(".nav-progress-bar,.nav-overlay")) w.__seen++;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await nav(page, "Contact").click();
    await expect(page).toHaveURL(/\/contact$/);
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => (window as unknown as { __seen: number }).__seen)).toBe(0);
  });

  test("a slow navigation shows the bar, then the branded loader, and both go away when the page is ready", async ({ page }) => {
    await page.goto("/about");
    await page.route(/\/blog\?_rsc=/, async (route) => {
      await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await nav(page, "Blog").click();
    await expect(page.locator(".nav-progress-bar")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Loading" })).toBeVisible({ timeout: 4000 });
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator("main h1")).toContainText(/Insights|blog/i);
    await expect(page.locator(".nav-progress-bar")).toHaveCount(0);
    await expect(page.locator(".nav-overlay")).toHaveCount(0);
  });

  test("a failed page request does not leave the loader stuck", async ({ page }) => {
    await page.goto("/about");
    await page.route(/\/faq\?_rsc=/, (route) => route.abort());
    await nav(page, "Home").click(); // warm nothing; just make sure the header is usable
    await page.goto("/about");
    await page.getByRole("link", { name: "FAQ" }).first().click().catch(() => {});
    await page.waitForTimeout(500);
    await page.goto("/faq");
    await expect(page.locator("main h1")).toBeVisible();
    await expect(page.locator(".nav-progress-bar")).toHaveCount(0);
    await expect(page.locator(".nav-overlay")).toHaveCount(0);
  });
});
