import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "./global-setup";
import { closeDb, query } from "./db";
import { ADMIN_EMAIL, alertOf, login } from "./helpers";

test.use({ storageState: AUTH_FILE });

const memberName = `E2E Member ${Date.now().toString(36)}`;

test.afterAll(async () => {
  await query("DELETE FROM TeamMember WHERE name LIKE 'E2E Member %'");
  await closeDb();
});

const countLogs = async (where = "1=1", params: unknown[] = []) => (await query<{ n: number }>(`SELECT COUNT(*) AS n FROM auditlog WHERE ${where}`, params))[0].n;

test.describe.serial("Activity Logs and the Team module", () => {
  test("the sidebar has Activity Logs, the page renders, and the old URL redirects", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("navigation", { name: "Admin" }).first().getByRole("link", { name: "Activity Logs" })).toBeVisible();
    await page.getByRole("navigation", { name: "Admin" }).first().getByRole("link", { name: "Activity Logs" }).click();
    await expect(page).toHaveURL(/\/admin\/activity-logs$/);
    await expect(page.getByRole("heading", { level: 1, name: "Activity Logs" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Date & time" })).toBeVisible();
    await page.goto("/admin/audit-log?q=login");
    await expect(page).toHaveURL(/\/admin\/activity-logs\?q=login/);
  });

  test("adding a team member is saved, shown on About, and logged as CREATE with the acting user", async ({ page }) => {
    await page.goto("/admin/team/new");
    await page.getByLabel("Name").fill(memberName);
    await page.getByRole("textbox", { name: /^Role/ }).fill("QA Lead");
    await page.getByLabel("Full title (optional)").fill("Quality Assurance Lead");
    await page.getByRole("button", { name: "Add team member" }).click();
    await expect(page).toHaveURL(/\/admin\/team\/\d+/);

    const [row] = await query<{ id: number; role: string }>("SELECT id, role FROM TeamMember WHERE name = ?", [memberName]);
    expect(row.role).toBe("QA Lead");

    const [log] = await query<{ actionType: string; module: string; userName: string; entityName: string; entityId: string; requestId: string; createdAt: string }>(
      "SELECT actionType, module, userName, entityName, entityId, requestId, createdAt FROM auditlog WHERE action='team.create' AND entityId=? ORDER BY id DESC LIMIT 1",
      [String(row.id)],
    );
    expect(log).toMatchObject({ actionType: "CREATE", module: "Team", entityName: memberName });
    expect(log.userName).not.toBe("");
    expect(log.requestId).toMatch(/^[0-9a-f-]{36}$/);

    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 3, name: memberName })).toBeVisible();
  });

  test("the seeded leadership team is shown on About with the correct designations", async ({ page }) => {
    await page.goto("/about");
    for (const [name, role] of [["Mitesh Patel", "CEO"], ["Sahil Patel", "CTO"], ["Abhishek Thakar", "COO"], ["Hirenbhai Patel", "MD"], ["Dev Patel", "Digital Marketing Head"]]) {
      const card = page.locator("article", { has: page.getByRole("heading", { level: 3, name, exact: true }) });
      await expect(card).toHaveCount(1);
      await expect(card.getByText(role, { exact: true })).toBeVisible();
    }
  });

  test("editing records previous and new values, visible on the detail page", async ({ page }) => {
    const [row] = await query<{ id: number }>("SELECT id FROM TeamMember WHERE name = ?", [memberName]);
    await page.goto(`/admin/team/${row.id}`);
    await page.getByRole("textbox", { name: /^Role/ }).fill("QA Director");
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(page.getByRole("status")).toContainText("Team member saved");

    const asJson = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);
    const [log] = await query<{ id: number; oldValues: unknown; newValues: unknown }>(
      "SELECT id, oldValues, newValues FROM auditlog WHERE action='team.update' AND entityId=? ORDER BY id DESC LIMIT 1",
      [String(row.id)],
    );
    expect(asJson(log.oldValues)).toEqual({ role: "QA Lead" });
    expect(asJson(log.newValues)).toEqual({ role: "QA Director" });

    await page.goto(`/admin/activity-logs/${log.id}`);
    await expect(page.getByRole("heading", { name: `Activity #${log.id}` })).toBeVisible();
    const changed = page.getByRole("row", { name: /role/ });
    await expect(changed).toContainText("QA Lead");
    await expect(changed).toContainText("QA Director");
  });

  test("an invalid submission changes nothing and writes no log entry", async ({ page }) => {
    const [row] = await query<{ id: number }>("SELECT id FROM TeamMember WHERE name = ?", [memberName]);
    const before = await countLogs();
    await page.goto(`/admin/team/${row.id}`);
    await page.getByLabel("Name").fill("   ");
    await page.getByRole("button", { name: "Save team member" }).click();
    await expect(alertOf(page)).toBeVisible();
    expect(await countLogs()).toBe(before);
    expect((await query<{ name: string }>("SELECT name FROM TeamMember WHERE id=?", [row.id]))[0].name).toBe(memberName);
  });

  test("hiding removes the member from About and is logged as UNPUBLISH", async ({ page }) => {
    const [row] = await query<{ id: number }>("SELECT id FROM TeamMember WHERE name = ?", [memberName]);
    await page.goto("/admin/team");
    await page.getByRole("row", { name: new RegExp(memberName) }).getByRole("button", { name: "Hide" }).click();
    await expect(page.getByRole("status")).toContainText("hidden");
    expect((await query<{ n: number }>("SELECT COUNT(*) n FROM auditlog WHERE action='team.unpublish' AND entityId=?", [String(row.id)]))[0].n).toBe(1);
    await page.goto("/about");
    await expect(page.getByRole("heading", { level: 3, name: memberName })).toHaveCount(0);
  });

  test("deleting asks for confirmation, then logs DELETE", async ({ page }) => {
    const [row] = await query<{ id: number }>("SELECT id FROM TeamMember WHERE name = ?", [memberName]);
    await page.goto("/admin/team");
    const tr = page.getByRole("row", { name: new RegExp(memberName) });
    await tr.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    expect((await query<{ n: number }>("SELECT COUNT(*) n FROM TeamMember WHERE id=?", [row.id]))[0].n).toBe(1);
    await tr.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status")).toContainText("Removed");
    expect((await query<{ n: number }>("SELECT COUNT(*) n FROM TeamMember WHERE id=?", [row.id]))[0].n).toBe(0);
    expect((await query<{ n: number }>("SELECT COUNT(*) n FROM auditlog WHERE action='team.delete' AND entityId=?", [String(row.id)]))[0].n).toBe(1);
  });

  test("search, action and module filters, sorting and the empty state work", async ({ page }) => {
    await page.goto(`/admin/activity-logs?q=${encodeURIComponent(memberName)}`);
    await expect(page.getByRole("row").nth(1)).toContainText(memberName);

    await page.goto(`/admin/activity-logs?q=${encodeURIComponent(memberName)}&actionType=DELETE`);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Delete");

    await page.goto("/admin/activity-logs?module=Team");
    for (const r of await page.locator("tbody tr").all()) await expect(r).toContainText("Team");

    // Newest first by default; oldest first flips the order.
    const firstId = async (qs: string) => {
      await page.goto(`/admin/activity-logs${qs}`);
      return page.locator("tbody tr").first().getByRole("link", { name: /View details of activity/ }).getAttribute("aria-label");
    };
    expect(await firstId("")).not.toBe(await firstId("?sort=asc"));

    // A day far in the future matches nothing.
    await page.goto("/admin/activity-logs?from=2099-01-01&to=2099-01-02");
    await expect(page.getByText("No activity matches these filters.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();
  });

  test("date filter includes the whole selected day, and pagination reaches page 2", async ({ page }) => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    await page.goto(`/admin/activity-logs?from=${today}&to=${today}`);
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await page.goto("/admin/activity-logs");
    await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("an unknown log id is a 404 and a malformed one does not crash", async ({ page }) => {
    // The admin area streams its shell first (loading.tsx), so the HTTP status is 200 even for notFound().
    // The behaviour that matters is the rendered state: the 404 screen, and no log details.
    for (const id of ["99999999", "abc", "0"]) {
      await page.goto(`/admin/activity-logs/${id}`);
      await expect(page.getByRole("heading", { level: 1, name: "We could not find that page" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /^Activity #/ })).toHaveCount(0);
      await expect(page.getByText("Date & time")).toHaveCount(0);
    }
  });

  test("sign-in and sign-out are logged; a failed sign-in is never logged as a login", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    const [{ id: userId }] = await query<{ id: number }>("SELECT id FROM User WHERE email=?", [ADMIN_EMAIL]);
    const logins = () => countLogs("action='login' AND userId=?", [userId]);
    const failed = () => countLogs("action='login.failed'");
    const [l0, f0] = [await logins(), await failed()];

    await login(page, ADMIN_EMAIL, "definitely-wrong-password");
    await expect(alertOf(page)).toContainText("Invalid email or password");
    expect(await failed()).toBe(f0 + 1);
    expect(await logins()).toBe(l0);

    await login(page);
    await expect(page).toHaveURL(/\/admin$/);
    expect(await logins()).toBe(l0 + 1);

    const lo0 = await countLogs("action='logout' AND userId=?", [userId]);
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    expect(await countLogs("action='logout' AND userId=?", [userId])).toBe(lo0 + 1);

    // Stored values never contain the attempted password.
    expect(await countLogs("summary LIKE ? OR newValues LIKE ?", ["%definitely-wrong-password%", "%definitely-wrong-password%"])).toBe(0);
    await ctx.close();
  });

  test("anonymous visitors cannot reach Activity Logs", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const p of ["/admin/activity-logs", "/admin/activity-logs/1", "/admin/team"]) {
      await page.goto(p);
      await expect(page).toHaveURL(/\/admin\/login/);
    }
    await ctx.close();
  });
});
