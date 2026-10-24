import { expect, test, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { AUTH_FILE } from "./global-setup";
import { ADMIN_EMAIL } from "./helpers";
import { query } from "./db";

/**
 * Admin protections: unsaved-changes dialog, sticky save bar and editing locks.
 * Uses a throw-away team member (name "E2E …") so no real content is touched; global setup removes leftovers.
 */
test.use({ storageState: AUTH_FILE });

const SECOND_EMAIL = "e2e-second-admin@test.local";
const SECOND_PASSWORD = "E2eSecond#Admin2026";

let memberId = 0;
let adminId = 0;
let secondId = 0;
const lockKey = () => `team:${memberId}`;

async function insertMember(name = "E2E Member") {
  const r = (await query(
    "INSERT INTO TeamMember (name, role, title, status, sortOrder, updatedAt) VALUES (?, 'Tester', '', 'DRAFT', 900, NOW(3))",
    [name],
  )) as unknown as { insertId: number };
  return r.insertId;
}

const memberName = async () => (await query<{ name: string }>("SELECT name FROM TeamMember WHERE id = ?", [memberId]))[0]?.name;
const lockRow = async (key = lockKey()) => (await query<{ userId: number; userName: string; token: string }>("SELECT userId, userName, token FROM EditLock WHERE resourceKey = ?", [key]))[0];

/** The baseline snapshot is taken just after hydration; wait for it before editing. */
const settle = (page: Page) => page.waitForTimeout(900);

const leaveDialog = (page: Page) => page.getByRole("dialog", { name: "Leave without saving?" });
const sidebarLink = (page: Page, name: string) => page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name, exact: true });

async function secondAdminContext(browser: Browser, baseURL: string) {
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await ctx.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(SECOND_EMAIL);
  await page.getByRole("textbox", { name: /^Password/ }).fill(SECOND_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin$/);
  return { ctx, page };
}

test.beforeAll(async () => {
  adminId = (await query<{ id: number }>("SELECT id FROM User WHERE email = ?", [ADMIN_EMAIL]))[0].id;
  await query("DELETE FROM User WHERE email = ?", [SECOND_EMAIL]);
  const hash = bcrypt.hashSync(SECOND_PASSWORD, 10);
  const r = (await query(
    "INSERT INTO User (email, name, passwordHash, role, isActive, updatedAt) VALUES (?, 'E2E Second Admin', ?, 'ADMIN', 1, NOW(3))",
    [SECOND_EMAIL, hash],
  )) as unknown as { insertId: number };
  secondId = r.insertId;
});

test.beforeEach(async () => {
  await query("DELETE FROM TeamMember WHERE name LIKE 'E2E %'");
  await query("DELETE FROM EditLock");
  await query("DELETE FROM EditLockRequest");
  memberId = await insertMember();
});

test.afterAll(async () => {
  await query("DELETE FROM TeamMember WHERE name LIKE 'E2E %'");
  await query("DELETE FROM EditLock");
  await query("DELETE FROM EditLockRequest");
  await query("DELETE FROM User WHERE email = ?", [SECOND_EMAIL]);
});

test.describe("unsaved changes", () => {
  test("no dialog while the form is untouched", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await sidebarLink(page, "Services").click();
    await expect(page).toHaveURL(/\/admin\/services$/);
    await expect(leaveDialog(page)).toBeHidden();
  });

  test("Stay keeps the edits, Discard drops them", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member edited");
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

    await sidebarLink(page, "Services").click();
    await expect(leaveDialog(page)).toBeVisible();
    await expect(leaveDialog(page)).toContainText("may be lost");
    await leaveDialog(page).getByRole("button", { name: "Stay on page" }).click();
    await expect(leaveDialog(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${memberId}$`));
    await expect(page.getByLabel(/^Name/)).toHaveValue("E2E Member edited");

    await sidebarLink(page, "Services").click();
    await leaveDialog(page).getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/admin\/services$/);
    expect(await memberName()).toBe("E2E Member");
  });

  test("Save & continue saves, then navigates", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member saved");
    await sidebarLink(page, "Services").click();
    await leaveDialog(page).getByRole("button", { name: "Save & continue" }).click();
    await expect(page).toHaveURL(/\/admin\/services$/);
    expect(await memberName()).toBe("E2E Member saved");
  });

  test("Save & continue with an invalid form stays and keeps the edits", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Role/).fill("");
    await sidebarLink(page, "Services").click();
    await leaveDialog(page).getByRole("button", { name: "Save & continue" }).click();
    await expect(leaveDialog(page)).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${memberId}$`));
    expect((await query<{ role: string }>("SELECT role FROM TeamMember WHERE id = ?", [memberId]))[0].role).toBe("Tester");
  });

  test("after a successful save the form is clean again", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member clean");
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Team member saved" }).first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
    await sidebarLink(page, "Team").click();
    await expect(page).toHaveURL(/\/admin\/team$/);
    await expect(leaveDialog(page)).toBeHidden();
  });

  test("a failed save keeps the changes and keeps the guard armed", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member offline");
    await page.route("**/admin/team/**", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByText("Could not reach the server").first()).toBeVisible();
    await expect(page.getByLabel(/^Name/)).toHaveValue("E2E Member offline");
    expect(await memberName()).toBe("E2E Member");
    await page.unroute("**/admin/team/**");

    await sidebarLink(page, "Services").click();
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole("button", { name: "Stay on page" }).click();
    // and the retry works once the connection is back
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Team member saved" }).first()).toBeVisible();
    expect(await memberName()).toBe("E2E Member offline");
  });

  test("browser Back asks first; Stay re-arms the guard; Discard goes back", async ({ page }) => {
    await page.goto("/admin/team");
    await page.getByRole("link", { name: "E2E Member" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${memberId}$`));
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member back");
    await page.waitForTimeout(300);

    await page.goBack();
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole("button", { name: "Stay on page" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${memberId}$`));
    await expect(page.getByLabel(/^Name/)).toHaveValue("E2E Member back");

    await page.goBack();
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(/\/admin\/team$/);
    expect(await memberName()).toBe("E2E Member");
  });

  test("sign out and the Cancel link are guarded too; only one dialog ever opens", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByLabel(/^Name/).fill("E2E Member guarded");
    await page.getByRole("link", { name: "Cancel" }).click();
    await expect(leaveDialog(page)).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Leave without saving?" })).toHaveCount(1);
    await leaveDialog(page).getByRole("button", { name: "Stay on page" }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(leaveDialog(page)).toBeVisible();
    await leaveDialog(page).getByRole("button", { name: "Stay on page" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/team/${memberId}$`));
  });

  test("a media-picker change (hidden input) counts as an edit", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    await page.getByRole("button", { name: "Choose image" }).click();
    const dialog = page.getByRole("dialog", { name: "Media library" });
    await expect(dialog.getByRole("listitem").first()).toBeVisible();
    await dialog.getByRole("listitem").first().getByRole("button").click();
    await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();
  });
});

test.describe("sticky save bar", () => {
  const barOf = (page: Page, button: string) => page.getByRole("button", { name: button }).locator("xpath=ancestor::div[contains(@class,'sticky')][1]");

  for (const [label, width, height] of [["desktop", 1280, 700], ["tablet", 820, 1000], ["mobile", 390, 780]] as const) {
    test(`${label}: the Save bar is inside the viewport on a long form and does not hide the last field`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const [svc] = await query<{ id: number }>("SELECT id FROM Service ORDER BY id LIMIT 1");
      await page.goto(`/admin/services/${svc.id}`);
      const bar = barOf(page, "Save service");
      await expect(bar).toBeVisible();
      const doc = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(doc, "the form is long enough to need scrolling").toBeGreaterThan(height * 2);

      for (const y of [0, 800, 2400]) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
        const box = (await bar.boundingBox())!;
        expect(box.y, `bar top at scroll ${y}`).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height, `bar bottom at scroll ${y}`).toBeLessThanOrEqual(height + 1);
        expect(box.x + box.width, "no horizontal overflow").toBeLessThanOrEqual(width + 1);
      }
      await expect(page.getByRole("button", { name: "Save service" })).toBeInViewport();

      // At the very bottom nothing is hidden behind the bar: the last form field ends above the bar.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(200);
      const barBox = (await bar.boundingBox())!;
      const lowestCard = await page.locator("form section").evaluateAll((els) => Math.max(...els.map((e) => e.getBoundingClientRect().bottom)));
      expect(lowestCard, "the last card ends above the bar").toBeLessThanOrEqual(barBox.y + 1);
    });
  }

  test("short form: bar present, Cancel and Save available", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await expect(barOf(page, "Save team member")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save team member" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Cancel" })).toBeVisible();
  });

  test("saving shows a loading state and cannot be submitted twice", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    let posts = 0;
    await page.route("**/admin/team/**", async (route) => {
      if (route.request().method() === "POST") {
        posts += 1;
        await new Promise((r) => setTimeout(r, 1200));
      }
      await route.continue();
    });
    await page.getByLabel(/^Name/).fill("E2E Member double");
    const save = page.getByRole("button", { name: "Save team member" });
    await save.dblclick();
    await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await expect(page.getByRole("status").filter({ hasText: "Team member saved" }).first()).toBeVisible();
    expect(posts).toBe(1);
  });

  test("validation errors are reported in the bar and next to the field", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await settle(page);
    const name = page.getByLabel(/^Name/);
    await name.fill("E2E Member " + "x".repeat(10));
    // The browser enforces maxLength, so trigger a server-side error with a photo id that does not exist.
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="photoId"]')!;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "99999999");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByText("Not saved:").first()).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "photoId" }).first()).toBeVisible();
  });
});

test.describe("editing locks", () => {
  test("a second administrator is blocked, sees who is editing, can ask for access, and the lock is released on leaving", async ({ page, browser, baseURL }) => {
    await page.goto(`/admin/team/${memberId}`);
    await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(adminId);

    const second = await secondAdminContext(browser, baseURL!);
    try {
      await second.page.goto(`/admin/team/${memberId}`);
      const alert = second.page.getByRole("alert").filter({ hasText: "currently being edited by" });
      await expect(alert).toContainText("Site Administrator");
      await expect(alert).toContainText("Please wait until they finish or the editing lock is released");
      await expect(second.page.getByRole("button", { name: "Save team member" })).toBeDisabled();
      await expect(second.page.getByLabel(/^Name/)).toBeDisabled();
      expect((await lockRow())?.userId, "the first administrator still holds it").toBe(adminId);

      // Request access: the holder is told on their next heartbeat.
      await second.page.getByRole("button", { name: "Request access" }).click();
      await expect(second.page.getByText("Request sent to Site Administrator")).toBeVisible();
      expect((await query("SELECT * FROM EditLockRequest WHERE resourceKey = ?", [lockKey()])).length).toBe(1);
      await expect(page.getByText("E2E Second Admin is waiting to edit this page")).toBeVisible({ timeout: 35_000 });

      // The holder leaves: lock released, the waiting page reloads itself and takes over.
      await page.goto("/admin");
      await expect.poll(async () => await lockRow(), { timeout: 10_000 }).toBeUndefined();
      await expect(second.page.getByRole("button", { name: "Save team member" })).toBeEnabled({ timeout: 25_000 });
      await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(secondId);
    } finally {
      await second.ctx.close();
    }
  });

  test("different pages can be edited at the same time by different administrators", async ({ page, browser, baseURL }) => {
    const otherId = await insertMember("E2E Other Member");
    await page.goto(`/admin/team/${memberId}`);
    await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(adminId);
    const second = await secondAdminContext(browser, baseURL!);
    try {
      await second.page.goto(`/admin/team/${otherId}`);
      await expect(second.page.getByRole("button", { name: "Save team member" })).toBeEnabled();
      await expect.poll(async () => (await lockRow(`team:${otherId}`))?.userId, { timeout: 10_000 }).toBe(secondId);
      await second.page.getByLabel(/^Name/).fill("E2E Other Member renamed");
      await second.page.getByRole("button", { name: "Save team member" }).click();
      await expect(second.page.getByRole("status").filter({ hasText: "Team member saved" }).first()).toBeVisible();
    } finally {
      await second.ctx.close();
    }
  });

  test("the same administrator opening the page again takes over; the older tab turns read-only and cannot save", async ({ page, context }) => {
    await page.goto(`/admin/team/${memberId}`);
    await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(adminId);
    const firstToken = (await lockRow()).token;
    await settle(page);

    // A new tab (or the same page re-opened after a crash) is never locked out by the administrator's own stale lock.
    const tab2 = await context.newPage();
    await tab2.goto(`/admin/team/${memberId}`);
    await expect(tab2.getByRole("button", { name: "Save team member" })).toBeEnabled();
    await expect.poll(async () => (await lockRow()).token, { timeout: 10_000 }).not.toBe(firstToken);

    // The older tab can no longer save (checked on the server, before its own heartbeat even notices)...
    await page.getByLabel(/^Name/).fill("E2E Member stale tab");
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "another browser tab" }).first()).toBeVisible();
    expect(await memberName()).toBe("E2E Member");
    // ...and turns read-only once its heartbeat notices.
    await expect(page.getByRole("button", { name: "Reload page" })).toBeVisible({ timeout: 35_000 });
    await expect(page.getByRole("button", { name: "Save team member" })).toBeDisabled();
    await tab2.close();
  });

  test("API: lock calls need a session and a same-origin request; permissions are checked", async ({ playwright, baseURL }) => {
    const anon = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const res = await anon.post("/api/admin/locks", { headers: { origin: baseURL! }, data: JSON.stringify({ op: "acquire", keys: ["team:1"], token: "abcdefgh1" }) });
    expect(res.status()).toBe(401);
    const noOrigin = await anon.post("/api/admin/locks", { data: JSON.stringify({ op: "acquire", keys: ["team:1"], token: "abcdefgh1" }) });
    expect(noOrigin.status()).toBe(403);
    await anon.dispose();
  });

  test("API: only one of many concurrent acquires wins; expired leases can be taken over; bad input is rejected", async ({ browser, baseURL, request }) => {
    const second = await secondAdminContext(browser, baseURL!);
    try {
      const key = `team:${memberId}`;
      const call = (r: typeof request, token: string, op = "acquire", keys: string[] = [key]) =>
        r.post("/api/admin/locks", { headers: { origin: baseURL! }, data: JSON.stringify({ op, keys, token }) }).then((x) => x.json());

      // Twenty rounds: each administrator tries at the same instant; exactly one of them may win each time.
      for (let round = 0; round < 20; round++) {
        const k = `faq:${900000 + round}`;
        const [a, b] = await Promise.all([call(request, `admin-round-${round}-aaaa`, "acquire", [k]), call(second.ctx.request, `second-round-${round}-bbbb`, "acquire", [k])]);
        expect([a.ok, b.ok].filter(Boolean).length, `round ${round}: exactly one holder`).toBe(1);
        const loser = a.ok ? b : a;
        expect(typeof loser.holder === "string" && loser.holder.length > 0).toBe(true);
        expect((await query("SELECT * FROM EditLock WHERE resourceKey = ?", [k])).length).toBe(1);
      }

      // Now the real key: the winner is whoever got there first.
      const [first, other] = await Promise.all([call(request, "admin-token-abcdef", "acquire"), call(second.ctx.request, "second-token-abcdef", "acquire")]);
      expect([first.ok, other.ok].filter(Boolean).length).toBe(1);
      // Renewal by the holder works; a different token or user does not.
      const holder = await lockRow();
      const holderIsAdmin = holder.userId === adminId;
      const winnerReq = holderIsAdmin ? request : second.ctx.request;
      const loserReq = holderIsAdmin ? second.ctx.request : request;
      expect((await call(winnerReq, holder.token, "heartbeat")).ok).toBe(true);
      expect((await call(winnerReq, "some-other-token-1", "heartbeat")).ok, "same user, other tab").toBe(false);
      expect((await call(loserReq, "loser-token-12345", "heartbeat")).ok).toBe(false);

      // A lease that ran out (closed browser) no longer blocks anybody.
      await query("UPDATE EditLock SET expiresAt = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 MINUTE) WHERE resourceKey = ?", [key]);
      const takeover = await call(loserReq, "loser-token-12345");
      expect(takeover.ok).toBe(true);
      expect((await lockRow())?.userId).toBe(holderIsAdmin ? secondId : adminId);

      // Bad input.
      expect((await request.post("/api/admin/locks", { headers: { origin: baseURL! }, data: JSON.stringify({ op: "acquire", keys: ["nonsense"], token: "abcdefgh1" }) })).status()).toBe(400);
      expect((await request.post("/api/admin/locks", { headers: { origin: baseURL! }, data: JSON.stringify({ op: "acquire", keys: ["user:1"], token: "bad token!" }) })).status()).toBe(400);
      expect((await request.post("/api/admin/locks", { headers: { origin: baseURL! }, data: "not json" })).status()).toBe(400);
      // The second user is an Administrator: no permission to lock user records.
      expect((await second.ctx.request.post("/api/admin/locks", { headers: { origin: baseURL! }, data: JSON.stringify({ op: "acquire", keys: ["user:1"], token: "abcdefgh1" }) })).status()).toBe(403);
    } finally {
      await second.ctx.close();
    }
  });

  test("server enforcement: saving behind someone else's lock is refused even if the page thinks it holds it", async ({ browser, baseURL }) => {
    const second = await secondAdminContext(browser, baseURL!);
    try {
      await second.page.goto(`/admin/team/${memberId}`);
      await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(secondId);
      await second.page.waitForTimeout(900);
      // The lease expired and the first administrator took it over; this page has not noticed yet.
      await query("UPDATE EditLock SET userId = ?, userName = 'Site Administrator', token = 'admin-token-12345' WHERE resourceKey = ?", [adminId, lockKey()]);
      await second.page.getByLabel(/^Name/).fill("E2E Member overwritten?");
      await second.page.getByRole("button", { name: "Save team member" }).click();
      await expect(second.page.getByRole("alert").filter({ hasText: "currently being edited by Site Administrator" }).first()).toBeVisible();
      expect(await memberName(), "nothing was written").toBe("E2E Member");
    } finally {
      await second.ctx.close();
    }
  });

  test("a holder whose lock was taken is told and cannot save", async ({ page }) => {
    await page.goto(`/admin/team/${memberId}`);
    await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(adminId);
    await query("UPDATE EditLock SET userId = ?, userName = 'E2E Second Admin', token = 'other-token-123456' WHERE resourceKey = ?", [secondId, lockKey()]);
    await expect(page.getByRole("alert").filter({ hasText: "currently being edited by E2E Second Admin" })).toBeVisible({ timeout: 35_000 });
    await expect(page.getByRole("button", { name: "Save team member" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reload page" })).toBeVisible();
  });

  test("signing out releases the administrator's locks", async ({ browser, baseURL }) => {
    const second = await secondAdminContext(browser, baseURL!);
    try {
      await second.page.goto(`/admin/team/${memberId}`);
      await expect.poll(async () => (await lockRow())?.userId, { timeout: 10_000 }).toBe(secondId);
      await second.page.getByRole("button", { name: "Sign out" }).click();
      await expect(second.page).toHaveURL(/\/admin\/login/);
      await expect.poll(async () => await lockRow(), { timeout: 10_000 }).toBeUndefined();
    } finally {
      await second.ctx.close();
    }
  });
});
