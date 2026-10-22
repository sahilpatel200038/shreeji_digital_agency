import { chromium } from "@playwright/test";
const b = await chromium.launch();
const ctx = await b.newContext({ storageState: "test-results/admin-state.json", baseURL: "http://localhost:3100" });
const p = await ctx.newPage();
const id = process.argv[2];
const res = await p.goto("/admin/media/" + id);
console.log(res.status(), p.url());
console.log((await p.locator("body").innerText()).slice(0, 400));
await b.close();
