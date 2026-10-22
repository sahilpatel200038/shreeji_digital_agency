import { chromium } from "@playwright/test";
const b = await chromium.launch();
const ctx = await b.newContext({ storageState: "test-results/admin-state.json", baseURL: "http://localhost:3100", viewport: { width: 375, height: 800 } });
const p = await ctx.newPage();
await p.goto(process.argv[2]);
const r = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const e of document.querySelectorAll("body *")) {
    const r = e.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) out.push(`${e.tagName}.${String(e.className).slice(0, 70)} right=${Math.round(r.right)} ovx=${getComputedStyle(e).overflowX}`);
  }
  return { sw: document.documentElement.scrollWidth, items: out.slice(0, 8) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
