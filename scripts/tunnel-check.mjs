// Usage: node scripts/tunnel-check.mjs <baseUrl> <path>
import { chromium } from "@playwright/test";
const [, , base, path = "/"] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ extraHTTPHeaders: { "ngrok-skip-browser-warning": "1" } });
const page = await ctx.newPage();
const out = { errors: [], failed: [], bad: [] };
page.on("console", (m) => m.type() === "error" && out.errors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => out.errors.push(String(e).slice(0, 200)));
page.on("requestfailed", (r) => out.failed.push(r.url().slice(0, 120)));
page.on("response", (r) => r.status() >= 400 && out.bad.push(r.status() + " " + r.url().slice(0, 120)));
await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log(JSON.stringify(out, null, 1));
await b.close();
