import { expect, test, type APIRequestContext } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { query } from "./db";

/**
 * Services (the four requested ones + service management), Header Management, Footer Management and the About-page
 * Team section, all driven through the real admin UI and checked on the public site. Every test restores what it changed.
 */
test.use({ storageState: AUTH_FILE });

const live = async (request: APIRequestContext, path: string) => (await request.get(path)).text();
const until = async (request: APIRequestContext, path: string, needle: string | RegExp, timeout = 25_000) =>
  expect
    .poll(async () => {
      const html = await live(request, path);
      return typeof needle === "string" ? html.includes(needle) : needle.test(html);
    }, { timeout })
    .toBe(true);
const gone = async (request: APIRequestContext, path: string, needle: string) => expect.poll(async () => (await live(request, path)).includes(needle), { timeout: 25_000 }).toBe(false);
const saved = (page: import("@playwright/test").Page, text: string) => expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible({ timeout: 15_000 });

const NEW_SERVICES = [
  { slug: "whatsapp-marketing", title: "WhatsApp Marketing" },
  { slug: "google-business-profile-optimization", title: "Google Business Profile Optimization" },
  { slug: "web-development-design", title: "Web Development & Design" },
  { slug: "app-development-design", title: "App Development & Design" },
];

test.describe("the four requested services", () => {
  test("each exists once, is published, is a main service and has its own page, SEO and image", async ({ request }) => {
    for (const s of NEW_SERVICES) {
      const rows = await query<{ id: number; title: string; status: string; isFeatured: number; featuredMediaId: number | null; seoId: number | null; summary: string }>(
        "SELECT id, title, status, isFeatured, featuredMediaId, seoId, summary FROM Service WHERE slug = ?",
        [s.slug],
      );
      expect(rows, `${s.slug} exists exactly once`).toHaveLength(1);
      expect(rows[0].title).toBe(s.title);
      expect(rows[0].status).toBe("PUBLISHED");
      expect(rows[0].isFeatured).toBe(1);
      expect(rows[0].featuredMediaId, `${s.slug} has an image`).not.toBeNull();
      const [seo] = await query<{ title: string; description: string }>("SELECT title, description FROM SeoMeta WHERE id = ?", [rows[0].seoId]);
      expect(seo.title).toContain("Shreeji");
      expect(seo.description.length).toBeGreaterThan(50);

      const res = await request.get(`/services/${s.slug}`);
      expect(res.status()).toBe(200);
      const html = await res.text();
      expect(html).toContain(`<h1`);
      expect(html).toContain(s.title.replace("&", "&amp;"));
      expect(html).toMatch(/<meta name="description" content="[^"]{50,}/);
    }
    // Web and App are two independent services with their own wording.
    const [web] = await query<{ summary: string; id: number }>("SELECT summary, id FROM Service WHERE slug = 'web-development-design'");
    const [app] = await query<{ summary: string; id: number }>("SELECT summary, id FROM Service WHERE slug = 'app-development-design'");
    expect(web.id).not.toBe(app.id);
    expect(web.summary).not.toBe(app.summary);
    expect((await query("SELECT id FROM Service WHERE slug = 'web-app-development'")).length, "the combined service no longer exists").toBe(0);
  });

  test("the old combined address redirects to Web Development & Design", async ({ request }) => {
    const res = await request.get("/services/web-app-development", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toContain("/services/web-development-design");
  });

  test("they appear on the Services page, in the header menu, in the footer and in the enquiry form", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto("/services");
    for (const s of NEW_SERVICES) {
      await expect(page.getByRole("link", { name: new RegExp(`^${s.title.replace(/[&]/g, "\\$&")}`) }).first(), `${s.slug} card`).toBeAttached();
      expect(await page.locator(`a[href="/services/${s.slug}"]`).count(), `${s.slug} links`).toBeGreaterThanOrEqual(3);
      expect(await page.locator(`header a[href="/services/${s.slug}"]`).count(), `${s.slug} in the header menu`).toBeGreaterThan(0);
      expect(await page.locator(`footer a[href="/services/${s.slug}"]`).count(), `${s.slug} in the footer`).toBe(1);
      await expect(page.locator("select[name='service'] option", { hasText: s.title })).toHaveCount(1);
    }
    // Main services are in the "core" block at the top.
    const core = page.locator("section", { has: page.getByRole("heading", { name: "Our Core Services" }) });
    for (const s of NEW_SERVICES) await expect(core.locator(`a[href="/services/${s.slug}"]`)).toHaveCount(1);
  });

  test("they appear in the homepage slider and every service page has working links", async ({ page, request }) => {
    await page.goto("/");
    for (const s of NEW_SERVICES) expect(await page.locator(`a[href="/services/${s.slug}"]`).count(), `${s.slug} on the homepage`).toBeGreaterThan(0);
    for (const s of NEW_SERVICES) {
      const html = await live(request, `/services/${s.slug}`);
      for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
        const href = m[1];
        if (/^\/(_next|media|images|brand)/.test(href)) continue;
        const status = (await request.get(href, { maxRedirects: 0 })).status();
        expect([200, 301, 308], `${s.slug} → ${href}`).toContain(status);
      }
    }
  });

  test("admin: listed as Main services; every field of WhatsApp Marketing is editable and persists", async ({ page, request }) => {
    await page.goto("/admin/services");
    for (const s of NEW_SERVICES) {
      const row = page.getByRole("row").filter({ hasText: `/services/${s.slug}` });
      await expect(row).toContainText("Main");
      await expect(row).toContainText("Published");
    }
    const [wa] = await query<{ id: number; summary: string }>("SELECT id, summary FROM Service WHERE slug = 'whatsapp-marketing'");
    await page.goto(`/admin/services/${wa.id}`);
    await expect(page.getByLabel(/^Title/)).toHaveValue("WhatsApp Marketing");
    await expect(page.getByLabel("URL slug")).toHaveValue("whatsapp-marketing");
    await expect(page.getByLabel(/^Summary/)).toHaveValue(wa.summary);
    await expect(page.getByLabel("SEO title")).not.toHaveValue("");
    await expect(page.getByLabel("Main service")).toBeChecked();

    const hero = page.getByLabel("Hero heading");
    const orig = await hero.inputValue();
    try {
      await hero.fill("E2E WhatsApp hero");
      await page.getByRole("button", { name: "Save service" }).click();
      await saved(page, "Service saved");
      await until(request, "/services/whatsapp-marketing", "E2E WhatsApp hero");
      await page.reload();
      await expect(page.getByLabel("Hero heading")).toHaveValue("E2E WhatsApp hero");
    } finally {
      await page.getByLabel("Hero heading").fill(orig);
      await page.getByRole("button", { name: "Save service" }).click();
      await saved(page, "Service saved");
    }
  });

  test("admin: create, reorder, hide, show as additional, and delete a service", async ({ page, request }) => {
    const title = `E2E Service ${Date.now().toString(36)}`;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      await page.goto("/admin/services/new");
      await page.getByLabel(/^Title/).fill(title);
      await page.getByLabel(/^Summary/).fill("A throw-away service used by the end-to-end tests.");
      await page.getByLabel("Status").selectOption("PUBLISHED");
      await page.getByLabel("Main service").check();
      await page.getByRole("button", { name: "Create service" }).click();
      await expect(page).toHaveURL(/\/admin\/services\/\d+/);
      await until(request, `/services/${slug}`, title);

      // Main service: in the core block; additional: moved to "More ways we can help".
      await until(request, "/services", new RegExp(`Our Core Services[\\s\\S]*${title}[\\s\\S]*More ways we can help`));
      await page.getByLabel("Main service").uncheck();
      await page.getByRole("button", { name: "Save service" }).click();
      await saved(page, "Service saved");
      await until(request, "/services", new RegExp(`More ways we can help[\\s\\S]*${title}`));

      // Order.
      await page.goto("/admin/services");
      await expect(page.getByRole("row").filter({ hasText: `/services/${slug}` })).toBeVisible();
      const rowsBefore = await page.getByRole("row").allInnerTexts();
      const idxBefore = rowsBefore.findIndex((r) => r.includes(`/services/${slug}`));
      await page.getByRole("button", { name: `Move ${title} up` }).click();
      await expect(page.getByText("Order updated").first()).toBeVisible();
      const idxAfter = (await page.getByRole("row").allInnerTexts()).findIndex((r) => r.includes(`/services/${slug}`));
      expect(idxAfter).toBe(idxBefore - 1);

      // Visibility.
      const row = page.getByRole("row").filter({ hasText: `/services/${slug}` });
      await row.getByRole("button", { name: "Unpublish" }).click();
      await expect(page.getByText("Service unpublished").first()).toBeVisible();
      await expect.poll(async () => (await request.get(`/services/${slug}`)).status(), { timeout: 25_000 }).toBe(404);
      await gone(request, "/services", title);
    } finally {
      await page.goto("/admin/services");
      const row = page.getByRole("row").filter({ hasText: `/services/${slug}` });
      await row.waitFor({ timeout: 8000 }).catch(() => {});
      if (await row.count()) {
        await row.getByRole("button", { name: "Delete" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
        await expect(page.getByText(`Deleted “${title}”`).first()).toBeVisible();
      }
      await query("DELETE FROM Redirect WHERE fromPath LIKE ?", [`/services/e2e-service%`]);
    }
    expect((await query("SELECT id FROM Service WHERE slug = ?", [slug])).length).toBe(0);
  });
});

test.describe("header management", () => {
  test("logo text, button and navigation reach the public site; unsafe links are rejected", async ({ page, request }) => {
    await page.goto("/admin/header");
    const ctaLabel = page.getByLabel("Button text");
    const brand = page.getByLabel("Brand name (first line)");
    const orig = { cta: await ctaLabel.inputValue(), brand: await brand.inputValue() };
    try {
      await brand.fill("E2EBRAND");
      await ctaLabel.fill("E2E Book Now");
      await page.getByRole("button", { name: "Add item" }).click();
      const item = page.locator("ol li").last();
      await item.getByLabel("Label").fill("E2E Link");
      await item.locator("input").nth(1).fill("/faq");
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
      await until(request, "/about", "E2E Book Now");
      const html = await live(request, "/about");
      expect(html).toContain("E2EBRAND");
      expect(html).toMatch(/<a[^>]*href="\/faq"[^>]*>E2E Link/);

      // Reload: everything persisted.
      await page.reload();
      await expect(page.getByLabel("Button text")).toHaveValue("E2E Book Now");

      // Unsafe link: rejected, nothing saved.
      await page.getByLabel("Button link").fill("javascript:alert(1)");
      await page.getByRole("button", { name: "Save header" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /ctaHref/ }).first()).toBeVisible();
      const [row] = await query<{ value: string }>("SELECT value FROM Setting WHERE `key` = 'header'");
      expect(JSON.stringify(row.value)).not.toContain("javascript:");
      // An empty button with the button switched on is refused too.
      await page.getByLabel("Button link").fill("/contact");
      await page.getByLabel("Button text").fill("");
      await page.getByRole("button", { name: "Save header" }).click();
      await expect(page.getByText("Enter the button text").first()).toBeVisible();
    } finally {
      await page.goto("/admin/header");
      await page.getByLabel("Button text").fill(orig.cta);
      await page.getByLabel("Brand name (first line)").fill(orig.brand);
      const added = page.locator("ol li").filter({ has: page.locator("input[value='E2E Link']") });
      if (await added.count()) await added.getByRole("button", { name: /^Remove/ }).click();
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
    }
    await gone(request, "/about", "E2E Link");
    await until(request, "/about", orig.cta);
  });

  test("sub-services: add one under Services in the header menu, see it in the dropdown, then delete it", async ({ page, request }) => {
    const cleanup = async () => {
      await page.goto("/admin/header");
      const added = page.locator("ol li").filter({ has: page.locator("input[value='E2E Sub Service']") });
      if (await added.count()) {
        await added.getByRole("button", { name: /^Remove/ }).click();
        await page.getByRole("button", { name: "Save header" }).click();
        await saved(page, "Header saved");
      }
    };
    try {
      await page.goto("/admin/header");
      await page.getByRole("button", { name: "Add item" }).click();
      const item = page.locator("ol li").last();
      await item.getByLabel("Label").fill("E2E Sub Service");
      await item.locator("input").nth(1).fill("/services/whatsapp-marketing");
      await item.getByLabel("Parent:").selectOption({ label: "Services" });
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
      await until(request, "/about", "E2E Sub Service");
      await page.setViewportSize({ width: 1366, height: 800 });
      await page.goto("/about");
      await expect(page.locator("header a", { hasText: "E2E Sub Service" }).first()).toHaveAttribute("href", "/services/whatsapp-marketing");
      await page.locator("header a", { hasText: "Services" }).first().hover();
      await expect(page.locator("header a", { hasText: "E2E Sub Service" }).first()).toBeVisible();
      // edit
      await page.goto("/admin/header");
      const row = page.locator("ol li").filter({ has: page.locator("input[value='E2E Sub Service']") });
      await row.getByLabel("Label").fill("E2E Sub Service Renamed");
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
      await until(request, "/about", "E2E Sub Service Renamed");
    } finally {
      await page.goto("/admin/header");
      const rows = page.locator("ol li").filter({ has: page.locator("input[value^='E2E Sub Service']") });
      if (await rows.count()) {
        await rows.first().getByRole("button", { name: /^Remove/ }).click();
        await page.getByRole("button", { name: "Save header" }).click();
        await saved(page, "Header saved");
      }
    }
    await gone(request, "/about", "E2E Sub Service");
    void cleanup;
  });

  test("the button can be hidden", async ({ page, request }) => {
    await page.goto("/admin/header");
    const orig = await page.getByLabel("Button text").inputValue();
    try {
      await page.getByLabel("Show the button").uncheck();
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
      await gone(request, "/about", `>${orig}<`);
    } finally {
      await page.goto("/admin/header");
      await page.getByLabel("Show the button").check();
      await page.getByRole("button", { name: "Save header" }).click();
      await saved(page, "Header saved");
    }
    await until(request, "/about", orig);
  });
});

test.describe("footer management", () => {
  test("description, copyright, services, contact, social and links reach the public site", async ({ page, request }) => {
    await page.goto("/admin/footer");
    const f = {
      copyright: page.getByLabel("Copyright text"),
      blurb: page.getByLabel("Footer description"),
      x: page.getByLabel("X (Twitter)"),
      limit: page.getByLabel("Most services to list"),
      line: page.getByLabel("Line at the bottom right"),
      phone: page.getByLabel("Phone"),
    };
    const orig = { copyright: await f.copyright.inputValue(), blurb: await f.blurb.inputValue(), x: await f.x.inputValue(), limit: await f.limit.inputValue(), line: await f.line.inputValue(), phone: await f.phone.inputValue() };
    try {
      await f.copyright.fill("E2E Rights Reserved");
      await f.blurb.fill("E2E footer description");
      await f.x.fill("https://x.com/e2e_shreeji");
      await f.limit.fill("3");
      await f.line.fill("E2E bottom line");
      await f.phone.fill("+91 90000 00000");
      await page.getByRole("button", { name: "Add item" }).first().click();
      const item = page.locator("ol").first().locator("li").last();
      await item.getByLabel("Label").fill("E2E Footer Link");
      await item.locator("input").nth(1).fill("/faq");
      await page.getByRole("button", { name: "Save footer" }).click();
      await saved(page, "Footer saved");

      await until(request, "/about", "E2E Rights Reserved");
      await page.goto("/about");
      const footer = page.locator("footer");
      await expect(footer).toContainText("E2E footer description");
      await expect(footer).toContainText("E2E bottom line");
      await expect(footer.locator('a[href="https://x.com/e2e_shreeji"]')).toHaveAttribute("aria-label", /on X$/);
      await expect(footer.locator('a[href^="tel:"]')).toHaveAttribute("href", "tel:+919000000000");
      await expect(footer.locator('a[href^="/services/"]')).toHaveCount(3);
      await expect(footer.getByRole("link", { name: "E2E Footer Link" })).toHaveAttribute("href", "/faq");
      // The same phone number is used on the Contact page (one source of truth).
      expect(await live(request, "/contact")).toContain("+91 90000 00000");

      // Validation: bad social URL and bad email are refused and nothing is saved.
      await page.goto("/admin/footer");
      await page.getByLabel("Instagram").fill("http://insecure.example");
      await page.getByRole("button", { name: "Save footer" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "instagram" }).first()).toBeVisible();
      await page.getByLabel("Instagram").fill("https://www.instagram.com/shreeji_marketing__");
      await page.getByLabel("Email").fill("user@host");
      await page.getByRole("button", { name: "Save footer" }).click();
      await expect(page.getByText("Enter a valid email address").first()).toBeVisible();
    } finally {
      await page.goto("/admin/footer");
      await page.getByLabel("Copyright text").fill(orig.copyright);
      await page.getByLabel("Footer description").fill(orig.blurb);
      await page.getByLabel("X (Twitter)").fill(orig.x);
      await page.getByLabel("Most services to list").fill(orig.limit);
      await page.getByLabel("Line at the bottom right").fill(orig.line);
      await page.getByLabel("Phone").fill(orig.phone);
      const added = page.locator("ol li").filter({ has: page.locator("input[value='E2E Footer Link']") });
      if (await added.count()) await added.getByRole("button", { name: /^Remove/ }).click();
      await page.getByRole("button", { name: "Save footer" }).click();
      await saved(page, "Footer saved");
    }
    await gone(request, "/about", "E2E Rights Reserved");
    expect(await live(request, "/about")).not.toContain("E2E Footer Link");
  });

  test("the services column can be hidden", async ({ page, request }) => {
    await page.goto("/admin/footer");
    try {
      await page.getByLabel("Show the services column").uncheck();
      await page.getByRole("button", { name: "Save footer" }).click();
      await saved(page, "Footer saved");
      await expect.poll(async () => ((await live(request, "/about")).split("<footer")[1] ?? "").includes('href="/services/'), { timeout: 25_000 }).toBe(false);
    } finally {
      await page.goto("/admin/footer");
      await page.getByLabel("Show the services column").check();
      await page.getByRole("button", { name: "Save footer" }).click();
      await saved(page, "Footer saved");
    }
  });

  test("the sidebar has separate Header Management and Footer Management items; the Menus screen points to them", async ({ page }) => {
    await page.goto("/admin");
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: "Header Management" })).toHaveAttribute("href", "/admin/header");
    await expect(nav.getByRole("link", { name: "Footer Management" })).toHaveAttribute("href", "/admin/footer");
    await page.goto("/admin/menus");
    await expect(page.getByRole("link", { name: "Open Header Management" })).toBeVisible();
  });
});

test.describe("About page team section", () => {
  const stamp = Date.now().toString(36);

  test("create, edit, reorder, hide, retitle and delete team members; changes persist and show on the About page", async ({ page, request }) => {
    const before = await query<{ id: number; sortOrder: number }>("SELECT id, sortOrder FROM TeamMember ORDER BY sortOrder, id");
    const heading = page.locator("#team-heading");
    try {
      // Create (new members go to the end by default).
      await page.goto("/admin/team/new");
      await page.getByLabel(/^Name/).fill(`E2E Alice ${stamp}`);
      await page.getByLabel(/^Role/).fill("E2E Role");
      await page.getByLabel("Full title (optional)").fill("E2E Full Title");
      await page.getByRole("button", { name: "Add team member" }).click();
      await expect(page).toHaveURL(/\/admin\/team\/\d+/);
      const aliceId = Number(page.url().match(/team\/(\d+)/)![1]);
      const [created] = await query<{ sortOrder: number }>("SELECT sortOrder FROM TeamMember WHERE id = ?", [aliceId]);
      expect(created.sortOrder, "appended after the existing members").toBeGreaterThan(Math.max(...before.map((b) => b.sortOrder)));
      await until(request, "/about", `E2E Alice ${stamp}`);
      expect(await live(request, "/about")).toContain("E2E Full Title");

      // Edit + persistence after reload.
      await page.goto(`/admin/team/${aliceId}`);
      await page.getByLabel(/^Name/).fill(`E2E Alicia ${stamp}`);
      await page.getByRole("button", { name: "Save team member" }).click();
      await saved(page, "Team member saved");
      await page.reload();
      await expect(page.getByLabel(/^Name/)).toHaveValue(`E2E Alicia ${stamp}`);
      await until(request, "/about", `E2E Alicia ${stamp}`);

      // Photo.
      await page.getByRole("button", { name: "Choose image" }).click();
      const dialog = page.getByRole("dialog", { name: "Media library" });
      await dialog.getByRole("listitem").first().getByRole("button").click();
      await page.getByRole("button", { name: "Save team member" }).click();
      await saved(page, "Team member saved");
      const [{ photoId }] = await query<{ photoId: number | null }>("SELECT photoId FROM TeamMember WHERE id = ?", [aliceId]);
      expect(photoId).not.toBeNull();
      await until(request, "/about", new RegExp(`/media/${photoId}`));

      // Reorder: move her to the top.
      await page.goto("/admin/team");
      for (let i = 0; i < before.length; i++) await page.getByRole("button", { name: `Move E2E Alicia ${stamp} up` }).click().catch(() => {});
      await expect.poll(async () => (await query<{ id: number }>("SELECT id FROM TeamMember ORDER BY sortOrder, id LIMIT 1"))[0].id, { timeout: 15_000 }).toBe(aliceId);
      await expect.poll(async () => ((await live(request, "/about")).match(/<h3[^>]*>([^<]+)<\/h3>/g) ?? [])[0] ?? "", { timeout: 25_000 }).toContain(`E2E Alicia ${stamp}`);

      // Hide / show.
      await page.goto("/admin/team");
      await page.getByRole("row").filter({ hasText: `E2E Alicia ${stamp}` }).getByRole("button", { name: "Hide" }).click();
      await expect(page.getByText("Team member hidden").first()).toBeVisible();
      await gone(request, "/about", `E2E Alicia ${stamp}`);
      await page.getByRole("row").filter({ hasText: `E2E Alicia ${stamp}` }).getByRole("button", { name: "Show" }).click();
      await until(request, "/about", `E2E Alicia ${stamp}`);

      // Section heading.
      await page.goto("/admin/team");
      const eyebrow = page.getByLabel(/^Label$/);
      const title = page.getByLabel(/^Heading/);
      const orig = { eyebrow: await eyebrow.inputValue(), title: await title.inputValue() };
      try {
        await title.fill(`E2E Heading ${stamp}`);
        await page.getByRole("button", { name: "Save heading" }).click();
        await expect(page.getByText("Team section heading saved").first()).toBeVisible();
        await until(request, "/about", `E2E Heading ${stamp}`);
        await page.goto("/about");
        await expect(heading).toHaveText(`E2E Heading ${stamp}`);
      } finally {
        await page.goto("/admin/team");
        await page.getByLabel(/^Heading/).fill(orig.title);
        await page.getByLabel(/^Label$/).fill(orig.eyebrow);
        await page.getByRole("button", { name: "Save heading" }).click();
        await expect(page.getByText("Team section heading saved").first()).toBeVisible();
      }

      // The About page editor points to the Team module.
      const [about] = await query<{ id: number }>("SELECT id FROM Page WHERE slug = 'about'");
      await page.goto(`/admin/pages/${about.id}`);
      await expect(page.getByRole("link", { name: "Team", exact: true }).first()).toBeVisible();

      // Delete.
      await page.goto("/admin/team");
      await page.getByRole("row").filter({ hasText: `E2E Alicia ${stamp}` }).getByRole("button", { name: "Delete" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
      await expect(page.getByText(/Removed/).first()).toBeVisible();
      await gone(request, "/about", `E2E Alicia ${stamp}`);
    } finally {
      await query("DELETE FROM TeamMember WHERE name LIKE 'E2E %'");
      // Existing members keep their original relative order after the test.
      for (const b of before) await query("UPDATE TeamMember SET sortOrder = ? WHERE id = ?", [b.sortOrder, b.id]);
    }
    const after = await query<{ id: number }>("SELECT id FROM TeamMember ORDER BY sortOrder, id");
    expect(after.map((a) => a.id)).toEqual(before.map((b) => b.id));
  });

  test("team admin needs a signed-in user with content permission", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const res = await anon.get("/admin/team", { maxRedirects: 0 });
    expect([302, 307]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/admin/login");
    await anon.dispose();
  });
});
