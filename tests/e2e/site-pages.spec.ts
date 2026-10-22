import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { closeDb, query } from "./db";

const PAGES = [
  { key: "home", path: "/", label: "Homepage" },
  { key: "services", path: "/services", label: "Services" },
  { key: "blog", path: "/blog", label: "Blog" },
  { key: "faq", path: "/faq", label: "FAQ" },
];

test.afterAll(closeDb);

test.describe("built-in pages: unauthenticated", () => {
  test("site-pages admin screens require sign-in", async ({ page }) => {
    for (const p of ["/admin/site-pages", "/admin/site-pages/home"]) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
  });
});

test.describe.serial("built-in pages: SEO managed in the admin", () => {
  test.use({ storageState: AUTH_FILE });

  test("every built-in page is listed and unknown keys 404", async ({ page }) => {
    await page.goto("/admin/site-pages");
    for (const p of PAGES) await expect(page.getByRole("link", { name: "Edit SEO" }).nth(PAGES.indexOf(p))).toBeVisible();
    await page.goto("/admin/site-pages/nope");
    await expect(page.getByText(/not found|doesn.t exist|404/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save SEO" })).toHaveCount(0);
  });

  for (const p of PAGES) {
    test(`${p.label}: saved SEO is rendered in the HTML head; empty fields fall back; change is logged`, async ({ page, request }) => {
      const tag = `E2E ${p.key} ${Date.now().toString(36)}`;
      await page.goto(`/admin/site-pages/${p.key}`);
      const title = page.getByLabel("SEO title");
      const desc = page.getByLabel("Meta description");
      const originalTitle = await title.inputValue();
      const originalDesc = await desc.inputValue();
      try {
        await title.fill(tag);
        await desc.fill(`${tag} description`);
        await page.getByLabel("Canonical URL").fill(`https://example.com/${p.key}-canonical`);
        await page.getByLabel("Social title (Open Graph)").fill(`${tag} social`);
        await page.getByRole("button", { name: "Save SEO" }).click();
        await expect(page.getByRole("status")).toContainText("SEO saved");

        await expect
          .poll(async () => (await (await request.get(p.path)).text()).includes(`${tag} description`), { timeout: 20_000 })
          .toBe(true);
        const html = await (await request.get(p.path)).text();
        expect(html).toContain(`<title>${tag}</title>`);
        expect(html).toMatch(new RegExp(`rel="canonical" href="https://example.com/${p.key}-canonical"`));
        expect(html).toContain(`property="og:title" content="${tag} social"`);

        const [log] = await query<{ actionType: string; module: string; userName: string }>(
          "SELECT actionType, module, userName FROM auditlog WHERE action = 'site-page.update' AND entityId = ? ORDER BY id DESC LIMIT 1",
          [p.key],
        );
        expect(log).toMatchObject({ actionType: "UPDATE", module: "Site pages" });
        expect(log.userName).not.toBe("");

        // The change survives a reload of the admin form.
        await page.reload();
        await expect(page.getByLabel("SEO title")).toHaveValue(tag);

        // Empty fields fall back to the built-in text.
        await page.getByLabel("SEO title").fill("");
        await page.getByLabel("Meta description").fill("");
        await page.getByLabel("Canonical URL").fill("");
        await page.getByLabel("Social title (Open Graph)").fill("");
        await page.getByRole("button", { name: "Save SEO" }).click();
        await expect(page.getByRole("status")).toContainText("SEO saved");
        await expect
          .poll(async () => (await (await request.get(p.path)).text()).includes(tag), { timeout: 20_000 })
          .toBe(false);
        const after = await (await request.get(p.path)).text();
        expect(after).toMatch(/<title>[^<]+<\/title>/);
        expect(after).toMatch(/rel="canonical" href="https?:\/\/[^"]+"/);
      } finally {
        await page.goto(`/admin/site-pages/${p.key}`);
        await page.getByLabel("SEO title").fill(originalTitle);
        await page.getByLabel("Meta description").fill(originalDesc);
        await page.getByLabel("Canonical URL").fill("");
        await page.getByLabel("Social title (Open Graph)").fill("");
        await page.getByRole("button", { name: "Save SEO" }).click();
        await expect(page.getByRole("status")).toContainText("SEO saved");
      }
    });
  }

  test("homepage, About and contact headings are editable in Settings and shown publicly", async ({ page, request }) => {
    await page.goto("/admin/settings");
    const home = page.locator("section", { has: page.getByRole("heading", { name: "Homepage" }) });
    const contact = page.locator("section", { has: page.getByRole("heading", { name: "Contact details" }) });
    const work = home.getByLabel("Work heading");
    const form = contact.getByLabel("Enquiry form heading");
    const [origWork, origForm] = [await work.inputValue(), await form.inputValue()];
    try {
      await work.fill("E2E Work Heading");
      await home.getByRole("button", { name: "Save" }).click();
      await expect(home.getByRole("status")).toContainText("Settings saved");
      await form.fill("E2E Enquiry Heading");
      await contact.getByRole("button", { name: "Save" }).click();
      await expect(contact.getByRole("status")).toContainText("Settings saved");
      await expect.poll(async () => (await (await request.get("/")).text()).includes("E2E Work Heading"), { timeout: 20_000 }).toBe(true);
      expect(await (await request.get("/about")).text()).toContain("E2E Enquiry Heading");

      // Unsafe button links are rejected.
      await home.getByLabel("Main button link").fill("javascript:alert(1)");
      await home.getByRole("button", { name: "Save" }).click();
      await expect(home.getByRole("alert").first()).toBeVisible();
    } finally {
      await page.goto("/admin/settings");
      await work.fill(origWork);
      await home.getByRole("button", { name: "Save" }).click();
      await expect(home.getByRole("status")).toContainText("Settings saved");
      await form.fill(origForm);
      await contact.getByRole("button", { name: "Save" }).click();
      await expect(contact.getByRole("status")).toContainText("Settings saved");
    }
  });
});

test.describe.serial("About page (reference implementation) still manageable", () => {
  test.use({ storageState: AUTH_FILE });

  test("edit About intro and SEO in the admin, see them live, then restore", async ({ page, request }) => {
    const [row] = await query<{ id: number }>("SELECT id FROM Page WHERE slug = 'about'");
    await page.goto(`/admin/pages/${row.id}`);
    const excerpt = page.getByLabel("Excerpt");
    const seoTitle = page.getByLabel("SEO title");
    const [origExcerpt, origTitle] = [await excerpt.inputValue(), await seoTitle.inputValue()];
    const tag = `E2E About ${Date.now().toString(36)}`;
    try {
      await excerpt.fill(`${tag} intro`);
      await seoTitle.fill(tag);
      await page.getByRole("button", { name: "Save page" }).click();
      await expect(page.getByRole("status")).toContainText("Page saved");
      await expect
        .poll(async () => (await (await request.get("/about")).text()).includes(`${tag} intro`), { timeout: 20_000 })
        .toBe(true);
      expect(await (await request.get("/about")).text()).toContain(`<title>${tag}</title>`);
    } finally {
      await page.goto(`/admin/pages/${row.id}`);
      await excerpt.fill(origExcerpt);
      await seoTitle.fill(origTitle);
      await page.getByRole("button", { name: "Save page" }).click();
      await expect(page.getByRole("status")).toContainText("Page saved");
    }
  });
});
