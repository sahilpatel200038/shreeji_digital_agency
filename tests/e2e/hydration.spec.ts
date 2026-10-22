import { expect, test } from "@playwright/test";
import { PUBLIC_ROUTES } from "./helpers";

// Server HTML must equal the first client render for every visitor. The setting that used to break this:
// "reduce motion" (the server cannot know it), which changed inline styles and counters during render.
for (const reducedMotion of ["reduce", "no-preference"] as const) {
  test.describe(`hydration with reducedMotion=${reducedMotion}`, () => {
    test.use({ reducedMotion });
    test(`no console errors or hydration mismatches on any public route`, async ({ page }) => {
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") problems.push(m.text().slice(0, 300));
      });
      page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.slice(0, 300)}`));
      for (const route of PUBLIC_ROUTES) {
        const before = problems.length;
        await page.goto(route, { waitUntil: "networkidle" });
        await page.waitForTimeout(400);
        expect(problems.slice(before), route).toEqual([]);
      }
    });
  });
}
