import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { PUBLIC_ROUTES } from "./helpers";
import { query } from "./db";

/**
 * Admin management of the Homepage, the Contact page and every service page:
 * coverage of the public routes, admin → site updates, persistence, section switches,
 * images, SEO metadata, validation and access control. Every test restores what it changed.
 */
test.use({ storageState: AUTH_FILE });

const live = async (request: import("@playwright/test").APIRequestContext, path: string) => (await request.get(path)).text();
const until = async (request: import("@playwright/test").APIRequestContext, path: string, needle: string | RegExp) => {
  await expect
    .poll(async () => {
      const html = await live(request, path);
      return typeof needle === "string" ? html.includes(needle) : needle.test(html);
    }, { timeout: 25_000 })
    .toBe(true);
};
const gone = async (request: import("@playwright/test").APIRequestContext, path: string, needle: string) => {
  await expect.poll(async () => (await live(request, path)).includes(needle), { timeout: 25_000 }).toBe(false);
};

async function pickSecondImage(page: Page, inputName: string) {
  const picker = page.locator(`div:has(> input[name="${inputName}"])`).first();
  await picker.getByRole("button", { name: /Choose image|Change image/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("listitem").first()).toBeVisible();
  await dialog.getByRole("listitem").nth(1).getByRole("button").click();
  const id = await picker.locator(`input[name="${inputName}"]`).inputValue();
  expect(Number(id)).toBeGreaterThan(0);
  return id;
}

test.describe("coverage: every public page has an admin screen", () => {
  test("home, contact, about and all 15 services are editable in the admin", async ({ page, request }) => {
    const services = await query<{ id: number; slug: string; status: string }>("SELECT id, slug, status FROM Service ORDER BY sortOrder");
    const routeSlugs = PUBLIC_ROUTES.filter((r) => r.startsWith("/services/")).map((r) => r.replace("/services/", "")).sort();
    // A service added in the database but missing from the route list would otherwise go untested.
    expect(services.map((s) => s.slug).sort()).toEqual(routeSlugs);
    expect(services).toHaveLength(15);

    for (const route of ["/", "/contact", "/about"]) expect((await request.get(route)).status(), route).toBe(200);
    for (const s of services) expect((await request.get(`/services/${s.slug}`)).status(), s.slug).toBe(200);

    await page.goto("/admin/home-page");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Homepage");
    await page.goto("/admin/contact-page");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Contact page");
    const [about] = await query<{ id: number }>("SELECT id FROM Page WHERE slug = 'about'");
    await page.goto(`/admin/pages/${about.id}`);
    await expect(page.getByLabel("Excerpt")).toBeVisible();
    for (const s of services) {
      await page.goto(`/admin/services/${s.id}`);
      await expect(page.getByRole("button", { name: "Save service" }), s.slug).toBeVisible();
      await expect(page.getByText("Page sections & wording")).toBeVisible();
      await expect(page.getByLabel("URL slug")).toHaveValue(s.slug);
    }

    // The index lists them all, split into main and additional services.
    await page.goto("/admin/site-pages");
    for (const s of services) await expect(page.getByRole("link", { name: `/services/${s.slug}` })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Main", exact: true })).toHaveCount(8);
    await expect(page.getByRole("cell", { name: "Additional", exact: true })).toHaveCount(7);
  });
});

test.describe.serial("Homepage", () => {
  test("text, buttons, section switches and SEO reach the site and persist; then restore", async ({ page, request }) => {
    const tag = `E2E Home ${Date.now().toString(36)}`;
    await page.goto("/admin/home-page");
    const headline = page.getByLabel("Headline", { exact: true });
    const seoTitle = page.getByLabel("SEO title");
    const pills = page.getByLabel("Topic tags");
    const faq = page.getByLabel("FAQ", { exact: true });
    const orig = { headline: await headline.inputValue(), seo: await seoTitle.inputValue(), pills: await pills.inputValue(), faq: await faq.isChecked() };
    const baseline = await live(request, "/");
    try {
      await headline.fill(`${tag} headline`);
      await seoTitle.fill(`${tag} SEO`);
      await pills.fill("E2E Pill One\nE2E Pill Two");
      await page.getByLabel("Hero picture description (alt text)").fill("E2E hero alt text");
      await faq.uncheck();
      await page.getByRole("button", { name: "Save homepage" }).click();
      await expect(page.getByRole("status")).toContainText("Homepage saved");

      await until(request, "/", `${tag} headline`);
      const html = await live(request, "/");
      expect(html).toMatch(new RegExp(`<title>[^<]*${tag} SEO[^<]*</title>`));
      expect(html).toContain("E2E Pill One");
      expect(html).toContain("E2E Pill Two");
      expect(html).toContain("E2E hero alt text");
      if (baseline.includes('id="faq-title"')) expect(html).not.toContain('id="faq-title"');

      await page.reload();
      await expect(headline).toHaveValue(`${tag} headline`);
      await expect(seoTitle).toHaveValue(`${tag} SEO`);
      await expect(faq).not.toBeChecked();
      await expect(pills).toHaveValue("E2E Pill One\nE2E Pill Two");
    } finally {
      await page.goto("/admin/home-page");
      await headline.fill(orig.headline);
      await seoTitle.fill(orig.seo);
      await pills.fill(orig.pills);
      await page.getByLabel("Hero picture description (alt text)").fill("");
      if (orig.faq) await faq.check();
      await page.getByRole("button", { name: "Save homepage" }).click();
      await expect(page.getByRole("status")).toContainText("Homepage saved");
    }
    await gone(request, "/", tag);
    if (baseline.includes('id="faq-title"')) await until(request, "/", 'id="faq-title"');
  });

  test("unsafe links and bad hero image ids are rejected without changing anything", async ({ page, request }) => {
    const before = await live(request, "/");
    await page.goto("/admin/home-page");
    await page.getByLabel("Main button link").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save homepage" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.goto("/admin/home-page");
    await page.locator('input[name="heroMediaId"]').evaluate((el: HTMLInputElement) => (el.value = "99999999"));
    await page.getByRole("button", { name: "Save homepage" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Choose images from the media library");
    expect(await live(request, "/")).toBe(before);
  });

  test("hero picture: choose one, see it live, replace, remove (falls back to the built-in photo)", async ({ page, request }) => {
    await page.goto("/admin/home-page");
    const id = await pickSecondImage(page, "heroMediaId");
    await page.getByRole("button", { name: "Save homepage" }).click();
    await expect(page.getByRole("status")).toContainText("Homepage saved");
    await until(request, "/", `%2Fmedia%2F${id}%3Fv%3D`);
    await page.reload();
    await expect(page.locator('input[name="heroMediaId"]')).toHaveValue(id);

    await page.locator('div:has(> input[name="heroMediaId"])').first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Save homepage" }).click();
    await expect(page.getByRole("status")).toContainText("Homepage saved");
    await until(request, "/", "%2Fimages%2Fbanners%2Fhome.webp");
  });

  test("saving the old Settings > Homepage form does not reset the new switches", async ({ page, request }) => {
    await page.goto("/admin/home-page");
    const work = page.getByLabel("Projects", { exact: true });
    const wasOn = await work.isChecked();
    try {
      await work.uncheck();
      await page.getByRole("button", { name: "Save homepage" }).click();
      await expect(page.getByRole("status")).toContainText("Homepage saved");

      await page.goto("/admin/settings");
      const home = page.locator("section", { has: page.getByRole("heading", { name: "Homepage" }) });
      await home.getByRole("button", { name: "Save" }).click();
      await expect(home.getByRole("status")).toContainText("Settings saved");

      await page.goto("/admin/home-page");
      await expect(work).not.toBeChecked();
    } finally {
      await page.goto("/admin/home-page");
      if (wasOn) await work.check();
      await page.getByRole("button", { name: "Save homepage" }).click();
      await expect(page.getByRole("status")).toContainText("Homepage saved");
    }
    await until(request, "/", 'id="work"');
  });
});

test.describe.serial("Contact page", () => {
  test("banner text, details, labels and SEO reach the site and persist; the form still works; then restore", async ({ page, request }) => {
    const tag = `E2E Contact ${Date.now().toString(36)}`;
    await page.goto("/admin/contact-page");
    const title = page.getByLabel("Heading (page title)");
    const intro = page.getByLabel("Intro under the heading");
    const phone = page.getByLabel("Phone", { exact: true });
    const callLabel = page.getByLabel("Phone label");
    const hours = page.getByLabel("Opening hours (optional)");
    const seoTitle = page.getByLabel("SEO title");
    const orig = { title: await title.inputValue(), intro: await intro.inputValue(), phone: await phone.inputValue(), call: await callLabel.inputValue(), hours: await hours.inputValue(), seo: await seoTitle.inputValue() };
    try {
      await title.fill(`${tag} title`);
      await intro.fill(`${tag} intro`);
      await phone.fill("+91 90000 11111");
      await callLabel.fill(`${tag} call`);
      await hours.fill("Mon-Fri 10-6 E2E");
      await seoTitle.fill(`${tag} SEO`);
      await page.getByRole("button", { name: "Save contact page" }).click();
      await expect(page.getByRole("status")).toContainText("Contact page saved");

      await until(request, "/contact", `${tag} title`);
      const html = await live(request, "/contact");
      expect(html).toContain(`${tag} intro`);
      expect(html).toContain("+91 90000 11111");
      expect(html).toContain(`${tag} call`);
      expect(html).toContain("Mon-Fri 10-6 E2E");
      expect(html).toMatch(new RegExp(`<title>[^<]*${tag} SEO[^<]*</title>`));
      // The enquiry section (and so the form) appears on every page, with the new details.
      await until(request, "/services", "+91 90000 11111");

      await page.reload();
      await expect(title).toHaveValue(`${tag} title`);
      await expect(seoTitle).toHaveValue(`${tag} SEO`);
    } finally {
      await page.goto("/admin/contact-page");
      await title.fill(orig.title);
      await intro.fill(orig.intro);
      await phone.fill(orig.phone);
      await callLabel.fill(orig.call);
      await hours.fill(orig.hours);
      await seoTitle.fill(orig.seo);
      await page.getByRole("button", { name: "Save contact page" }).click();
      await expect(page.getByRole("status")).toContainText("Contact page saved");
    }
    await gone(request, "/contact", tag);

    // The enquiry form is still there. Submitting it (validation, honeypot, stored lead) is covered by admin.spec.ts.
    await page.goto("/contact");
    const form = page.locator("#contact form");
    await expect(form.getByLabel(/First name/)).toBeVisible();
    await expect(form.getByRole("button", { name: "Send enquiry" })).toBeVisible();
  });

  test("validation: bad email, empty title and bad banner id are rejected", async ({ page }) => {
    await page.goto("/admin/contact-page");
    const email = page.getByLabel("Email", { exact: true });
    const good = await email.inputValue();
    await email.evaluate((el: HTMLInputElement) => el.removeAttribute("type"));
    await email.fill("not-an-email");
    await page.getByRole("button", { name: "Save contact page" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await email.fill(good);

    await page.getByLabel("Heading (page title)").fill("");
    await page.getByRole("button", { name: "Save contact page" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    await page.goto("/admin/contact-page");
    await page.locator('input[name="featuredMediaId"]').evaluate((el: HTMLInputElement) => (el.value = "99999999"));
    await page.getByRole("button", { name: "Save contact page" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Choose images from the media library");
  });

  test("banner picture: choose, see it live, persists, remove", async ({ page, request }) => {
    await page.goto("/admin/contact-page");
    const id = await pickSecondImage(page, "featuredMediaId");
    await page.getByRole("button", { name: "Save contact page" }).click();
    await expect(page.getByRole("status")).toContainText("Contact page saved");
    await until(request, "/contact", `%2Fmedia%2F${id}%3Fv%3D`);
    await page.reload();
    await expect(page.locator('input[name="featuredMediaId"]')).toHaveValue(id);
    await page.locator('div:has(> input[name="featuredMediaId"])').first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("button", { name: "Save contact page" }).click();
    await expect(page.getByRole("status")).toContainText("Contact page saved");
    await until(request, "/contact", "%2Fimages%2Fbanners%2Fcontact.webp");
  });
});

test.describe("service pages (all 15)", () => {
  test.describe.configure({ mode: "serial" });
  let services: { id: number; slug: string; title: string }[] = [];

  test.beforeAll(async () => {
    services = await query<{ id: number; slug: string; title: string }>("SELECT id, slug, title FROM Service ORDER BY sortOrder");
  });

  for (const slug of PUBLIC_ROUTES.filter((r) => r.startsWith("/services/")).map((r) => r.replace("/services/", ""))) {
    test(`${slug}: heading, section wording, button and SEO update only this service`, async ({ page, request }) => {
      const svc = services.find((s) => s.slug === slug)!;
      const other = services.find((s) => s.slug !== slug)!;
      const tag = `E2E ${services.findIndex((s) => s.slug === slug) + 1}-${Date.now().toString(36)}`;
      await page.goto(`/admin/services/${svc.id}`);
      const hero = page.getByLabel("Hero heading");
      const benefits = page.getByLabel("Gains section heading");
      const btn = page.getByLabel("Main button label");
      const seoTitle = page.getByLabel("SEO title");
      const orig = { hero: await hero.inputValue(), benefits: await benefits.inputValue(), btn: await btn.inputValue(), seo: await seoTitle.inputValue() };
      try {
        await hero.fill(`${tag} hero`);
        await benefits.fill(`${tag} benefits`);
        await btn.fill(`${tag} button`);
        await seoTitle.fill(`${tag} SEO`);
        await page.getByRole("button", { name: "Save service" }).click();
        await expect(page.getByRole("status")).toContainText("Service saved");

        await until(request, `/services/${slug}`, `${tag} hero`);
        const html = await live(request, `/services/${slug}`);
        expect(html).toContain(`${tag} benefits`);
        expect(html).toContain(`${tag} button`);
        expect(html).toMatch(new RegExp(`<title>[^<]*${tag} SEO[^<]*</title>`));
        expect(html).toContain(`"@context"`);

        // Only this service changed.
        const otherAfter = await live(request, `/services/${other.slug}`);
        expect(otherAfter).not.toContain(tag);

        await page.reload();
        await expect(hero).toHaveValue(`${tag} hero`);
        await expect(seoTitle).toHaveValue(`${tag} SEO`);
      } finally {
        await page.goto(`/admin/services/${svc.id}`);
        await hero.fill(orig.hero);
        await benefits.fill(orig.benefits);
        await btn.fill(orig.btn);
        await seoTitle.fill(orig.seo);
        await page.getByRole("button", { name: "Save service" }).click();
        await expect(page.getByRole("status")).toContainText("Service saved");
      }
      await gone(request, `/services/${slug}`, tag);
    });
  }

  test("FAQs and section switches: add a FAQ, hide Process, then restore", async ({ page, request }) => {
    const svc = services.find((s) => s.slug === "seo")!;
    await page.goto(`/admin/services/${svc.id}`);
    const faqs = page.getByLabel("FAQs about this service");
    const origFaqs = await faqs.inputValue();
    const baseline = await live(request, "/services/seo");
    try {
      await faqs.fill("E2E Does it work? | Yes, E2E answer text.\nE2E Second question? | Second E2E answer.");
      await page.getByRole("checkbox", { name: "Delivery steps" }).uncheck();
      await page.getByRole("button", { name: "Save service" }).click();
      await expect(page.getByRole("status")).toContainText("Service saved");

      await until(request, "/services/seo", "E2E Does it work?");
      const html = await live(request, "/services/seo");
      expect(html).toContain("Yes, E2E answer text.");
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).not.toContain('id="process-title"');
      if (baseline.includes('id="process-title"')) expect(html).not.toContain("How we deliver");
      // Site-wide FAQ list is untouched.
      expect(await live(request, "/faq")).not.toContain("E2E Does it work?");
    } finally {
      await page.goto(`/admin/services/${svc.id}`);
      await faqs.fill(origFaqs);
      await page.getByRole("checkbox", { name: "Delivery steps" }).check();
      await page.getByRole("button", { name: "Save service" }).click();
      await expect(page.getByRole("status")).toContainText("Service saved");
    }
    await gone(request, "/services/seo", "E2E Does it work?");
    if (baseline.includes('id="process-title"')) await until(request, "/services/seo", 'id="process-title"');
  });

  test("unsafe button links are rejected on the service form", async ({ page }) => {
    await page.goto(`/admin/services/${services[0].id}`);
    await page.getByLabel("Main button link").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save service" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
});

test.describe("access control", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signed-out visitors are sent to the login page and cannot reach the new screens", async ({ request }) => {
    for (const path of ["/admin/home-page", "/admin/contact-page", "/admin/services/1", "/admin/site-pages"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308], path).toContain(res.status());
      expect(res.headers().location ?? "", path).toContain("/admin/login");
    }
  });
});

test.describe.serial("Pages Management table", () => {
  test("lists Home, About, Contact, legal pages and all 15 services exactly once, with working Edit and Preview", async ({ page }) => {
    const services = await query<{ id: number; slug: string }>("SELECT id, slug FROM Service");
    const pages = await query<{ id: number; slug: string }>("SELECT id, slug FROM Page WHERE slug NOT LIKE 'e2e-%'");
    await page.goto("/admin/pages?q=");
    // 20 rows per page: walk every page of the list and collect the URL column.
    const urls: string[] = [];
    for (let n = 1; n <= 5; n++) {
      await page.goto(`/admin/pages?page=${n}`);
      urls.push(...(await page.locator("tbody tr td:nth-child(2)").allTextContents()).map((t) => t.trim()));
    }
    const expected = ["/", ...pages.map((p) => `/${p.slug}`), ...services.map((s) => `/services/${s.slug}`)];
    for (const u of expected) expect(urls.filter((x) => x === u), u).toHaveLength(1);
    for (const u of ["/about", "/contact", "/privacy-policy", "/terms-and-conditions", "/cookie-policy"]) expect(urls, u).toContain(u);

    // Columns and actions are the same as before.
    await expect(page.getByRole("columnheader", { name: "Title" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "URL" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Updated" })).toBeVisible();

    // Edit and Preview of a service row open that service.
    const svc = services.find((s) => s.slug === "seo")!;
    await page.goto("/admin/pages?q=seo");
    const row = page.getByRole("row").filter({ has: page.getByText("/services/seo", { exact: true }) });
    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/services/${svc.id}$`));
    await page.goto("/admin/pages?q=seo");
    await page.getByRole("row").filter({ has: page.getByText("/services/seo", { exact: true }) }).getByRole("link", { name: "Preview" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/preview/services/${svc.id}$`));

    // The Home row edits the homepage and cannot be unpublished or deleted.
    await page.goto("/admin/pages?q=home");
    const home = page.getByRole("row").filter({ has: page.getByText("/", { exact: true }) });
    await expect(home.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/admin/home-page");
    await expect(home.getByRole("button", { name: /Unpublish|Delete/ })).toHaveCount(0);
  });

  test("unpublish and publish a service from the table changes the live page, then restores it", async ({ page, request }) => {
    // Uses a scratch service so no real content is ever unpublished.
    const slug = `e2e-scratch-${Date.now().toString(36)}`;
    const [cat] = await query<{ id: number }>("SELECT id FROM ServiceCategory ORDER BY id LIMIT 1");
    await query("INSERT INTO Service (categoryId, title, slug, summary, icon, status, publishedAt, sortOrder, updatedAt) VALUES (?, 'E2E Scratch Service', ?, 'Scratch service for the publishing test.', 'sparkles', 'PUBLISHED', NOW() - INTERVAL 1 DAY, 9999, NOW())", [cat.id, slug]);
    try {
      await page.goto(`/admin/pages?q=${slug}`);
      const row = () => page.getByRole("row").filter({ has: page.getByText(`/services/${slug}`, { exact: true }) });
      await expect(row().getByText("Published")).toBeVisible();
      await row().getByRole("button", { name: "Unpublish" }).click();
      await expect(page).toHaveURL(/\/admin\/pages\?msg=/);
      await page.goto(`/admin/pages?q=${slug}`);
      await expect(row().getByText("Draft")).toBeVisible();
      await expect.poll(async () => (await request.get(`/services/${slug}`)).status(), { timeout: 25_000 }).toBe(404);
      await row().getByRole("button", { name: "Publish" }).click();
      await page.goto(`/admin/pages?q=${slug}`);
      await expect(row().getByText("Published")).toBeVisible();
      await expect.poll(async () => (await request.get(`/services/${slug}`)).status(), { timeout: 25_000 }).toBe(200);
    } finally {
      await query("DELETE FROM Service WHERE slug = ?", [slug]);
    }
  });
});
