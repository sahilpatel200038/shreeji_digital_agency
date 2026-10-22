import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { closeDb, query } from "./db";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`homepage work videos @ ${vp.name}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");

    const section = page.locator("#videos");
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
    await page.waitForTimeout(1500); // let the scroll-reveal stagger finish before measuring
    const cards = section.locator(".aspect-video");
    await expect(cards).toHaveCount(2);

    for (let i = 0; i < 2; i++) {
      const box = (await cards.nth(i).boundingBox())!;
      expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    }
    const [a, b] = [(await cards.nth(0).boundingBox())!, (await cards.nth(1).boundingBox())!];
    if (vp.width >= 768) expect(Math.abs(a.y - b.y)).toBeLessThan(2); // side by side
    else expect(b.y).toBeGreaterThan(a.y + a.height - 1); // stacked

    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW).toBeLessThanOrEqual(vp.width);
    expect(errors).toEqual([]);
  });
}

test.describe("admin-managed work videos", () => {
  test.use({ storageState: AUTH_FILE });
  test.afterAll(closeDb);

  test("links saved in Settings play on the homepage, are logged, and bad links are rejected", async ({ page }) => {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Homepage" }) });
    const links = [card.getByLabel("Video 1 link"), card.getByLabel("Video 2 link")];
    const original = [await links[0].inputValue(), await links[1].inputValue()];
    const save = async () => {
      await card.getByRole("button", { name: "Save" }).click();
    };
    try {
      await links[0].fill("javascript:alert(1)");
      await save();
      await expect(card.getByRole("alert").first()).toBeVisible();

      await links[0].fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      await links[1].fill("https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm");
      await save();
      await expect(card.getByRole("status")).toContainText("Settings saved");

      const [log] = await query<{ actionType: string; module: string; userName: string }>(
        "SELECT actionType, module, userName FROM auditlog WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1",
      );
      expect(log.actionType).toBe("UPDATE");
      expect(log.userName).not.toBe("");

      await expect
        .poll(async () => {
          await page.goto("/");
          return page.locator("#videos").getByRole("button", { name: /^Play video/ }).count();
        }, { timeout: 15_000 })
        .toBe(2);

      const videos = page.locator("#videos");
      await videos.getByRole("button", { name: /Play video: Project walkthrough/ }).click();
      await expect(videos.locator("iframe")).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
      await videos.getByRole("button", { name: /Play video: Behind the work/ }).click();
      await expect(videos.locator("video")).toHaveAttribute("src", /flower\.webm$/);
    } finally {
      await page.goto("/admin/settings");
      await links[0].fill(original[0]);
      await links[1].fill(original[1]);
      await save();
      await expect(card.getByRole("status")).toContainText("Settings saved");
    }
  });
});
