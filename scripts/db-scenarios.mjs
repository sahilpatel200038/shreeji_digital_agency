// Failure-scenario driver: runs the production build (NEXT_DIST_DIR=.next-verify) against the LOCAL TEST database only and
// exercises login/health under wrong password, DB down, missing table and recovery. See docs/DATABASE_CONNECTIVITY.md.
import "dotenv/config";
import net from "node:net";
import { spawn } from "node:child_process";
import mariadb from "mariadb";
import bcrypt from "bcryptjs";
import { chromium } from "@playwright/test";

const real = new URL(process.env.TEST_DATABASE_URL);
if (!real.pathname.includes("_test")) throw new Error("refusing: not a test DB");
const PORT = 3290;
const BASE = `http://localhost:${PORT}`;
const ADMIN = { email: "scenario-admin@test.local", password: process.env.SEED_ADMIN_PASSWORD ?? "ShreejiAdmin#2026!" };
const results = [];
const rec = (name, ok, detail = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const adminConn = () => mariadb.createConnection({ host: "127.0.0.1", port: Number(real.port || 3306), user: decodeURIComponent(real.username), password: decodeURIComponent(real.password), database: real.pathname.slice(1) });
const urlWith = (o) => { const u = new URL(real.href); u.hostname = "127.0.0.1"; Object.assign(u, o); return u.href; };

let server, logs = "";
async function start(dbUrl) {
  logs = "";
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: ".next-verify", DATABASE_URL: dbUrl, DB_POOL_LIMIT: "4" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (d) => (logs += d));
  server.stderr.on("data", (d) => (logs += d));
  for (let i = 0; i < 60; i++) { try { await fetch(BASE + "/robots.txt"); return; } catch { await sleep(500); } }
  throw new Error("server did not start\n" + logs);
}
async function stop() {
  if (!server) return;
  const exited = new Promise((r) => server.once("exit", (c, s) => r({ c, s })));
  server.kill("SIGTERM");
  const r = await Promise.race([exited, sleep(8000).then(() => "timeout")]);
  if (r === "timeout") server.kill("SIGKILL");
  server = null;
  return r;
}
async function health() { const r = await fetch(BASE + "/api/health"); return { status: r.status, body: await r.json() }; }
let browser;
async function login(email, password) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const t = Date.now();
  await page.goto(BASE + "/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("textbox", { name: /^Password/ }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await Promise.race([page.waitForURL((u) => u.pathname === "/admin", { timeout: 40000 }).catch(() => {}), page.getByText(/database|Invalid email|Something went wrong|Too many/i).first().waitFor({ timeout: 40000 }).catch(() => {})]);
  const out = { ok: new URL(page.url()).pathname === "/admin", text: (await page.locator("body").innerText()).replace(/\s+/g, " "), ms: Date.now() - t };
  await ctx.close(); return out;
}
const has = (o, re) => re.test(o.text);

// a controllable TCP forwarder = "the database server" going away and coming back
let fwd, sockets = new Set();
const fwdUp = () => new Promise((r) => { fwd = net.createServer((c) => { const u = net.connect(Number(real.port || 3306), "127.0.0.1"); sockets.add(c).add(u); c.pipe(u).pipe(c); const done = () => { c.destroy(); u.destroy(); sockets.delete(c); sockets.delete(u); }; c.on("error", done).on("close", done); u.on("error", done).on("close", done); }); fwd.listen(33307, "127.0.0.1", r); });
const fwdDown = () => new Promise((r) => { for (const s of sockets) s.destroy(); sockets.clear(); fwd.close(() => r()); });

try {
  await import("node:fs").then((fs) => fs.existsSync(".next-verify") || (() => { throw new Error("build first"); })());
  browser = await chromium.launch();
  const admin = await adminConn();
  await admin.query("DELETE FROM RateLimit");
  const userCount = (await admin.query("SELECT COUNT(*) n FROM User"))[0].n;
  console.log("users in test DB:", Number(userCount));
  await admin.query("DELETE FROM User WHERE email = ?", [ADMIN.email]);
  await admin.query("INSERT INTO User (email, name, passwordHash, role, isActive, updatedAt) VALUES (?, 'Scenario Admin', ?, 'SUPER_ADMIN', 1, NOW(3))", [ADMIN.email, await bcrypt.hash(ADMIN.password, 10)]);

  console.log("\n== 1. normal connection");
  await start(urlWith({}));
  let h = await health(); rec("health 200 ok", h.status === 200 && h.body.status === "ok", JSON.stringify(h));
  let l = await login(ADMIN.email, ADMIN.password); rec("admin login succeeds", l.ok, `${l.ms}ms`);
  l = await login("nobody@example.com", "wrong-password"); rec("wrong password -> auth message, not a DB message", has(l, /Invalid email or password/) && !has(l, /database/i), "");

  console.log("\n== 7. repeated requests: no connection growth");
  const before = Number((await admin.query("SHOW GLOBAL STATUS LIKE 'Connections'"))[0].Value);
  await Promise.all(Array.from({ length: 300 }, () => fetch(BASE + "/api/health")));
  for (let i = 0; i < 40; i++) await fetch(BASE + "/admin/login");
  const after = Number((await admin.query("SHOW GLOBAL STATUS LIKE 'Connections'"))[0].Value);
  rec("340 requests opened < 6 new DB connections", after - before < 6, `new connections: ${after - before}`);

  console.log("\n== 6. simultaneous logins");
  const pages = await Promise.all(Array.from({ length: 8 }, (_, i) => login(`u${i}-${Date.now()}@example.com`, "wrong")));
  rec("8 parallel logins all get a clean auth error", pages.every((p) => has(p, /Invalid email or password/)), `max ${Math.max(...pages.map((p) => p.ms))}ms`);
  const threads = (await admin.query("SELECT COUNT(*) n FROM information_schema.PROCESSLIST WHERE DB = ?", [real.pathname.slice(1)]))[0].n;
  rec("server-side connections for the app stay within pool limit (4) + this driver", Number(threads) <= 6, `sessions on test DB: ${Number(threads)}`);

  console.log("\n== 10. shutdown");
  const ex = await stop();
  rec("SIGTERM stops the server", ex !== "timeout", JSON.stringify(ex));
  await sleep(500);
  const left = Number((await admin.query("SELECT COUNT(*) n FROM information_schema.PROCESSLIST WHERE DB = ? AND ID <> CONNECTION_ID()", [real.pathname.slice(1)]))[0].n);
  rec("no app connections left open after shutdown", left === 0, `left: ${left}`);

  console.log("\n== 2a. wrong DB password");
  await start(urlWith({ password: "definitely-wrong" }));
  h = await health(); rec("health 503 unavailable", h.status === 503 && h.body.status === "unavailable", JSON.stringify(h));
  l = await login(ADMIN.email, ADMIN.password); rec("login shows 'could not sign in to its database' (access)", has(l, /could not sign in to its database/), `${l.ms}ms`);
  rec("no secrets in server logs", !/definitely-wrong|mysql:\/\//.test(logs));
  rec("structured log has dbKind=access", /"dbKind":"access"/.test(logs));
  await stop();

  console.log("\n== 3. database down (connection refused), bounded retry");
  await start(urlWith({ port: "33999" }));
  h = await health(); rec("health 503", h.status === 503);
  l = await login(ADMIN.email, ADMIN.password); rec("login shows 'cannot reach its database'", has(l, /cannot reach its database/), `${l.ms}ms`);
  rec("first failure bounded (< 35s: pool wait + 1 probe)", l.ms < 35000, `${l.ms}ms`);
  rec("log marks dbKind=unreachable", /"dbKind":"unreachable"/.test(logs));
  await stop();

  console.log("\n== 9. missing table");
  await admin.query("RENAME TABLE RateLimit TO RateLimit_bak");
  try {
    await start(urlWith({}));
    h = await health(); rec("health still ok (it only checks connectivity)", h.status === 200);
    l = await login(ADMIN.email, ADMIN.password); rec("login shows 'missing tables ... migrations'", has(l, /missing tables/), `${l.ms}ms`);
    rec("not reported as unreachable", !has(l, /cannot reach its database/));
    await stop();
  } finally { await admin.query("RENAME TABLE RateLimit_bak TO RateLimit"); }

  console.log("\n== 5/4/8. outage and recovery without restarting the app");
  await fwdUp();
  await admin.query("DELETE FROM RateLimit");
  await start(urlWith({ port: "33307" }));
  l = await login(ADMIN.email, ADMIN.password); rec("login ok through forwarder", l.ok, `${l.ms}ms`);
  await fwdDown();
  await sleep(300);
  h = await health(); rec("DB gone: health 503", h.status === 503, JSON.stringify(h));
  await admin.query("DELETE FROM RateLimit");
  l = await login(ADMIN.email, ADMIN.password); rec("DB gone: login shows unreachable message (not a crash)", has(l, /cannot reach its database/), `${l.ms}ms`);
  await fwdUp();
  await sleep(10500); // circuit-breaker window
  h = await health(); rec("DB back: health 200 without app restart", h.status === 200, JSON.stringify(h));
  await admin.query("DELETE FROM RateLimit");
  l = await login(ADMIN.email, ADMIN.password); rec("DB back: login works again without app restart", l.ok, `${l.ms}ms`);
  await stop(); await fwdDown();
  await admin.query("DELETE FROM RateLimit");
  await admin.query("DELETE FROM User WHERE email = ?", [ADMIN.email]);
  await admin.end();
} catch (e) {
  console.error("DRIVER ERROR", e);
  results.push({ name: "driver", ok: false });
} finally {
  await browser?.close();
  await stop();
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
  process.exit(bad.length ? 1 : 0);
}
