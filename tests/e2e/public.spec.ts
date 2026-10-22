import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./helpers";

test.describe("public routes", () => {
  const titles = new Map<string, string>();

  for (const route of PUBLIC_ROUTES) {
    test(`loads ${route} with correct SEO basics`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);

      await expect(page.locator("h1")).toHaveCount(1);
      const title = await page.title();
      expect(title.length).toBeGreaterThan(10);
      expect(titles.get(title), `duplicate <title> "${title}" also on ${titles.get(title)}`).toBeUndefined();
      titles.set(title, route);

      const desc = await page.locator('meta[name="description"]').getAttribute("content");
      expect(desc?.length ?? 0).toBeGreaterThan(30);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(route);
      await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);

      // Landmarks + skip link
      await expect(page.locator("main#main")).toHaveCount(1);
      await expect(page.locator("header").first()).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    });
  }

  test("images all have alt attributes", async ({ page }) => {
    for (const route of ["/", "/services/seo", "/blog"]) {
      await page.goto(route);
      const missing = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length);
      expect(missing, route).toBe(0);
    }
  });
});

test.describe("status codes", () => {
  for (const path of ["/definitely-not-a-page", "/services/nope", "/blog/nope", "/blog/category/nope", "/media/99999999", "/admin/pages/99999999"]) {
    test(`404 for ${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([404, 307]).toContain(res.status());
      if (!path.startsWith("/admin")) expect(res.status()).toBe(404);
    });
  }

  test("custom 404 page is branded and noindex", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("could not find");
    const robots = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => e.getAttribute("content")));
    expect(robots.length).toBeGreaterThan(0);
    for (const r of robots) expect(r).toMatch(/noindex/);
    await expect(page.getByRole("link", { name: "Go home" })).toBeVisible();
  });
});

test.describe("navigation", () => {
  test("every header and footer link resolves (no dead links)", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll("header a[href], footer a[href]")].map((a) => (a as HTMLAnchorElement).getAttribute("href")!))]);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      expect(href.startsWith("javascript:"), href).toBe(false);
      if (href.startsWith("/")) {
        const res = await request.get(href);
        expect(res.status(), href).toBe(200);
      }
    }
  });

  test("active page is indicated with aria-current", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator('header nav[aria-label="Primary"] a[aria-current="page"]')).toHaveText("About");
  });

  test("services dropdown lists every service on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByRole("link", { name: "Services" }).first().hover();
    await expect(page.getByRole("link", { name: "Search Engine Optimization", exact: true }).first()).toBeVisible();
  });

  test("mobile menu opens, traps escape and navigates", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await toggle.click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-nav")).toBeHidden();
    await toggle.click();
    await page.locator("#mobile-nav").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.locator("#mobile-nav")).toBeHidden();
  });

  test("skip link is the first focusable element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });

  test("FAQ accordion expands and collapses", async ({ page }) => {
    await page.goto("/faq");
    const first = page.getByRole("button", { name: /What industries/ });
    await expect(first).toHaveAttribute("aria-expanded", "false");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "false");
  });

  test("blog search and empty state", async ({ page }) => {
    await page.goto("/blog?q=zzzzzzzz-nothing");
    await expect(page.getByText(/No articles match/)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/blog?q=technical");
    await expect(page.getByRole("link", { name: /Technical SEO Basics/ }).first()).toBeVisible();
  });
});

test.describe("SEO endpoints", () => {
  test("robots.txt and sitemap.xml", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Sitemap: .*\/sitemap\.xml/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const r of PUBLIC_ROUTES) expect(locs, r).toContain(r);
    expect(locs.some((l) => l.startsWith("/admin"))).toBe(false);
    expect(new Set(locs).size).toBe(locs.length);
  });

  test("every sitemap URL returns 200", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    for (const p of paths) expect((await request.get(p)).status(), p).toBe(200);
  });

  test("structured data is valid JSON and appropriate per page", async ({ page }) => {
    const types = async (route: string) => {
      await page.goto(route);
      const blobs = await page.locator('script[type="application/ld+json"]').allTextContents();
      return blobs.flatMap((b) => {
        const j = JSON.parse(b);
        return (Array.isArray(j) ? j : [j]).flatMap((x) => [x["@type"]].flat());
      });
    };
    expect(await types("/")).toEqual(expect.arrayContaining(["Organization", "ProfessionalService", "WebSite", "FAQPage"]));
    expect(await types("/services/seo")).toEqual(expect.arrayContaining(["Service"]));
    expect(await types("/services/seo")).not.toContain("BreadcrumbList"); // breadcrumbs are visible on blog pages only
    expect(await types("/services/seo")).not.toContain("FAQPage");
    expect(await types("/blog/how-to-plan-a-digital-marketing-campaign")).toEqual(expect.arrayContaining(["BlogPosting", "BreadcrumbList"]));
    expect(await types("/contact")).toEqual(expect.arrayContaining(["ContactPage"]));
    // Visible-content rule: no FAQ schema where no FAQ is shown, and never any review/rating markup.
    expect(await types("/privacy-policy")).not.toContain("FAQPage");
    for (const r of ["/", "/services/seo", "/about"]) expect(JSON.stringify(await types(r))).not.toMatch(/Review|AggregateRating/);
  });

  test("unverified testimonials and stats are NOT shown publicly", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Mitesh Patel")).toHaveCount(0);
    await expect(page.getByText("+284%")).toHaveCount(0);
    await expect(page.getByText(/500 campaigns/)).toHaveCount(0);
  });
});

test.describe("security headers", () => {
  test("public pages send hardening headers", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});
