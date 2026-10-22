# Testing & Deployment

## 1. Testing strategy
| Layer | Tool | Scope |
|---|---|---|
| Static | `tsc --noEmit`, ESLint | Types, lint |
| Unit | Vitest | slug, safe-URL/redirect validation, block schema, SEO score, rate-limit window logic, permissions matrix, CSV escaping |
| Integration | Vitest against the real local MySQL test schema | Prisma CRUD + relations, slug uniqueness, cascade/restrict, media-in-use guard, lead insert, redirect loop rule |
| E2E | Playwright (Chromium) | Public routes (200/404), nav links, contact submit → row in MySQL, admin login/logout, unauth redirect, create/publish/unpublish page, blog/service CRUD smoke, media upload, SEO tags/sitemap/robots/JSON-LD, redirect works |
| Responsive | Playwright viewports 320/375/425/768/1024/1280/1440 | no horizontal overflow, header/mobile nav usable, screenshots reviewed |
| Accessibility | Playwright + manual keyboard pass; axe-core where installed | focus, labels, landmarks, contrast |
| Performance | `next build` output, Lighthouse CLI (mobile) | measured, reported as-is |
| Security | Scripted negative tests | unauth API/action access, role escalation attempts, bad uploads (wrong MIME, oversize, polyglot), open redirect, XSS in lead/blocks, login throttling, header check |

Test DB: `shreeji_marketing_test` (separate schema; never the dev/prod DB).

## 2. Key test cases
- Every public URL in the sitemap returns 200 with exactly one `<h1>`, unique `<title>`, canonical, OG tags.
- Draft page/post/service → 404 and absent from `/sitemap.xml`.
- `/admin/*` without cookie → redirect to login; with EDITOR cookie, `/admin/users` → forbidden; direct Server Action/API calls without session fail.
- Contact: invalid email rejected with field error; honeypot filled → silently dropped; valid → Lead row; 6th in an hour → rate-limit message.
- Slug change creates 301 from old path; redirect with loop rejected; external `javascript:` URL rejected.
- Upload: `.exe` renamed `.png` rejected (magic bytes); > 5 MB rejected; valid image stored, served with long cache; deleting in-use media refused.
- Role matrix tests mirror the table in `ADMIN_PANEL_SPECIFICATION.md`.

## 3. Environment setup (local)
```bash
npm install
cp .env.example .env           # fill values (see below)
# MySQL: create DB + user (once)
#   CREATE DATABASE shreeji_marketing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   CREATE USER 'shreeji_site'@'localhost' IDENTIFIED BY '<password>';
#   GRANT ALL ON shreeji_marketing.* TO 'shreeji_site'@'localhost';
npx prisma migrate deploy      # or: npm run db:migrate (dev)
npm run db:seed
npm run dev                    # http://localhost:3000, admin at /admin
```
Prisma needs a shadow DB for `migrate dev`; the user also needs rights on `shreeji_marketing_shadow`.

## 4. Production build & deployment
1. Provision MySQL 8 (utf8mb4), dedicated least-privilege user (`SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES` only needed during migrations; can be reduced afterwards).
2. Set env vars (`DATABASE_URL`, `AUTH_SECRET` = `openssl rand -base64 48`, `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL=https://shreejidigitalagency.com`, seed vars for first run only).
3. `npm ci && npx prisma migrate deploy && npm run build`.
4. First run only: `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:seed`, then **remove the seed password** from the environment and change it in the admin.
5. `npm start` under a process manager (PM2/systemd/Docker) behind Nginx/Caddy with TLS and `X-Forwarded-*`.
6. Post-deploy: verify `/robots.txt`, `/sitemap.xml`, submit sitemap in Search Console, set 301s from old WordPress URLs if any (none existed beyond `/`), configure GA4/GSC IDs in Settings.
7. Hosting cut-over note: the current site is WordPress — keep it running until the new site is verified, then switch DNS. **Do not delete WordPress/DB data** until a backup is confirmed.

## 5. Backup & recovery
- Daily `mysqldump --single-transaction --routines --triggers shreeji_marketing | gzip > backup-$(date +%F).sql.gz`, retained ≥ 14 days, copied off-server. Media bytes are in the DB, so one dump contains everything.
- Restore: create empty DB, `gunzip -c backup.sql.gz | mysql shreeji_marketing`, then `npx prisma migrate status` should report up to date.
- Test a restore into a scratch DB quarterly.

## 6. Rollback
Keep the previous build artifact. For code-only regressions: redeploy previous artifact. For schema changes: migrations are additive-first (expand → migrate → contract); to roll back a bad migration restore the pre-deploy dump (take one immediately before `migrate deploy`).

## 7. Final acceptance criteria
See brief §15; each item is tracked in `DEVELOPMENT_TASKS.md` with a verification note. Results of every test run are recorded in `docs/TEST_REPORT.md` (generated at the end with actual outputs).
