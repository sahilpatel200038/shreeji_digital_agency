import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { PUBLIC_ROUTES } from "./helpers";

const BLOG_ROUTES = PUBLIC_ROUTES.filter((r) => r.startsWith("/blog"));
const BANNER_ROUTES = PUBLIC_ROUTES;

/** The first banner on a page: the <header class="section--banner"> or the home hero <section>. */
const banner = (page: Page) => page.locator("main .section--banner").first();

test.describe("page banners", () => {
  for (const route of BANNER_ROUTES) {
    test(`${route}: text left, relevant image right, breadcrumbs only on blog`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto(route);
      const b = banner(page);
      await expect(b).toBeVisible();

      const h1 = b.locator("h1");
      const img = b.locator("img").first();
      await expect(h1).toBeVisible();
      await expect(img).toBeVisible();
      const [hb, ib] = await Promise.all([h1.boundingBox(), img.boundingBox()]);
      expect(hb!.x + hb!.width, "heading is left of the image").toBeLessThanOrEqual(ib!.x + 2);

      // image loaded with real pixels and meaningful alt text
      const loaded = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      expect(loaded, "banner image loaded").toBe(true);
      expect(((await img.getAttribute("alt")) ?? "").trim().length, "alt text").toBeGreaterThan(5);

      const crumbs = b.getByRole("navigation", { name: "Breadcrumb" });
      if (BLOG_ROUTES.includes(route)) await expect(crumbs).toHaveCount(1);
      else {
        await expect(crumbs).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
      }
    });
  }

  for (const [name, width, height] of [["mobile", 375, 740], ["tablet", 768, 1024], ["desktop", 1440, 900]] as const) {
    test(`no horizontal overflow and stacked/side-by-side as expected on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      for (const route of BANNER_ROUTES) {
        await page.goto(route);
        const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(over, `${route} overflows by ${over}px`).toBeLessThanOrEqual(0);
        const h1 = await banner(page).locator("h1").boundingBox();
        const img = await banner(page).locator("img").first().boundingBox();
        if (width >= 1024) expect(img!.x, route).toBeGreaterThan(h1!.x + 100);
        else expect(img!.y, `${route} image stacks under text`).toBeGreaterThanOrEqual(h1!.y + h1!.height - 2);
        expect(img!.width, route).toBeGreaterThan(200);
      }
    });
  }

  for (const [name, width, height] of [["desktop", 1366, 768], ["tablet", 820, 1180], ["mobile", 390, 844]] as const) {
    test(`every banner matches the homepage banner's geometry on ${name}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const measure = async (route: string) => {
        await page.goto(route);
        const b = banner(page);
        const [box, h1, img] = await Promise.all([b.boundingBox(), b.locator("h1").boundingBox(), b.locator("img").first().boundingBox()]);
        return { height: box!.height, h1x: h1!.x, imgx: img!.x, imgw: img!.width };
      };
      const home = await measure("/");
      for (const route of BANNER_ROUTES.filter((r) => r !== "/")) {
        const m = await measure(route);
        expect(m.h1x, `${route} text left edge`).toBeCloseTo(home.h1x, 0);
        expect(Math.abs(m.imgx - home.imgx), `${route} image x`).toBeLessThanOrEqual(2);
        expect(Math.abs(m.imgw - home.imgw), `${route} image width`).toBeLessThanOrEqual(2);
        if (width >= 1024) expect(Math.abs(m.height - home.height), `${route} banner height`).toBeLessThanOrEqual(2);
      }
    });
  }

  test("a banner image that fails to load swaps to the bundled photo", async ({ page }) => {
    // Service banners use the admin-managed /media/<id> image; make those fail.
    await page.route("**/_next/image?url=%2Fmedia%2F*", (r) => r.abort());
    await page.goto("/services/seo");
    const img = banner(page).locator("img").first();
    await expect(img).toHaveAttribute("src", /services\.webp/);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  });
});

test.describe("admin banner image reaches the site", () => {
  test.use({ storageState: AUTH_FILE });

  test("set the Services banner in Settings, see it live, then revert", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Page banners" }) });
    const picker = card.locator('div:has(> input[name="services"])');
    await picker.getByRole("button", { name: /Choose image|Change image/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("listitem").first()).toBeVisible();
    await dialog.getByRole("listitem").nth(1).getByRole("button").click();
    const id = await picker.locator('input[name="services"]').inputValue();
    expect(Number(id)).toBeGreaterThan(0);

    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");

    await expect
      .poll(async () => (await (await request.get("/services")).text()).includes(`%2Fmedia%2F${id}%3Fv%3D`), { timeout: 20_000 })
      .toBe(true);

    // persisted after refresh
    await page.reload();
    await expect(card.locator('input[name="services"]')).toHaveValue(id);

    // revert
    await card.locator('div:has(> input[name="services"])').getByRole("button", { name: "Remove" }).click();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");
    await expect
      .poll(async () => (await (await request.get("/services")).text()).includes("%2Fimages%2Fbanners%2Fservices.webp"), { timeout: 20_000 })
      .toBe(true);
  });

  test("edit the Blog banner heading and intro in Settings, see them live, then restore", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Page banners" }) });
    const title = card.getByLabel("Blog page: heading");
    const text = card.getByLabel("Blog page: intro");
    const [t0, x0] = [await title.inputValue(), await text.inputValue()];
    await title.fill("E2E blog banner heading");
    await text.fill("E2E blog banner intro");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");
    await expect.poll(async () => (await (await request.get("/blog")).text()).includes("E2E blog banner heading"), { timeout: 20_000 }).toBe(true);
    expect(await (await request.get("/blog")).text()).toContain("E2E blog banner intro");

    await title.fill("");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("alert")).toContainText("required");

    await title.fill(t0);
    await text.fill(x0);
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");
  });

  test("rejects a banner id that is not an image in the library", async ({ page }) => {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Page banners" }) });
    await card.locator('input[name="faq"]').evaluate((el: HTMLInputElement) => (el.value = "99999999"));
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("alert")).toContainText("Choose images from the media library");
  });
});
