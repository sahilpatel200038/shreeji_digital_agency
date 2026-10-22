import { chromium } from "@playwright/test";
const [, , path = "/", width = "375"] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 800 } });
await p.goto((process.env.BASE_URL ?? "http://localhost:3000") + path, { waitUntil: "networkidle" });
const r = await p.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  return [...document.querySelectorAll("body *")]
    .filter((e) => e.getBoundingClientRect().right > vw + 1 && getComputedStyle(e).position !== "fixed")
    .slice(0, 8)
    .map((e) => `${e.tagName}.${String(e.className).slice(0, 80)} right=${Math.round(e.getBoundingClientRect().right)}`);
});
console.log(r.join("\n") || "none");
await b.close();
