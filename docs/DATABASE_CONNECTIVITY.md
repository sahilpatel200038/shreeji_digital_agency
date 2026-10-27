# Database connectivity: root cause, fix and deployment

Symptom: the admin login intermittently shows *"The site cannot reach its database right now. Please try again in a few minutes."*

## What was verified, and what was not

Verified locally (MySQL, production build, real browser): the mechanisms below, the fixes, and every test in the table at the end.

**Not verified: the production database.** No access to Hostinger was available, so the exact trigger on the live server (host connection cap, restart,
slow connect) is unconfirmed. The new logging (see "Reading the logs") will name it the next time it happens.

## Root cause (code-level, reproduced)

1. **Login used an interactive Prisma transaction for rate limiting** (`hitRateLimit`: read + upsert inside `$transaction`). Prisma gives such
   transactions a `maxWait` of **2 s** (and a 5 s timeout), but the connection pool is configured to wait **10 s**. Whenever the pool was briefly busy or a
   connection was slow to open (typical on shared hosting), ordinary queries waited and succeeded while this transaction failed with
   `P2028 "Unable to start a transaction in the given time"` after exactly 2 s. Reproduced: pool busy -> transaction fails at 2010 ms, a plain query succeeds.
2. **The error classifier then reported that as an outage.** `P2028`, a saturated pool and a genuinely dead database all became
   "cannot reach its database". Login is the path that runs the transaction (twice, in parallel), so that is where it showed up.
3. **The real reason was invisible.** Through the pool, a wrong password, a refused connection, a full server and a host connection cap all surface as the
   *same* error (`P2039 pool failed to retrieve a connection`) after a 20 s wait (2x `acquireTimeout`). The app could not say why, so it guessed "unreachable".
4. **Every page load runs ~9 unrelated queries.** Next serialises the root `not-found.tsx` (which renders `SiteHeader`/`SiteFooter`) into every route's
   payload, so a cookie-less `GET /admin/login` runs the public site's Setting/Menu/Service queries. Connections *are* reused (0 new connections over 20 requests,
   measured), so this is load and latency, not churn, but it makes the login page itself slow when the database is slow. Not changed (frontend scope); see "Limitations".

Checked and ruled out locally: Prisma client re-creation (single `globalThis` client), connection leaks (0 growth over 340 requests, 0 left after shutdown),
parsing of the password in `DATABASE_URL` (`^`, `+`, `~` parse correctly), the authentication logic itself.

## Changes

| File | Change |
|---|---|
| `src/lib/rate-limit.ts` | One atomic `INSERT ... ON DUPLICATE KEY UPDATE` instead of an interactive transaction. No lost updates; a simultaneous burst errs towards blocking, never towards allowing. |
| `src/lib/db.ts` | `transactionOptions.maxWait` = pool acquire timeout, `timeout` 15 s; env-tunable timeouts; closes the pool on SIGTERM/SIGINT; opt-in `DB_LOG_QUERIES`. |
| `src/lib/db-config.ts` (new) | Shared `DATABASE_URL` parsing and env helpers. |
| `src/lib/db-errors.ts` | New `busy` state (pool saturated / slow transaction start). `P2028` is classified by message (an expired transaction is *not* a connectivity error). `isRetryableConnectError`. |
| `src/lib/db-health.ts` (new) | On an opaque pool failure, ONE direct unpooled connection reveals the real reason (down / bad credentials / schema / host cap). Cached 5 s ok / 10 s failed; concurrent callers share one probe. If the probe connects, the failure was transient and is reported as `busy`, never as an outage. `knownOutage()` lets login fail fast. |
| `src/lib/db-retry.ts` (new) | At most 2 retries, exponential backoff with full jitter (<= 150 / 300 ms), **only** for failures to open a connection. Never for auth, schema, SQL, pool saturation, host limits or mid-query resets. |
| `src/lib/action.ts`, `src/lib/api.ts` | Use the probe-refined classification; structured, scrubbed logs. |
| `src/actions/auth.ts`, `src/lib/auth/session.ts` | Retry wrapper on the user/session lookup; login fails fast during a confirmed outage. Login flow and contracts unchanged. |
| `src/app/api/health/route.ts` (new), `src/proxy.ts` | `GET /api/health`: `SELECT 1` with a timeout (`DB_HEALTH_TIMEOUT_MS`, default 3 s), 5 s shared cache, `200 {"status":"ok"}` or `503 {"status":"unavailable"}`, no details publicly, cause in the server log. Skips the redirect-table query. |
| `.env.production.example` | **Contained a real-looking DB URL and dev secrets; replaced with placeholders** (see Security). |
| `.env.example`, `package.json`, `package-lock.json` | Documented new env vars; `mariadb@3.5.4` is now a direct dependency (already installed via the Prisma adapter and pinned by `overrides`). |
| `tests/*`, `scripts/db-scenarios.mjs` | New tests and the failure-scenario driver. |

No schema change, no migration, no API or contract change. Existing migrations are untouched.

## SECURITY: rotate the database password now

`.env.production.example` was committed with what appears to be the production `DATABASE_URL` including the password (git commit `e0423b2`), and it was
read during this session. Editing the file does not remove it from git history. **In hPanel > Databases, change the database password**, update `DATABASE_URL`
in the Node.js app environment variables, and restart. Also treat the `AUTH_SECRET` / `IP_HASH_SALT` that were in that file as public: set new random values in
hPanel (this logs all admins out).

## Deployment

1. Rotate the password (above). Set env vars in hPanel > Node.js app > Environment variables, using `.env.production.example` as the list. URL-encode special characters in the password.
2. `npm install` (adds `mariadb`), `npm run build`, restart the app.
3. Check `https://shreejidigitalagency.com/api/health` returns `{"status":"ok"}`. Point an uptime monitor at it (every minute or slower is fine; probes are cached).
4. If the login ever shows a database message again, look in the app log for lines with `"dbKind"`:
   - `unreachable` (`ECONNREFUSED` / `ETIMEDOUT`): database server down, or wrong host/port. Use `localhost` for same-account databases.
   - `access`: wrong user, password or database name (or the password changed). Re-check `DATABASE_URL`.
   - `limit`: host cap (`max_connections_per_hour` / `max_user_connections`). Resets within the hour; see below.
   - `busy`: reachable but saturated. Lower `DB_POOL_LIMIT` or reduce the number of processes.
   - `schema`: run `npm run db:deploy`.

### Hosting-side checks you must do (cannot be done from code)

- **Connection limits.** In hPanel (or via support) read `max_user_connections` and `max_connections_per_hour` for your plan. Required: `Node processes x DB_POOL_LIMIT < max_user_connections`
  (default pool is 4 per process). `npm run build` also opens connections (migrate + 2 build workers), so do not build while the site is under load.
- **Process count.** If the host runs more than one Node process for the app, each has its own pool.
- **Database restarts or downtime.** Ask support whether MySQL restarted at the times errors were seen; the new logs and health monitor will timestamp them.
- **Allowlist / SSL.** Not needed for `localhost` on the same account. For a remote host, add the app server's IP under hPanel > Remote MySQL.
- **Migrations present.** `npm run db:deploy` is idempotent. Missing tables are now reported as "schema", not as an outage.

## Reading the logs

Structured JSON, scrubbed of URLs and passwords: `action_failed_database`, `health_check_failed`, `settings_load_failed`, each with `dbKind` / `dbCode`.
`DB_LOG_QUERIES=true` temporarily prints every SQL statement (diagnostics only; leave unset in production).

## Tests performed (local MySQL, production build)

| # | Scenario | Result |
|---|---|---|
| 1 | Normal connection, admin login, wrong-password login | pass; auth errors are never shown as DB errors |
| 2 | Wrong DB password | health 503; login says "could not sign in to its database"; no secrets in logs; `dbKind=access` |
| 3 | Database down (connection refused) | health 503; login says "cannot reach its database"; first failure ~26 s (pool wait + one probe), then fails fast for 10 s |
| 4 | Outage, then recovery, no app restart | health and login recover (<1 s once the 10 s window passes) |
| 5 | Pool exhausted | the rate-limit query / a real transaction now waits for a connection and succeeds (was `P2028` at 2 s); `busy` classification unit-tested |
| 6 | 8 simultaneous logins | all get clean results; 5 server sessions (pool 4 + the test driver) |
| 7 | 340 repeated requests; 100 sequential queries | 0 new connections |
| 8 | Shutdown | SIGTERM stops the server; 0 connections left open |
| 9 | Missing table | "database is missing tables ... run the migrations", not "unreachable" |
| 10 | Startup | pass |
| 11 | `next build` + `next start` | pass; `/api/health` registered |
| - | Unit 133/133, integration 35/35, `tsc --noEmit`, ESLint | pass |

Run the scenario driver with: build with `NEXT_DIST_DIR=.next-verify` against the test DB, then `node scripts/db-scenarios.mjs` (needs `TEST_DATABASE_URL`; refuses non-`_test` databases).

Not run: the Playwright e2e suite (needs the full seeded fixture), and anything against production.

## Limitations / remaining

- The production trigger is unconfirmed until the new logs capture an incident, or the hPanel limits are read.
- During a real outage the first login attempt still waits ~20-26 s (2x pool acquire timeout + the probe). Lower `DB_ACQUIRE_TIMEOUT_MS` (for example 5000) for faster failure, at the cost of tolerance to slow connects.
- Recommended follow-up (frontend scope, not done): make `src/app/not-found.tsx` independent of DB queries (static chrome), which removes ~9 queries from every dynamic page, including the login page.
- Rate limiting: a perfectly simultaneous burst on one key can block slightly early; it can never allow more than the limit.

---

## Update 2026-10-26: public "Something went wrong" screen, request logging, query-level retry

### The public error screen (reference `1806470507`)

The screen is `src/app/error.tsx`, Next's route error boundary. The "Reference" is **Next's error digest**: a hash of the server error that was thrown while rendering the page. A digest only exists for errors thrown on the *server* (a browser-only crash has none), so this is a server-render failure, not a client-side bug, and the number alone does not say what failed.

**What was verified (local MySQL, production build `.next-verify`):**

- A GET crawl of every URL in `sitemap.xml` plus `/blog?page=2`, `/blog?q=…`, category pages and 404 probes: all 200 (or the expected 404/308), no error screen, no `request_error` log line. So on a healthy database no public page throws.
- With the database made unreachable (a TCP forwarder in front of MySQL stopped; the real server untouched), the pages that are *not* cached fail: `/blog` and `/blog/category/*` return 500 after ~20 s (2 × the 10 s pool wait) and show exactly this screen with a Reference. Pages that Next has already built and cached (`/`, `/about`, `/services/*`, `/blog/<slug>`) keep serving the last good copy. Once the database returns, the same running process recovers on the next request (no restart): `/blog` 200 again in ~200 ms.

**Most likely cause on production, not confirmed:** the live database was unreachable or over its connection allowance at the moment of the request (the same condition as the admin "cannot reach its database" message), hitting a page that must query the database on every request (`/blog`, category pages, and any page whose cache had to be rebuilt). The production logs were not available, so this is an inference, not a finding. It is confirmed or ruled out in one step now:

1. Deploy this version.
2. When the screen appears, search the app log for the Reference: `grep 1806470507 <app log>`.
3. The matching line is one JSON object, e.g. `{"level":"error","msg":"request_error","digest":"1806470507","path":"/blog","routePath":"/blog","dbKind":"unreachable","dbCode":"P2039","error":"…"}`. `path` says which page; `dbKind` says whether it was the database (`unreachable`, `busy`, `limit`, `access`, `schema`) and an absent `dbKind` means an application error whose text is in `error`.

(The digest is derived by Next from the error's message and stack, so one failure repeats the same number: in the simulation above the failing `/blog` renders logged digest `2209355588` (settings query) or `3699642593` (category query) and the page showed the same number. `1806470507` identifies one specific error on the live server. It can only be matched to a cause from log lines written by this version, because older versions did not log the digest.)

### Changes

| File | Change |
|---|---|
| `src/instrumentation.ts` (new) | `onRequestError` logs every server error Next captures (page render, route handler, server action) as one scrubbed JSON line with `digest`, `path` (no query string), `routePath`, `routeType`, `revalidateReason`, `dbKind`/`dbCode`, error name and message. No URLs, passwords or tokens. This is the link between the number a visitor sees and the cause. |
| `src/lib/db.ts` | The Prisma client is extended so **every** query gets the bounded retry (`withDbRetry`: at most 2 retries, jittered 150/300 ms, only for failures to *open* a connection such as `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`). Before, only login, session lookup and rate limiting retried. Auth, schema, SQL, pool-saturation and mid-query errors are still thrown immediately, and there is still one client and one pool per process. |

Not changed on purpose: the pool wait (`DB_ACQUIRE_TIMEOUT_MS`, 10 s). Lowering it (for example 5000) makes a real outage show the error screen after ~10 s instead of ~20 s but makes slow connects on a busy host fail sooner.

### Verification run for this update

| # | Scenario | Result |
|---|---|---|
| 1 | Unit tests | 141/141 (8 new: sanitiser and rich-text blocks) |
| 2 | Integration tests against the test database (connections, leaks, outage classification, media usage) | 35/35 after applying the new migration to the test database |
| 3 | `tsc --noEmit`, `eslint src` | clean |
| 4 | `next build --webpack` | passes |
| 5 | Sitemap crawl, 42 URLs | all as expected |
| 6 | Database outage and recovery through a forwarder, app not restarted | uncached pages 500 with a digest during the outage and the digest is in the log; recovery on the next request |
| 7 | New browser tests `tests/e2e/blog-media.spec.ts` (separate banner/thumbnail upload, rich text, persistence, public rendering, validation, legacy posts, stored-XSS, Back button, Word paste, phone layout) | 6/6 |
| 8 | Whole e2e suite (394 tests) against the production build | 364 passed, 15 failed, 15 not run. The same 15 fail identically on the untouched previous commit (built and run side by side), so none were caused by this work: they depend on the current content of the shared development database (for example 5 header links where the test expects more than 6, About team members, homepage SEO text, an FAQ block on `/services/seo`) and on slider and banner height expectations |

### Hosting-side checks (cannot be done from code)

Unchanged from the deployment section above, and still required to make an outage *rarer* rather than just diagnosable: read `max_user_connections` and `max_connections_per_hour` in hPanel, keep `Node processes × DB_POOL_LIMIT` below the first, rotate the database password that was committed in git history (`e0423b2`), and ask support whether MySQL restarted at the times the error was reported.
