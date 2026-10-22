import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { whatsappUrl } from "../../src/lib/whatsapp";

const translate = (page: Page, sel: string) =>
  page.locator(`${sel} .swiper-wrapper`).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test.describe("sliders", () => {
  for (const label of [
    "Projects we have delivered",
    "Our Core Services",
  ]) {
    test(`${label}: no dots, working arrows, autoplay, pause, no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      const region = page.getByRole("region", { name: `${label} slides`, exact: true });
      await region.scrollIntoViewIfNeeded();
      await expect(page.locator(".swiper-pagination, .swiper-pagination-bullet")).toHaveCount(0);

      const wrapper = `[aria-label="${label} slides"]`;
      const start = await translate(page, wrapper);

      // Autoplay advances on its own (mouse parked away so hover does not pause it).
      await page.mouse.move(2, 2);
      await expect.poll(() => translate(page, wrapper), { timeout: 12_000 }).toBeLessThan(start);

      // Pause stops it.
      await region.getByRole("button", { name: new RegExp(`^Pause ${label}`) }).click();
      await page.waitForTimeout(1200); // let any in-flight transition finish
      const paused = await translate(page, wrapper);
      await page.waitForTimeout(6000);
      expect(await translate(page, wrapper)).toBe(paused);
      await expect(region.getByRole("button", { name: new RegExp(`^Start ${label}`) })).toBeVisible();

      // Arrows move the slider both ways.
      await region.getByRole("button", { name: new RegExp(`^Next ${label}`) }).click();
      await expect.poll(() => translate(page, wrapper)).toBeLessThan(paused);
      await region.getByRole("button", { name: new RegExp(`^Previous ${label}`) }).click();
      await expect.poll(() => translate(page, wrapper)).toBe(paused);

      for (const width of [390, 820, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `@${width}`).toBeLessThanOrEqual(0);
      }
    });
  }

  test("slider arrows are visible and inside the container on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    const next = page.getByRole("region", { name: "Projects we have delivered slides", exact: true }).getByRole("button", { name: /^Next/ });
    await next.scrollIntoViewIfNeeded();
    const box = (await next.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("swipe moves the slider on a touch device", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto("/");
    const region = page.getByRole("region", { name: "Projects we have delivered slides", exact: true });
    await region.scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Pause Projects we have delivered/ }).click();
    const wrapper = '[aria-label="Projects we have delivered slides"]';
    const before = await translate(page, wrapper);
    const box = (await region.locator(".swiper").boundingBox())!;
    const cdp = await ctx.newCDPSession(page);
    const y = box.y + box.height / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 300, y }] });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 300 - i * 30, y }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => translate(page, wrapper)).toBeLessThan(before);
    await ctx.close();
  });
});

test.describe("shared banner and container system", () => {
  const ROUTES = ["/", "/about", "/services", "/services/ads-management", "/blog", "/faq", "/contact", "/privacy-policy"];

  for (const width of [1440, 820, 390]) {
    test(`containers align on every page @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const seen = new Map<string, string[]>();
      for (const route of ROUTES) {
        await page.goto(route);
        const rects = await page.evaluate(() =>
          [...document.querySelectorAll("main > section > div, main > header > div, main > div > section > div, main > div > header > div")].map((el) => {
            const r = el.getBoundingClientRect();
            return `${Math.round(r.left)}:${Math.round(r.width)}`;
          }),
        );
        for (const r of rects) seen.set(r, [...(seen.get(r) ?? []), route]);
      }
      expect([...seen.keys()], JSON.stringify([...seen])).toHaveLength(1);
    });

    test(`banners are responsive and consistent @${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        const b = await page.evaluate(() => {
          const el = document.querySelector("main header, main section") as HTMLElement;
          const r = el.getBoundingClientRect();
          return { top: r.top + window.scrollY, h: r.height, w: r.width, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, h1: document.querySelectorAll("h1").length };
        });
        expect(b.over, route).toBeLessThanOrEqual(0);
        expect(b.h1, route).toBe(1);
        expect(b.top, route).toBeGreaterThanOrEqual(72); // sits directly under the 72px sticky header (+1px border), nothing hidden or padded
        expect(b.top, route).toBeLessThanOrEqual(73);
        expect(b.w, route).toBe(width);
        expect(b.h, route).toBeGreaterThanOrEqual(240);
        if (route !== "/" || width >= 1024) expect(b.h, route).toBeLessThanOrEqual(route === "/" ? 704 : 900);
      }
    });
  }
});

test.describe("search and filters update on change", () => {
  test("blog search updates results and URL while typing; clearing restores", async ({ page }) => {
    await page.goto("/blog");
    const all = await page.locator("main article").count();
    expect(all).toBeGreaterThan(1);
    await page.getByRole("searchbox", { name: "Search articles" }).pressSequentially("technical");
    await expect(page).toHaveURL(/\/blog\?q=technical$/);
    await expect(page.locator("main article")).toHaveCount(1);
    await page.getByRole("searchbox", { name: "Search articles" }).fill("zzzz-nothing-here");
    await expect(page.getByText(/No articles match/)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search articles" }).fill("");
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator("main article")).toHaveCount(all);
  });

  test.describe("admin", () => {
    test.use({ storageState: AUTH_FILE });

    test("leads: status select applies immediately and text search is debounced; page resets", async ({ page }) => {
      await page.goto("/admin/leads?page=2");
      const requests: string[] = [];
      page.on("request", (r) => r.url().includes("/admin/leads") && r.url().includes("_rsc") && requests.push(r.url()));
      await page.getByLabel("All statuses").selectOption("NEW");
      await expect(page).toHaveURL(/\/admin\/leads\?status=NEW$/);
      await page.getByRole("textbox", { name: "Search" }).pressSequentially("zzzz-no-such-lead", { delay: 30 });
      await expect(page).toHaveURL(/q=zzzz-no-such-lead&status=NEW$/);
      await expect(page.getByText("No leads match these filters.")).toBeVisible();
      expect(requests.filter((u) => u.includes("q=")).length, requests.join(", ")).toBeLessThanOrEqual(2); // debounced: not one request per keystroke
      await page.getByRole("textbox", { name: "Search" }).fill("");
      await page.getByLabel("All statuses").selectOption("");
      await expect(page).toHaveURL(/\/admin\/leads$/);
      await expect(page.getByRole("button", { name: "Filter", exact: true })).toHaveCount(0);
    });

    test("posts list filters on change", async ({ page }) => {
      await page.goto("/admin/posts");
      await page.getByRole("textbox", { name: "Search" }).fill("technical");
      await expect(page).toHaveURL(/q=technical/);
      await expect(page.getByRole("row", { name: /Technical SEO/ })).toBeVisible();
    });
  });
});

test.describe("WhatsApp button", () => {
  test("url builder", () => {
    expect(whatsappUrl("+91 98765-43210", "Hi there & welcome")).toBe("https://wa.me/919876543210?text=Hi%20there%20%26%20welcome");
    expect(whatsappUrl("", "x")).toBeNull();
    expect(whatsappUrl("12", "x")).toBeNull();
    expect(whatsappUrl("+91 98765 43210", "")).toBe("https://wa.me/919876543210");
  });

  test.describe("admin-configured", () => {
    test.use({ storageState: AUTH_FILE });

    test("hidden until a number is saved in admin; then links to wa.me on every page; invalid numbers rejected; revert", async ({ page, request }) => {
      // With no dedicated number saved, the button falls back to the published contact phone.
      const fallback = await (await request.get("/about")).text();
      expect(fallback.includes("https://wa.me/919512494494") || fallback.includes("https://wa.me/9")).toBe(true);

      await page.goto("/admin/settings");
      const card = page.locator("section", { has: page.getByRole("heading", { name: "Contact details" }) });
      const number = card.getByLabel("WhatsApp number");
      const original = await number.inputValue();
      const save = async () => {
        await card.getByRole("button", { name: "Save" }).click();
      };

      await number.fill("abc");
      await save();
      await expect(card.getByRole("alert").first()).toBeVisible();

      await number.fill("+91 90000 12345");
      await card.getByLabel("WhatsApp default message").fill("Hello from the test");
      await save();
      await expect(card.getByRole("status")).toContainText("Settings saved");

      await expect
        .poll(async () => (await (await request.get("/about")).text()).includes("https://wa.me/919000012345?text=Hello%20from%20the%20test"), { timeout: 15_000 })
        .toBe(true);
      for (const route of ["/", "/services/seo", "/contact"]) {
        await page.goto(route);
        const link = page.getByRole("link", { name: /Chat with .* on WhatsApp/ });
        await expect(link).toHaveAttribute("href", "https://wa.me/919000012345?text=Hello%20from%20the%20test");
        await expect(link).toHaveAttribute("target", "_blank");
        await expect(link).toHaveAttribute("rel", /noopener/);
      }

      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto("/");
      const box = (await page.getByRole("link", { name: /on WhatsApp/ }).boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

      await page.goto("/admin/settings");
      await number.fill(original);
      await card.getByLabel("WhatsApp default message").fill("Hello Shreeji Marketing, I would like to know more about your services.");
      await save();
      await expect(card.getByRole("status")).toContainText("Settings saved");
      if (!original) {
        await expect.poll(async () => (await (await request.get("/about")).text()).includes("https://wa.me/919512494494"), { timeout: 15_000 }).toBe(true);
      }
    });
  });
});
