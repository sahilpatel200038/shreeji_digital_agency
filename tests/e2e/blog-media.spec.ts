import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { AUTH_FILE, cleanup } from "./global-setup";
import { closeDb, query } from "./db";
import { alertOf } from "./helpers";

const run = `e2e-${Date.now().toString(36)}`;
const png = (r: number, g: number, b: number) => sharp({ create: { width: 1200, height: 800, channels: 3, background: { r, g, b } } }).png().toBuffer();

test.afterAll(async () => {
  await cleanup();
  await query("DELETE FROM Media WHERE fileName IN ('banner.png', 'thumb.png')");
  await closeDb();
});

test.use({ storageState: AUTH_FILE });

/** True when the markup references /media/<id>, directly or percent-encoded inside a next/image URL. */
const usesMedia = (html: string, id: number) => new RegExp(`(/|%2F)media(/|%2F)${id}(?![0-9])`).test(html);

const editor = (page: Page) => page.locator(".rte-editor .ProseMirror");

async function uploadInto(page: Page, label: string, buffer: Buffer, name: string) {
  await page.getByLabel(`${label}: choose an image file from your computer`).setInputFiles({ name, mimeType: "image/png", buffer });
}

test("blog post: separate banner and thumbnail uploads, rich text, persistence and public rendering", async ({ page, request }) => {
  const slug = `${run}-rich`;
  await page.goto("/admin/posts/new");
  await page.getByLabel("Title").first().fill("E2E Rich Post");
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Excerpt").fill("Excerpt for the rich text e2e post.");

  // --- rich text
  await editor(page).click();
  await page.keyboard.type("Plain intro paragraph. ");
  await page.keyboard.press("Control+b");
  await page.keyboard.type("Bold words");
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Enter");
  await page.getByLabel("Text style").selectOption("h2");
  await page.keyboard.type("A heading");
  await page.keyboard.press("Enter");
  await page.getByLabel("Text style").selectOption("p");
  await page.getByRole("button", { name: "Bulleted list" }).click();
  await page.keyboard.type("first point");
  await page.keyboard.press("Enter");
  await page.keyboard.type("second point");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Linked text");
  await page.keyboard.press("Shift+Home");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.getByLabel("Link address").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(alertOf(page)).toContainText("Use an internal path");
  await page.getByLabel("Link address").fill("/contact");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Align centre" }).click();

  // --- images: two different files, one per field, with an immediate preview
  await uploadInto(page, "Banner image", await png(200, 30, 30), "banner.png");
  await expect(page.getByRole("img", { name: "Preview of the selected image" })).toHaveCount(1);
  await uploadInto(page, "Thumbnail", await png(30, 30, 200), "thumb.png");
  await expect(page.getByRole("img", { name: "Preview of the selected image" })).toHaveCount(2);

  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Create post" }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/\d+/);

  const [row] = await query<{ id: number; featuredMediaId: number; thumbnailMediaId: number; blocks: unknown }>("SELECT id, featuredMediaId, thumbnailMediaId, blocks FROM Post WHERE slug = ?", [slug]);
  expect(row.featuredMediaId).toBeGreaterThan(0);
  expect(row.thumbnailMediaId).toBeGreaterThan(0);
  expect(row.thumbnailMediaId).not.toBe(row.featuredMediaId);
  const stored = typeof row.blocks === "string" ? JSON.parse(row.blocks) : row.blocks;
  expect(stored).toHaveLength(1);
  expect(stored[0].type).toBe("richtext");
  expect(stored[0].html).toContain("<strong>Bold words</strong>");
  expect(stored[0].html).toContain("<h2>A heading</h2>");
  expect(stored[0].html).toContain('href="/contact"');
  expect(stored[0].html).not.toContain("javascript:");

  // --- reload the editor: content and both images come back
  await page.reload();
  await expect(editor(page)).toContainText("Plain intro paragraph. Bold words");
  await expect(editor(page).locator("h2")).toHaveText("A heading");
  await expect(editor(page).locator("ul li")).toHaveCount(2);
  const sources = await page.locator("main img[alt='Selected image']").evaluateAll((els) => els.map((e) => (e as HTMLImageElement).src));
  expect(sources.some((s) => s.includes(`/media/${row.featuredMediaId}`) || decodeURIComponent(s).includes(`/media/${row.featuredMediaId}`))).toBe(true);
  expect(sources.some((s) => decodeURIComponent(s).includes(`/media/${row.thumbnailMediaId}`))).toBe(true);

  // --- public detail page renders the formatted content and the banner image
  await expect.poll(async () => (await request.get(`/blog/${slug}`)).status(), { timeout: 15_000 }).toBe(200);
  const html = await (await request.get(`/blog/${slug}`)).text();
  expect(html).toContain("<strong>Bold words</strong>");
  expect(html).toContain("<h2>A heading</h2>");
  expect(html).toContain('class="rich-content"');
  expect(usesMedia(html, row.featuredMediaId)).toBe(true);

  // --- the blog list card uses the thumbnail, not the banner
  const list = await (await request.get(`/blog?q=${encodeURIComponent("E2E Rich Post")}`)).text();
  const card = list.split("<article").slice(1).find((chunk) => chunk.includes("E2E Rich Post")) ?? "";
  expect(card, "the post should be listed on /blog").not.toBe("");
  expect(usesMedia(card, row.thumbnailMediaId)).toBe(true);
  expect(usesMedia(card, row.featuredMediaId)).toBe(false);

  // --- remove the thumbnail: the card falls back to the banner image
  await page.getByLabel("Thumbnail", { exact: false }).first().isVisible();
  await page.locator("section", { hasText: "Listing thumbnail" }).getByRole("button", { name: "Remove" }).click();
  await page.getByRole("button", { name: "Save post" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Post saved." })).toBeVisible();
  const [after] = await query<{ thumbnailMediaId: number | null; featuredMediaId: number }>("SELECT thumbnailMediaId, featuredMediaId FROM Post WHERE slug = ?", [slug]);
  expect(after.thumbnailMediaId).toBeNull();
  expect(after.featuredMediaId).toBe(row.featuredMediaId);
});

test("image uploads are validated before they are sent", async ({ page }) => {
  await page.goto("/admin/posts/new");
  await page.getByLabel("Banner image: choose an image file from your computer").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(alertOf(page)).toContainText("Choose a JPG, PNG, WebP, AVIF or GIF image.");
  await page.getByLabel("Thumbnail: choose an image file from your computer").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 10) });
  await expect(alertOf(page).last()).toContainText("larger than 5 MB");
  await expect(page.locator("input[name='thumbnailMediaId']")).toHaveValue("");
});

test("existing block-based posts open in the editor with their content, and unsafe stored HTML is never rendered", async ({ page, request }) => {
  const slug = `${run}-legacy`;
  const evil = `${run}-evil`;
  const legacy = JSON.stringify([
    { type: "heading", level: 2, text: "Legacy heading" },
    { type: "paragraph", text: "Legacy **bold** text with [a link](/contact)." },
    { type: "list", ordered: false, items: ["one", "two"] },
  ]);
  const unsafe = JSON.stringify([{ type: "richtext", html: '<p onclick="alert(1)">safe text</p><script>alert(1)</script><img src=x onerror=alert(1)>' }]);
  const [{ id: author }] = await query<{ id: number }>("SELECT id FROM User ORDER BY id LIMIT 1");
  for (const [s, blocks] of [[slug, legacy], [evil, unsafe]] as const) {
    await query("INSERT INTO Post (title, slug, blocks, authorId, status, publishedAt, readingMinutes, updatedAt) VALUES (?, ?, ?, ?, 'PUBLISHED', UTC_TIMESTAMP(3), 1, UTC_TIMESTAMP(3))", [s, s, blocks, author]);
  }
  const [{ id }] = await query<{ id: number }>("SELECT id FROM Post WHERE slug = ?", [slug]);

  await page.goto(`/admin/posts/${id}`);
  await expect(editor(page).locator("h2")).toHaveText("Legacy heading");
  await expect(editor(page).locator("strong")).toHaveText("bold");
  await expect(editor(page).locator("a[href='/contact']")).toHaveText("a link");
  await expect(editor(page).locator("ul li")).toHaveCount(2);
  // Opening and saving without changes keeps the content.
  await page.getByRole("button", { name: "Save post" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Post saved." })).toBeVisible();
  const html = await (await request.get(`/blog/${slug}`)).text();
  expect(html).toContain("Legacy heading");
  expect(html).toContain("<strong>bold</strong>");

  const evilHtml = await (await request.get(`/blog/${evil}`)).text();
  const body = evilHtml.slice(evilHtml.indexOf('class="rich-content"'), evilHtml.indexOf('class="rich-content"') + 400);
  expect(body).toContain("safe text");
  expect(body).not.toMatch(/onclick|<script|onerror/);
});

test("Back button returns to the previous list, or to the parent list when there is no history", async ({ page }) => {
  await page.goto("/admin/posts");
  const firstEdit = page.getByRole("row").nth(1).getByRole("link").first();
  await firstEdit.click();
  await expect(page).toHaveURL(/\/admin\/posts\/\d+/);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts(\?.*)?$/);

  // Opened directly (no in-app history): falls back to the parent listing.
  const id = await page.evaluate(async () => (await (await fetch("/admin/posts")).text()).match(/\/admin\/posts\/(\d+)/)?.[1]);
  await page.goto(`/admin/posts/${id}`);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);

  for (const path of ["/admin/posts/new", "/admin/pages/new", "/admin/services/new", "/admin/faqs/new", "/admin/team/new", "/admin/testimonials/new", "/admin/projects/new", "/admin/users/new"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace("/new", "")}$`));
  }
});

test("pasting Word-style HTML keeps headings, bold, italic, underline, links and lists and drops the rest", async ({ page }) => {
  await page.goto("/admin/posts/new");
  await editor(page).click();
  const word =
    '<html><body><!--StartFragment--><h1 class="MsoTitle" style="font-family:Calibri;font-size:28pt">Quarterly Plan</h1><p class="MsoNormal" style="margin:0cm;font-size:11pt;font-family:Calibri">Intro with <b style="mso-bidi-font-weight:normal">bold</b>, <i>italic</i> and <u>underline</u> and <a href="https://example.com/x">a link</a>.<o:p></o:p></p><ul><li class="MsoListParagraph">Item A</li><li class="MsoListParagraph">Item B</li></ul><script>alert(1)</script><!--EndFragment--></body></html>';
  await page.evaluate((html) => {
    const el = document.querySelector(".rte-editor .ProseMirror")!;
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", "Quarterly Plan");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, word);
  await expect(editor(page).locator("h2")).toHaveText("Quarterly Plan");
  await expect(editor(page).locator("strong")).toHaveText("bold");
  await expect(editor(page).locator("em")).toHaveText("italic");
  await expect(editor(page).locator("u")).toHaveText("underline");
  await expect(editor(page).locator("a[href='https://example.com/x']")).toHaveText("a link");
  await expect(editor(page).locator("ul li")).toHaveCount(2);
  const stored = await page.locator("input[name='blocks']").inputValue();
  expect(stored).not.toMatch(/script|Calibri|MsoNormal|mso-/i);
  expect(stored).not.toMatch(/<p><\/p>"/);
});

test("the editor fits a phone: no horizontal page scroll and a single scrolling toolbar row", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, storageState: AUTH_FILE, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/admin/posts/new");
  await expect(page.getByRole("toolbar", { name: "Text formatting" })).toBeVisible();
  const m = await page.evaluate(() => {
    const bar = document.querySelector("[role=toolbar]")!;
    // Items differ in height, so compare their vertical centres: one row means they all sit on the same line.
    const centres = [...bar.children].map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
    return { pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, rowSpread: Math.max(...centres) - Math.min(...centres), scrolls: bar.scrollWidth > bar.clientWidth };
  });
  expect(m.pageOverflow).toBe(false);
  expect(m.rowSpread).toBeLessThan(8);
  expect(m.scrolls).toBe(true);
  await editor(page).click();
  await page.keyboard.type("typing on a phone");
  await expect(editor(page)).toContainText("typing on a phone");
  await context.close();
});
