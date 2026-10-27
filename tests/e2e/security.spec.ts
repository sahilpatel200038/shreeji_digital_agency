import { expect, test } from "@playwright/test";
import { query } from "./db";

test.describe("injection and abuse resistance (public surface)", () => {
  test("SQL-injection strings in search never error or leak data", async ({ request }) => {
    const payloads = ["' OR 1=1 --", "'; DROP TABLE Lead; --", "\" OR \"\"=\"", "1; SELECT SLEEP(5)", "%' UNION SELECT email FROM User --"];
    for (const p of payloads) {
      const t0 = Date.now();
      const res = await request.get(`/blog?q=${encodeURIComponent(p)}`);
      expect(res.status(), p).toBe(200);
      expect(Date.now() - t0, `${p} must not trigger SLEEP`).toBeLessThan(4000);
      const html = await res.text();
      expect(html).not.toMatch(/admin@shreeji\.local/);
      expect(html).not.toMatch(/SQL|syntax|mysql|prisma/i);
    }
    // Tables still intact
    expect((await query("SELECT COUNT(*) n FROM `Lead`"))[0]).toBeDefined();
    expect((await query("SELECT COUNT(*) n FROM User"))[0]).toBeDefined();
  });

  test("search term is reflected as text, never as HTML", async ({ page }) => {
    const payload = `<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>`;
    await page.goto(`/blog?q=${encodeURIComponent(payload)}`);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator("main img[src='x']")).toHaveCount(0);
    await expect(page.getByText("No articles match")).toBeVisible();
  });

  test("media route rejects traversal and non-numeric ids", async ({ request }) => {
    for (const p of ["/media/..%2f..%2f.env", "/media/abc", "/media/-1", "/media/1.5", "/media/0", "/media/1;DROP"]) {
      const res = await request.get(p);
      expect([404, 400], p).toContain(res.status());
    }
  });

  test("error responses never expose stack traces or secrets", async ({ request }) => {
    for (const p of ["/nope", "/services/%00", "/blog/%E0%A4%A", "/api/admin/media"]) {
      const res = await request.get(p, { failOnStatusCode: false });
      const body = await res.text();
      expect(body, p).not.toMatch(/at \w+ \(|node_modules|AUTH_SECRET|DATABASE_URL|PrismaClient/);
    }
  });

  test("oversized contact submissions are rejected without storing", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/contact");
    await page.waitForTimeout(3300);
    const email = `e2e-huge-${Date.now()}@example.com`;
    await page.getByLabel(/First name/).fill("Huge");
    await page.getByLabel(/Email address/).fill(email);
    await page.getByLabel(/How can we help/).evaluate((el, v) => ((el as HTMLTextAreaElement).value = v), "x".repeat(4000));
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await page.waitForTimeout(1500);
    expect(await query("SELECT id FROM `Lead` WHERE email = ?", [email])).toHaveLength(0);
    await ctx.close();
  });

  test("contact form is rate limited per client", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await query("DELETE FROM RateLimit WHERE `key` LIKE 'contact:%'");
    await page.goto("/contact");
    await page.waitForTimeout(3300);
    const prefix = `e2e-rl-${Date.now()}`;
    let limited = false;
    for (let i = 0; i < 7 && !limited; i++) {
      await page.waitForTimeout(3200); // the form re-arms its minimum-fill timer after each success
      await page.getByLabel(/First name/).fill("Rate");
      await page.getByLabel(/Email address/).fill(`${prefix}-${i}@example.com`);
      await page.getByLabel(/How can we help/).fill("Rate limit test message number " + i);
      await page.getByRole("button", { name: "Send enquiry" }).click();
      await page.waitForTimeout(900);
      limited = await page.getByText(/Too many enquiries/).isVisible();
    }
    expect(limited).toBe(true);
    const stored = await query<{ n: number }>("SELECT COUNT(*) n FROM `Lead` WHERE email LIKE ?", [`${prefix}-%`]);
    expect(stored[0].n).toBe(5);
    await query("DELETE FROM `Lead` WHERE email LIKE ?", [`${prefix}-%`]);
    await query("DELETE FROM RateLimit WHERE `key` LIKE 'contact:%'");
    await ctx.close();
  });
});

test.describe("authorization is enforced server-side (not just hidden in the UI)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("server actions cannot be invoked anonymously", async ({ request }) => {
    // A forged Server Action POST without a valid session must not mutate anything.
    const before = await query<{ n: number }>("SELECT COUNT(*) n FROM Page");
    const res = await request.post("/admin/pages/new", {
      headers: { "next-action": "00deadbeef00deadbeef00deadbeef00deadbeef00", "content-type": "text/plain;charset=UTF-8", origin: process.env.BASE_URL ?? "http://localhost:3100" },
      data: '["$undefined",{"title":"hacked"}]',
      maxRedirects: 0,
    });
    expect([307, 400, 401, 403, 404, 500]).toContain(res.status());
    const after = await query<{ n: number }>("SELECT COUNT(*) n FROM Page");
    expect(after[0].n).toBe(before[0].n);
  });

  test("lead data is never exposed on any public endpoint", async ({ request }) => {
    for (const p of ["/api/leads", "/api/admin/leads", "/admin/leads/export", "/admin/leads"]) {
      const res = await request.get(p, { maxRedirects: 0, failOnStatusCode: false });
      expect([307, 401, 403, 404], p).toContain(res.status());
    }
  });
});
