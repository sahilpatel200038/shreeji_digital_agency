import { expect, test } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { PUBLIC_ROUTES } from "./helpers";

test.describe("a common slider on every page", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route}: has a carousel with real content, working images and a WhatsApp button`, async ({ page, request }) => {
      const failed: string[] = [];
      page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
      await page.goto(route);

      const carousels = page.locator('[aria-roledescription="carousel"]');
      expect(await carousels.count(), route).toBeGreaterThanOrEqual(1);
      // Every carousel is the shared component: Swiper markup, no dots, at least one real slide.
      await expect(page.locator(".swiper-pagination, .swiper-pagination-bullet")).toHaveCount(0);
      for (let i = 0; i < (await carousels.count()); i++) {
        const c = carousels.nth(i);
        await expect(c.locator(".swiper.swiper-initialized")).toHaveCount(1);
        expect(await c.locator(".swiper-slide").count()).toBeGreaterThanOrEqual(1);
        expect((await c.locator(".swiper-slide").first().innerText()).trim().length).toBeGreaterThan(5);
      }

      // Every image inside a carousel resolves.
      const srcs = await page.evaluate(() => [...new Set([...document.querySelectorAll('[aria-roledescription="carousel"] img')].map((i) => (i as HTMLImageElement).currentSrc || (i as HTMLImageElement).src))]);
      for (const src of srcs.filter(Boolean)) {
        const res = await request.get(src);
        expect(res.status(), src).toBe(200);
        expect(res.headers()["content-type"], src).toMatch(/^image\//);
      }

      // WhatsApp: valid wa.me link on every page.
      const wa = page.getByRole("link", { name: /on WhatsApp/ });
      await expect(wa).toHaveCount(1);
      expect(await wa.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\d{8,15}(\?text=.*)?$/);

      expect(failed.filter((f) => !f.includes("_rsc")), route).toEqual([]);
    });
  }

  test("service images exist on disk", () => {
    const files = readdirSync("public/images/services");
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const f of files) expect(existsSync(`public/images/services/${f}`)).toBe(true);
  });

  test("ultra-wide viewport: all slides present and nothing overflows", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/");
    const region = page.getByRole("region", { name: "Our Core Services slides", exact: true });
    const slides = await region.locator(".swiper-slide").count();
    expect(slides).toBeGreaterThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
