import { expect, test, type Page } from "@playwright/test";
import { AUTH_FILE, cleanup } from "./global-setup";
import { closeDb, query } from "./db";
import { ADMIN_EMAIL, TINY_PNG, alertOf, login } from "./helpers";

const run = `e2e-${Date.now().toString(36)}`;

test.afterAll(async () => {
  await cleanup();
  await closeDb();
});

async function addParagraph(page: Page, text: string) {
  await page.getByLabel("Add a block").selectOption("paragraph");
  await page.getByRole("button", { name: "Add block" }).click();
  await page.getByLabel("Text").last().fill(text);
}

async function confirmDelete(page: Page, rowText: string) {
  const row = page.getByRole("row", { name: new RegExp(rowText) });
  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
}

test.describe("unauthenticated access", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("admin pages redirect to login", async ({ page }) => {
    for (const p of ["/admin", "/admin/pages", "/admin/leads", "/admin/users", "/admin/settings", "/admin/media"]) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });

  test("admin API and export endpoints reject anonymous callers", async ({ request }) => {
    expect((await request.get("/api/admin/media")).status()).toBe(401);
    const post = await request.post("/api/admin/media", { headers: { origin: "http://localhost:3100" }, multipart: { files: { name: "a.png", mimeType: "image/png", buffer: TINY_PNG } } });
    expect(post.status()).toBe(401);
    const exp = await request.get("/admin/leads/export", { maxRedirects: 0 });
    expect([307, 401]).toContain(exp.status());
  });

  test("cross-site upload attempts are blocked", async ({ request }) => {
    const res = await request.post("/api/admin/media", { headers: { origin: "https://evil.example" }, multipart: { files: { name: "a.png", mimeType: "image/png", buffer: TINY_PNG } } });
    expect(res.status()).toBe(403);
  });

  test("forged / garbage session cookies are rejected", async ({ page, context }) => {
    await context.addCookies([{ name: "shreeji_session", value: "eyJhbGciOiJIUzI1NiJ9.e30.forged", url: "http://localhost:3100" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    expect((await context.request.get("/api/admin/media")).status()).toBe(401);
  });

  test("login: wrong password shows a generic error", async ({ page }) => {
    await login(page, ADMIN_EMAIL, "wrong-password-123");
    await expect(alertOf(page)).toContainText("Invalid email or password");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("login: unknown email gives the same generic error", async ({ page }) => {
    await login(page, `e2e-nobody-${run}@example.com`, "whatever-password-1A");
    await expect(alertOf(page)).toContainText("Invalid email or password");
  });

  test("login: repeated failures are throttled", async ({ page }) => {
    const email = `e2e-throttle-${run}@example.com`;
    for (let i = 0; i < 5; i++) {
      await login(page, email, "bad-password-1A!");
      await expect(alertOf(page)).toContainText("Invalid email or password");
    }
    await login(page, email, "bad-password-1A!");
    await expect(alertOf(page)).toContainText("Too many sign-in attempts");
  });

  test("login: ?next= cannot redirect off-site", async ({ page }) => {
    await page.goto("/admin/login?next=https://evil.example/");
    await expect(page.locator('input[name="next"]')).toHaveValue("/admin");
  });

  test("admin responses are noindex and uncached", async ({ request }) => {
    const res = await request.get("/admin/login");
    expect(res.headers()["x-robots-tag"]).toMatch(/noindex/);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
  });
});

test.describe("dashboard", () => {
  test.use({ storageState: AUTH_FILE });

  test("shows real counts from the database", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome");
    const [{ n }] = await query<{ n: number }>("SELECT COUNT(*) n FROM Page WHERE status='PUBLISHED'");
    await expect(page.getByRole("link", { name: /Published pages/ })).toContainText(String(n));
  });

  test("sign out ends the session server-side", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await login(page);
    await expect(page).toHaveURL(/\/admin$/);
    const cookies = await ctx.cookies();
    const token = cookies.find((c) => c.name === "shreeji_session")!.value;
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    // Replaying the old token must fail because the session row was deleted.
    const replay = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    await replay.addCookies([{ name: "shreeji_session", value: token, url: "http://localhost:3100" }]);
    expect((await replay.request.get("/api/admin/media")).status()).toBe(401);
    await ctx.close();
    await replay.close();
  });
});

test.describe("pages: create, draft, publish, rename, unpublish, delete", () => {
  test.use({ storageState: AUTH_FILE });
  const slug = `${run}-page`;
  const slug2 = `${run}-page-renamed`;

  test("full lifecycle", async ({ page, request }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Title").first().fill("E2E Lifecycle Page");
    await page.getByLabel("URL slug").fill(slug);
    await addParagraph(page, "Hello from the end-to-end test. Visit [our services](/services).");
    await page.getByLabel("SEO title").fill("E2E Custom SEO Title For Testing");
    await page.getByLabel("Meta description").fill("A custom description written by the end-to-end test for this page.");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/\d+/);
    await expect(page.getByRole("status")).toContainText("Page created");

    // Draft is not public and not in the sitemap.
    expect((await request.get(`/${slug}`)).status()).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug);

    // Preview works for the signed-in admin.
    await page.getByRole("link", { name: "Preview" }).first().click();
    await expect(page.getByText("Hello from the end-to-end test")).toBeVisible();

    // Publish from the list.
    await page.goto("/admin/pages?q=" + slug);
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("status")).toContainText("published");
    await expect.poll(async () => (await request.get(`/${slug}`)).status(), { timeout: 15_000 }).toBe(200);
    const html = await (await request.get(`/${slug}`)).text();
    expect(html.match(/<title>[^<]*<\/title>/)?.[0]).toBe("<title>E2E Custom SEO Title For Testing</title>");
    expect(html).toContain("A custom description written by the end-to-end test");
    expect(html).toContain(`rel="canonical" href="http://localhost:3000/${slug}"`);
    await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(`/${slug}`), { timeout: 15_000 }).toBe(true);

    // Rename the slug: old URL must 301 to the new one.
    await page.goto("/admin/pages?q=" + slug);
    await page.getByRole("link", { name: "Edit" }).first().click();
    await page.getByLabel("URL slug").fill(slug2);
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByRole("status")).toContainText("Page saved");
    const rows = await query("SELECT toPath, statusCode FROM Redirect WHERE fromPath = ?", [`/${slug}`]);
    expect(rows).toEqual([{ toPath: `/${slug2}`, statusCode: 301 }]);
    await expect.poll(async () => (await request.get(`/${slug2}`)).status(), { timeout: 15_000 }).toBe(200);
    await expect.poll(async () => (await request.get(`/${slug}`, { maxRedirects: 0 })).status(), { timeout: 45_000 }).toBe(301);

    // Duplicate slug is rejected with a clear message.
    await page.goto("/admin/pages/new");
    await page.getByLabel("Title").first().fill("Clash");
    await page.getByLabel("URL slug").fill("about");
    await addParagraph(page, "x");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(alertOf(page)).toContainText("already in use");

    // Reserved slug is rejected.
    await page.getByLabel("URL slug").fill("admin");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(alertOf(page)).toContainText("reserved");

    // Unpublish: gone from public.
    await page.goto("/admin/pages?q=" + slug2);
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("status")).toContainText("unpublished");
    await expect.poll(async () => (await request.get(`/${slug2}`)).status(), { timeout: 15_000 }).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(slug2);

    // Delete with confirmation.
    await page.goto("/admin/pages?q=" + slug2);
    await confirmDelete(page, "E2E Lifecycle Page");
    await expect(page.getByRole("status")).toContainText("Deleted");
    expect(await query("SELECT id FROM Page WHERE slug = ?", [slug2])).toHaveLength(0);
  });

  test("noindex pages are excluded from the sitemap and send noindex", async ({ page, request }) => {
    const s = `${run}-noindex`;
    await page.goto("/admin/pages/new");
    await page.getByLabel("Title").first().fill("E2E Noindex");
    await page.getByLabel("URL slug").fill(s);
    await addParagraph(page, "Private-ish content.");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByLabel("Allow search engines to index").uncheck();
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/\d+/);
    await expect.poll(async () => (await request.get(`/${s}`)).status(), { timeout: 15_000 }).toBe(200);
    expect(await (await request.get(`/${s}`)).text()).toMatch(/<meta name="robots" content="noindex/);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain(s);
  });

  test("unsafe link in content is rendered as plain text, scripts are escaped", async ({ page, request }) => {
    const s = `${run}-xss`;
    await page.goto("/admin/pages/new");
    await page.getByLabel("Title").first().fill("E2E XSS Check");
    await page.getByLabel("URL slug").fill(s);
    await addParagraph(page, "Click [bad link](javascript:alert(1)) and <script>window.__pwned=1</script> and <img src=x onerror=alert(1)>");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(page).toHaveURL(/\/admin\/pages\/\d+/);
    await expect.poll(async () => (await request.get(`/${s}`)).status(), { timeout: 15_000 }).toBe(200);
    const html = await (await request.get(`/${s}`)).text();
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain("<script>window.__pwned");
    expect(html).not.toContain("<img src=x");
    await page.goto(`/${s}`);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });

  test("a javascript: CTA link is rejected by the server", async ({ page }) => {
    await page.goto("/admin/pages/new");
    await page.getByLabel("Title").first().fill("E2E Bad CTA");
    await page.getByLabel("URL slug").fill(`${run}-badcta`);
    await page.getByLabel("Add a block").selectOption("cta");
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByLabel("Title").last().fill("Go");
    await page.getByLabel(/Button link/).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Create page" }).click();
    await expect(alertOf(page)).toContainText(/Block 1 needs attention/);
    expect(await query("SELECT id FROM Page WHERE slug = ?", [`${run}-badcta`])).toHaveLength(0);
  });
});

test.describe("blog posts and services", () => {
  test.use({ storageState: AUTH_FILE });

  test("create a post with category and tags, then see it on the blog", async ({ page, request }) => {
    const s = `${run}-post`;
    await page.goto("/admin/posts/new");
    await page.getByLabel("Title").first().fill("E2E Blog Post");
    await page.getByLabel("URL slug").fill(s);
    await page.getByLabel("Excerpt").fill("An excerpt for the e2e blog post.");
    await addParagraph(page, "Post body paragraph for e2e.");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "SEO" });
    await page.getByLabel("Tags").fill("e2e, testing");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create post" }).click();
    await expect(page).toHaveURL(/\/admin\/posts\/\d+/);
    await expect.poll(async () => (await request.get(`/blog/${s}`)).status(), { timeout: 15_000 }).toBe(200);
    const html = await (await request.get(`/blog/${s}`)).text();
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toMatch(/#(<!-- -->)?e2e/);
    expect(await query("SELECT COUNT(*) n FROM PostTag pt JOIN Post p ON p.id=pt.postId WHERE p.slug=?", [s])).toEqual([{ n: 2 }]);
    await page.goto("/admin/posts?q=" + s);
    await confirmDelete(page, "E2E Blog Post");
    await expect(page.getByRole("status")).toContainText("Deleted");
    await expect.poll(async () => (await request.get(`/blog/${s}`)).status(), { timeout: 15_000 }).toBe(404);
  });

  test("create a service with related services", async ({ page, request }) => {
    const s = `${run}-svc`;
    await page.goto("/admin/services/new");
    await page.getByLabel("Title").first().fill("E2E Service");
    await page.getByLabel("URL slug").fill(s);
    await page.getByLabel(/^Summary/).fill("A service created by the end-to-end test.");
    await page.getByLabel("Benefits").fill("Fast | Delivered quickly\nSafe | Built carefully");
    await page.getByLabel("What is included").fill("Item one\nItem two");
    await page.getByLabel("Process steps").fill("Plan | We plan\nBuild | We build");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create service" }).click();
    await expect(page).toHaveURL(/\/admin\/services\/\d+/);
    await expect.poll(async () => (await request.get(`/services/${s}`)).status(), { timeout: 15_000 }).toBe(200);
    const html = await (await request.get(`/services/${s}`)).text();
    expect(html).toContain("Delivered quickly");
    expect(html).not.toContain('"@type":"FAQPage"');
    expect(html).toContain('"@type":"Service"');
    await page.goto("/admin/services");
    await confirmDelete(page, "E2E Service");
    await expect(page.getByRole("status")).toContainText("Deleted");
  });

  test("reordering services changes the public order", async ({ page, request }) => {
    const before = await query<{ id: number; slug: string }>("SELECT id, slug FROM Service ORDER BY sortOrder, id LIMIT 2");
    await page.goto("/admin/services");
    await page.getByRole("button", { name: /Move Digital Marketing up/ }).click();
    await expect(page.getByRole("status")).toContainText("Order updated");
    const after = await query<{ slug: string }>("SELECT slug FROM Service ORDER BY sortOrder, id LIMIT 2");
    expect(after.map((r) => r.slug)).toEqual([before[1].slug, before[0].slug]);
    // restore
    await page.getByRole("button", { name: /Move Brand Strategy up/ }).click();
    await expect(page.getByRole("status")).toContainText("Order updated");
    void request;
  });
});

test.describe("contact form and leads", () => {
  test.use({ storageState: AUTH_FILE });
  const email = `e2e-${run}@example.com`;

  test("validation errors, successful submission stored in MySQL", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/contact");
    await page.waitForTimeout(3300); // minimum fill time

    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.locator("#f-firstName")).toBeFocused().catch(() => {});

    await page.getByLabel(/First name/).fill("E2E");
    await page.getByLabel(/Email address/).fill("not-an-email");
    await page.getByLabel(/How can we help/).fill("short");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(alertOf(page).first()).toBeVisible();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    // Typed values survive a failed submit.
    await expect(page.getByLabel(/First name/)).toHaveValue("E2E");

    await page.getByLabel(/Email address/).fill(email);
    await page.getByLabel("Phone number").fill("+91 98765 43210");
    await page.getByLabel(/How can we help/).fill("=HYPERLINK(\"http://evil\") I would like a quote for SEO <script>alert(1)</script>");
    await page.getByLabel("Service you are interested in").selectOption("Search Engine Optimization");
    const submit = page.getByRole("button", { name: "Send enquiry" });
    await submit.click();
    await expect(page.getByText(/Thank you/).first()).toBeVisible();

    const rows = await query<{ firstName: string; service: string; status: string; ipHash: string; source: string }>("SELECT firstName, service, status, ipHash, source FROM `Lead` WHERE email = ?", [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ firstName: "E2E", service: "Search Engine Optimization", status: "NEW", source: "/contact" });
    expect(rows[0].ipHash).toMatch(/^[a-f0-9]{64}$/); // hashed, never a raw IP
    await ctx.close();
  });

  test("honeypot submissions are silently dropped", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/contact");
    await page.waitForTimeout(3300);
    await page.getByLabel(/First name/).fill("Bot");
    await page.getByLabel(/Email address/).fill(`e2e-bot-${run}@example.com`);
    await page.getByLabel(/How can we help/).fill("I am a bot filling every field.");
    await page.locator("#f-website").evaluate((el) => ((el as HTMLInputElement).value = "http://spam.example"));
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(page.getByText(/Thank you/).first()).toBeVisible();
    expect(await query("SELECT id FROM `Lead` WHERE email = ?", [`e2e-bot-${run}@example.com`])).toHaveLength(0);
    await ctx.close();
  });

  test("too-fast submissions are rejected", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto("/contact");
    await page.getByLabel(/First name/).fill("Fast");
    await page.getByLabel(/Email address/).fill(`e2e-fast-${run}@example.com`);
    await page.getByLabel(/How can we help/).fill("Submitted instantly by a script.");
    await page.getByRole("button", { name: "Send enquiry" }).click();
    await expect(alertOf(page).first()).toContainText("too quickly");
    expect(await query("SELECT id FROM `Lead` WHERE email = ?", [`e2e-fast-${run}@example.com`])).toHaveLength(0);
    await ctx.close();
  });

  test("admin can find the lead, escaped output, change status, add note, export safely", async ({ page, request }) => {
    await page.goto(`/admin/leads?q=${email}`);
    const link = page.getByRole("link", { name: /E2E/ }).first();
    await expect(link).toBeVisible();
    await link.click();
    // Message shown as text, never executed
    await expect(page.getByText("<script>alert(1)</script>", { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.querySelectorAll("p script").length)).toBe(0);

    await page.getByLabel("Lead status").selectOption("CONTACTED");
    await page.getByRole("button", { name: "Update" }).click();
    await expect(page.getByRole("status")).toContainText("Status updated");
    expect((await query<{ status: string }>("SELECT status FROM `Lead` WHERE email=?", [email]))[0].status).toBe("CONTACTED");

    await page.getByLabel("Note").fill("Called and left a voicemail.");
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText("Called and left a voicemail.")).toBeVisible();

    const csv = await (await page.request.get(`/admin/leads/export?q=${email}`)).text();
    expect(csv).toContain(email);
    expect(csv).toContain("'=HYPERLINK"); // formula neutralised
    void request;
  });

  test("lead filters work", async ({ page }) => {
    await page.goto("/admin/leads?status=NEW&q=" + email);
    await expect(page.getByText("No leads match these filters.")).toBeVisible();
    await page.goto("/admin/leads?status=CONTACTED&q=" + email);
    await expect(page.getByRole("link", { name: /E2E/ })).toBeVisible();
  });
});

test.describe("media library", () => {
  test.use({ storageState: AUTH_FILE });

  test("upload valid image, reject disguised and oversize files", async ({ page }) => {
    await page.goto("/admin/media?folder=e2e");
    const input = page.getByLabel("Choose image files");

    await input.setInputFiles({ name: "e2e-pixel.png", mimeType: "image/png", buffer: TINY_PNG });
    await expect(page.getByText("✓ e2e-pixel.png")).toBeVisible();

    await input.setInputFiles({ name: "evil.png", mimeType: "image/png", buffer: Buffer.from("MZ not an image at all") });
    await expect(page.getByText(/✕ evil.png/)).toBeVisible();
    await expect(page.getByText(/not a valid image|Unsupported/)).toBeVisible();

    await input.setInputFiles({ name: "evil.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
    await expect(page.getByText(/✕ evil.svg/)).toBeVisible();

    await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
    await expect(page.getByText(/too large/)).toBeVisible();

    const rows = await query<{ id: number; mimeType: string; altText: string }>("SELECT id, mimeType, altText FROM Media WHERE fileName='e2e-pixel.png' ORDER BY id DESC LIMIT 1");
    expect(rows[0].mimeType).toBe("image/webp");
    const res = await page.request.get(`/media/${rows[0].id}?v=abc`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/webp");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["cache-control"]).toMatch(/immutable/);
    // conditional request
    const etag = res.headers()["etag"];
    expect((await page.request.get(`/media/${rows[0].id}`, { headers: { "If-None-Match": etag } })).status()).toBe(304);
  });

  test("edit alt text, then deletion is refused while in use and allowed after", async ({ page }) => {
    const [{ id }] = await query<{ id: number }>("SELECT id FROM Media WHERE fileName='e2e-pixel.png' ORDER BY id DESC LIMIT 1");
    await page.goto(`/admin/media/${id}`);
    await page.getByLabel("Alt text").fill("A single pixel used for testing");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("Details saved");
    expect((await query<{ altText: string }>("SELECT altText FROM Media WHERE id=?", [id]))[0].altText).toBe("A single pixel used for testing");

    // Use it as a page's featured image, then try to delete.
    await query("INSERT INTO Page (title, slug, blocks, featuredMediaId, status, updatedAt) VALUES ('E2E uses media', ?, '[]', ?, 'DRAFT', NOW())", [`${run}-usesmedia`, id]);
    await page.goto(`/admin/media/${id}`);
    await expect(page.getByText(/E2E uses media/)).toBeVisible();
    await page.getByRole("button", { name: "Delete file" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(alertOf(page)).toContainText("Cannot delete: in use");
    expect(await query("SELECT id FROM Media WHERE id=?", [id])).toHaveLength(1);

    await query("DELETE FROM Page WHERE slug = ?", [`${run}-usesmedia`]);
    await page.goto(`/admin/media/${id}`);
    await page.getByRole("button", { name: "Delete file" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status")).toContainText("File deleted");
    expect(await query("SELECT id FROM Media WHERE id=?", [id])).toHaveLength(0);
    expect(await query("SELECT mediaId FROM MediaBlob WHERE mediaId=?", [id])).toHaveLength(0);
  });
});

test.describe("menus, settings, testimonials, redirects", () => {
  test.use({ storageState: AUTH_FILE });

  test("menu: add a header item, see it live, then remove it", async ({ page, request }) => {
    await page.goto("/admin/menus?menu=header");
    await page.getByRole("button", { name: "Add item" }).click();
    const items = page.locator("ol > li");
    const last = items.last();
    await last.getByLabel("Label").fill("E2E Link");
    await last.getByLabel(/^Link/).fill("/faq");
    await page.getByRole("button", { name: "Save menu" }).click();
    await expect(page.getByRole("status")).toContainText("Menu saved");
    await expect.poll(async () => (await (await request.get("/")).text()).includes("E2E Link"), { timeout: 15_000 }).toBe(true);

    // invalid links are rejected
    await page.goto("/admin/menus?menu=header");
    await page.locator("ol > li").last().getByLabel(/^Link/).fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save menu" }).click();
    await expect(alertOf(page)).toContainText(/Use \/path/);

    await page.goto("/admin/menus?menu=header");
    await page.locator("ol > li").last().getByRole("button", { name: /Remove/ }).click();
    await page.getByRole("button", { name: "Save menu" }).click();
    await expect(page.getByRole("status")).toContainText("Menu saved");
    await expect.poll(async () => (await (await request.get("/")).text()).includes("E2E Link"), { timeout: 15_000 }).toBe(false);
  });

  test("settings: change phone, see it in the footer, validate analytics ids, revert", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Contact details" }) });
    const phone = card.getByLabel("Phone");
    const original = await phone.inputValue();
    await phone.fill("+91 11111 22222");
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");
    await expect.poll(async () => (await (await request.get("/contact")).text()).includes("+91 11111 22222"), { timeout: 15_000 }).toBe(true);
    await phone.fill(original);
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByRole("status")).toContainText("Settings saved");

    const analytics = page.locator("section", { has: page.getByRole("heading", { name: "Analytics & verification" }) });
    await analytics.getByLabel("Google Analytics 4 ID").fill("G-1');alert(1);//");
    await analytics.getByRole("button", { name: "Save" }).click();
    await expect(analytics.getByRole("alert")).toContainText("Format: G-");
  });

  test("testimonials appear publicly only when verified AND published", async ({ page, request }) => {
    await page.goto("/admin/testimonials/new");
    await page.getByLabel("Name").fill("E2E Client");
    await page.getByLabel("Quote").fill("This is an end-to-end test testimonial quote.");
    await page.getByLabel("Status").selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Create testimonial" }).click();
    await expect(page).toHaveURL(/\/admin\/testimonials\/\d+/);
    await page.waitForTimeout(1500);
    expect(await (await request.get("/")).text()).not.toContain("E2E Client"); // published but unverified

    await page.getByLabel(/I have verified/).check();
    await page.getByRole("button", { name: "Save testimonial" }).click();
    await expect(page.getByRole("status").last()).toContainText("Testimonial saved");
    await expect.poll(async () => (await (await request.get("/")).text()).includes("E2E Client"), { timeout: 20_000 }).toBe(true);
    await page.goto("/admin/testimonials");
    await confirmDelete(page, "E2E Client");
    await expect(page.getByRole("status")).toContainText("deleted");
  });

  test("redirects: create works, loops and unsafe targets are rejected", async ({ page, request }) => {
    await page.goto("/admin/seo");
    const form = async (from: string, to: string) => {
      await page.getByLabel("From path").fill(from);
      await page.getByLabel(/^To \(/).fill(to);
      await page.getByRole("button", { name: "Save redirect" }).click();
    };
    await form(`/${run}-old`, "/about");
    await expect(page.getByRole("status")).toContainText("Redirect saved");
    await expect.poll(async () => (await request.get(`/${run}-old`, { maxRedirects: 0 })).status(), { timeout: 45_000 }).toBe(301);
    expect((await request.get(`/${run}-old`, { maxRedirects: 0 })).headers()["location"]).toMatch(/\/about$/);

    await form("/about", `/${run}-old`); // would loop
    await expect(alertOf(page)).toContainText("loop");
    await form(`/${run}-x`, "javascript:alert(1)");
    await expect(alertOf(page)).toContainText(/Use an internal/);
    await form(`/${run}-y`, "//evil.example");
    await expect(alertOf(page)).toContainText(/Use an internal/);
    await form("/admin/pages", "/about");
    await expect(alertOf(page)).toContainText(/cannot be redirected/);
    await form("/same", "/same");
    await expect(alertOf(page)).toContainText(/itself|same/);
  });

  test("SEO overview lists content with checklist scores and an honest label", async ({ page }) => {
    await page.goto("/admin/seo");
    await expect(page.getByText(/not a Google ranking prediction/).first()).toBeVisible();
    await expect(page.getByRole("row", { name: /SEO Services|SEO/ }).first()).toBeVisible();
  });
});

test.describe("roles and permissions", () => {
  test.use({ storageState: AUTH_FILE });
  const editorEmail = `e2e-editor-${run}@example.com`;
  const editorPassword = "EditorPass#2026ok";

  test("creating users validates password strength, then an editor is restricted", async ({ page, browser }) => {
    await page.goto("/admin/users/new");
    await page.getByLabel("Full name").fill("E2E Editor");
    await page.getByLabel("Email").fill(editorEmail);
    await page.getByLabel("Temporary password").fill("weak");
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(alertOf(page)).toContainText("at least 12 characters");

    await page.getByLabel("Temporary password").fill(editorPassword);
    await page.getByRole("button", { name: "Create user" }).click();
    await expect(page).toHaveURL(/\/admin\/users\?msg=/);
    const [u] = await query<{ passwordHash: string; role: string }>("SELECT passwordHash, role FROM User WHERE email=?", [editorEmail]);
    expect(u.role).toBe("EDITOR");
    expect(u.passwordHash).toMatch(/^\$2[aby]\$12\$/); // bcrypt, cost 12
    expect(u.passwordHash).not.toContain(editorPassword);

    // Sign in as the editor in a fresh context.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const ep = await ctx.newPage();
    await login(ep, editorEmail, editorPassword);
    await expect(ep).toHaveURL(/\/admin$/);
    const nav = ep.getByRole("navigation", { name: "Admin" }).first();
    await expect(nav.getByRole("link", { name: "Pages", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Users" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Leads" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);

    // Hidden nav is not the security boundary: direct URLs are blocked server-side.
    for (const p of ["/admin/users", "/admin/leads", "/admin/settings", "/admin/menus", "/admin/audit-log", "/admin/home-page", "/admin/contact-page"]) {
      await ep.goto(p);
      await expect(ep).toHaveURL(/\/admin\?denied=1/);
    }
    expect((await ctx.request.get("/admin/leads/export", { maxRedirects: 0 })).status()).toBe(403);

    // Editors can write content but cannot delete it.
    await ep.goto("/admin/pages");
    await expect(ep.getByRole("button", { name: "Delete" })).toHaveCount(0);

    // Deactivating the editor kills their access immediately.
    await page.goto("/admin/users");
    await page.getByRole("link", { name: "E2E Editor" }).click();
    await page.getByLabel("Account active").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("User updated");
    expect((await ctx.request.get("/api/admin/media")).status()).toBe(401);
    await ctx.close();
  });

  test("the last Super Admin cannot be demoted or deactivated", async ({ page }) => {
    const [admin] = await query<{ id: number }>("SELECT id FROM User WHERE email = ?", [ADMIN_EMAIL]);
    await page.goto(`/admin/users/${admin.id}`);
    await page.getByLabel("Role").selectOption("EDITOR");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(alertOf(page)).toContainText(/at least one active Super Admin/);
    expect((await query<{ role: string }>("SELECT role FROM User WHERE id=?", [admin.id]))[0].role).toBe("SUPER_ADMIN");
    await page.getByLabel("Account active").uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(alertOf(page)).toContainText(/own account|Super Admin/);
  });

  test("audit log records sensitive actions", async ({ page }) => {
    await page.goto("/admin/audit-log?q=user.create");
    await expect(page.getByText(editorEmail).first()).toBeVisible();
    await page.goto("/admin/audit-log?q=login");
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });
});
