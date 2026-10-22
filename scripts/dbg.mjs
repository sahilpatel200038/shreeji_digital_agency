import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3000/", { waitUntil: "networkidle" });
const count = async () => p.evaluate(() => [...document.querySelectorAll('[style*="opacity"]')].filter((e) => getComputedStyle(e).opacity === "0").length);
console.log("hidden before scroll:", await count());
for (let y = 0; y < 7000; y += 300) { await p.mouse.wheel(0, 300); await p.waitForTimeout(120); }
await p.waitForTimeout(1000);
console.log("hidden after wheel scroll:", await count());
await b.close();
