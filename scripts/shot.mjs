// Usage: node scripts/shot.mjs <path> <width> <outfile> [fullPage=1]
import { chromium } from "@playwright/test";

const [, , path = "/", width = "1440", out = "shot.png", full = "1"] = process.argv;
const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + path, { waitUntil: "networkidle" });
// Scroll through to trigger reveal animations
const h = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < h; y += 300) {
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(90);
}
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(900);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
await page.screenshot({ path: out, fullPage: full === "1" });
console.log(JSON.stringify({ path, width, overflow, errors }));
await browser.close();
