# Shreeji Marketing: website and admin CMS

A multi-page, SEO-managed marketing website for **Shreeji Marketing / Shreeji Digital Agency** (Ahmedabad, India) with a WordPress-style admin panel. Everything a marketing team needs to change (pages, services, team, header, footer, blog, FAQs, testimonials, projects, menus, SEO, settings, leads and media) is edited in the admin and stored in MySQL; no source change is needed.

**Stack:** Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Swiper · Prisma 7 (MariaDB driver adapter) → MySQL 8 · Zod · jose + bcryptjs · sharp · Vitest · Playwright.

> This project uses a recent Next.js with breaking changes. Before changing framework-level code, read the matching guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Environment variables](#environment-variables)
5. [Database setup and migrations](#database-setup-and-migrations)
6. [Running locally](#running-locally)
7. [Scripts, tests and linting](#scripts-tests-and-linting)
8. [Production build and deployment](#production-build-and-deployment)
9. [Admin panel](#admin-panel)
10. [Architecture](#architecture)
11. [Project structure](#project-structure)
12. [File uploads and media](#file-uploads-and-media)
13. [Security summary](#security-summary)
14. [Troubleshooting](#troubleshooting)
15. [Further documentation](#further-documentation)

## Features

**Public website** (`src/app/(site)`)
- Home, About (company profile + leadership team + work slider), Services (listing + one page per service), Blog (posts, categories), FAQ, Contact (enquiry form saved as leads), and CMS pages (privacy, terms, cookies, anything you add).
- Eighteen services, including **WhatsApp Marketing**, **Google Business Profile Optimization**, **Web Development & Design** and **App Development & Design** (web and app are separate services with their own page, SEO and wording).
- Per-page SEO (title, description, canonical, robots, Open Graph, structured data), `sitemap.xml`, `robots.txt`, automatic 301s when a slug changes, floating WhatsApp button, optional GA4/GTM.

**Admin panel** (`/admin`)
- Pages, Site pages (home/contact/listing SEO), Blog posts, Services, Projects, Team, Testimonials, FAQs, Media library, **Header Management**, **Footer Management**, Menus, Leads (with CSV export), SEO and redirects, Settings, Users and roles, Activity Logs.
- **Unsaved-changes protection** on every editor (sidebar, links, Cancel, browser Back, sign out and tab close).
- **Editing locks**: two administrators cannot edit the same page or module at once; locks expire automatically.
- A **sticky save bar** on every editor, with loading, success and error states.
- Role-based access (Super Admin, Administrator, Editor) enforced on the server for every page, action and API route.

## Prerequisites

- **Node.js 20.19+, 22.12+ or 24+** (Prisma 7 requirement; Next.js 16 needs 20.9+) and npm.
- **MySQL 8** (utf8mb4). MariaDB-compatible drivers are used through Prisma's adapter.
- A modern browser. Playwright downloads its own Chromium (`npx playwright install chromium`) for end-to-end tests.

## Installation

```bash
npm install            # also runs `prisma generate` (postinstall)
cp .env.example .env   # then fill in the values, see below
```

On Windows PowerShell use `Copy-Item .env.example .env`.

## Environment variables

Copy `.env.example` to `.env`. **Never commit `.env`**; it is git-ignored. Values below are placeholders.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@HOST:3306/shreeji_marketing` |
| `SHADOW_DATABASE_URL` | only for `prisma migrate dev` | Empty scratch database Prisma uses to compute migrations |
| `DB_POOL_LIMIT` | no (default 5) | Connection pool size |
| `AUTH_SECRET` | yes | Signs session cookies. At least 32 random characters, e.g. `openssl rand -base64 48` |
| `IP_HASH_SALT` | yes | Salt for hashing visitor IPs (rate limits, audit log) |
| `NEXT_PUBLIC_SITE_URL` | yes | Public origin, used in canonical URLs, sitemap and structured data |
| `ALLOW_INDEXING` | no | Set `false` on staging to emit `Disallow: /` and `noindex` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | first run only | The first Super Admin created by `npm run db:seed`. Remove the password afterwards |
| `TEST_DATABASE_URL` | integration tests only | A **separate** schema whose name contains `_test` |

## Database setup and migrations

```sql
CREATE DATABASE shreeji_marketing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE shreeji_marketing_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;  -- only for `migrate dev`
CREATE USER 'shreeji_site'@'localhost' IDENTIFIED BY '<password>';
GRANT ALL ON shreeji_marketing.* TO 'shreeji_site'@'localhost';
GRANT ALL ON shreeji_marketing_shadow.* TO 'shreeji_site'@'localhost';
```

```bash
npx prisma migrate deploy   # apply every migration in prisma/migrations (use this in production)
npm run db:seed             # idempotent starter content + first Super Admin
npm run db:migrate          # development only: create a new migration after editing prisma/schema.prisma
```

The seed only ever **adds** missing rows; it never truncates or overwrites existing content. It also performs the one-off split of the old combined "Web / App Development & Design" service into two services (the old address keeps working through a 301).

Migrations: `init` · `activity_logs_and_team` · `service_page_options` · `edit_locks_and_featured_services` (adds the editing-lock tables and the "Main service" flag on services).

## Running locally

```bash
npm run dev     # http://localhost:3000, admin at http://localhost:3000/admin
```

Sign in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, then **change the password** (Users) and remove it from your environment.

## Scripts, tests and linting

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Dev server / production build / production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest, no database needed) |
| `npm run test:integration` | Integration tests against the MySQL **test** schema (`TEST_DATABASE_URL`) |
| `npm run test:all` | Unit + integration |
| `npm run test:e2e` | Playwright end-to-end, responsive and accessibility tests. Needs a running production build, see below |
| `npm run check:links` | Crawls the sitemap and verifies internal links |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:seed` | Prisma generate / migrate dev / migrate deploy / seed |

**End-to-end tests** run against a production build on port 3100 and write to the database named in `DATABASE_URL`. They create `E2E …` fixtures and remove them again, but use a development database, not production:

```bash
NEXT_DIST_DIR=.next-e2e npx next build
NEXT_DIST_DIR=.next-e2e npx next start -p 3100 &
npx playwright test                              # everything
npx playwright test tests/e2e/admin-protections.spec.ts   # unsaved changes, sticky bar, editing locks
npx playwright test tests/e2e/site-management.spec.ts     # services, header, footer, team
```

(PowerShell: `$env:NEXT_DIST_DIR=".next-e2e"; npx next build`.) `bash scripts/full-check.sh` runs lint, types, unit, integration, build, e2e and the link crawl in one go.

## Production build and deployment

1. Provision MySQL 8 and a least-privilege user. Set the environment variables above (`NEXT_PUBLIC_SITE_URL` to the real origin).
2. `npm ci && npx prisma migrate deploy && npm run build`
3. First deployment only: `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… npm run db:seed`, then remove the password from the environment.
4. `npm start` behind a TLS-terminating proxy (Nginx/Caddy) under a process manager (PM2/systemd/Docker).
5. Take a database dump **before** each `migrate deploy` (media bytes live in the database, so one dump holds everything).

Details, backups and rollback: [`docs/TESTING_AND_DEPLOYMENT.md`](./docs/TESTING_AND_DEPLOYMENT.md).

## Admin panel

- **URL:** `/admin` (login at `/admin/login`). `proxy.ts` redirects visitors without a session cookie, and **every page, Server Action and API route re-checks the session and permission on the server**.
- **Roles:** *Super Admin* (everything, incl. users and scripts), *Administrator* (content, media, menus, settings, leads, redirects, activity logs), *Editor* (content and media only). The matrix is in `src/lib/auth/permissions.ts`.
- **Sessions:** HTTP-only cookie with a signed JWT that points at a revocable server-side `Session` row (12 hours). Deactivating a user or changing a role ends their sessions.

### Unsaved-changes protection

`AdminForm` (`src/components/admin/admin-form.tsx`) tracks whether a form differs from what was last saved. `UnsavedChangesProvider` (`unsaved-changes.tsx`, mounted by `AdminShell`) intercepts sidebar and in-page links, Cancel, sign out, the browser Back button and tab close. The dialog offers **Stay on page**, **Discard changes** and **Save & continue** (a failed or invalid save keeps you on the page with your edits). Small utility forms (login, notes, redirects) opt out with the `inline` prop.

### Editing locks

Each editor form passes `lock={[…resource keys…]}` (keys in `src/lib/lock-keys.ts`, logic in `src/lib/edit-lock.ts`).
- One `EditLock` row per resource, primary-keyed, so two administrators can never both hold it. Acquisition is a single conditional `UPDATE`/`INSERT`, which is race-free.
- A lease lasts 90 s and is renewed by a 20 s heartbeat (`/api/admin/locks`). Closing the tab releases it immediately (`sendBeacon`); a crash, lost connection or expired session frees it within 90 s. Sign-out and deactivation release all of a user's locks.
- A blocked administrator sees *"This page is currently being edited by NAME…"*, the form is read-only, they can **Request access** (the holder sees a notice on the next heartbeat), and the page reloads itself when the lock frees.
- **Server enforcement:** every save/delete Server Action calls `assertEditLocks` / `assertNotLockedByOthers`, so calling an action directly cannot bypass a lock. The same administrator in a second tab is also kept out.
- Not covered: optimistic-concurrency checks on stale form data after a lock has expired and been retaken; the lock prevents concurrent editing, it does not merge edits.

### Header, footer and team

- **Header Management** (`/admin/header`): logo, brand text, navigation links (with dropdowns), call-to-action button (text, link, new tab, on/off). Stored in the `header` setting plus the `header` menu.
- **Footer Management** (`/admin/footer`): logo, description, tagline, copyright, services column (which and how many), company and legal links, contact details (shared with the Contact page), social links, bottom line. Stored in the `footer`, `general`, `contact` and `social` settings plus the footer menus, saved together.
- **Team** (`/admin/team`): add, edit, photo, show/hide, reorder (up/down), delete, and the section heading shown on the About page.

## Architecture

- **Rendering:** public pages are statically generated and revalidated (`revalidate = 300`); every admin save calls `revalidatePath("/", "layout")`, so changes appear immediately. `src/lib/data/public.ts` holds the cached public queries.
- **Content:** structured JSON blocks (`src/lib/blocks`) rendered by React; no raw HTML is stored. Site-wide values live in the `Setting` table as validated JSON groups (`src/lib/settings/schema.ts`: general, contact, social, home, banners, header, footer, analytics, seo). Every field has a default, so a missing row never breaks the site.
- **Mutations:** Server Actions in `src/actions`, each wrapped in `run()` (typed results, no internals leaked), authorised with `requirePermission`, validated with Zod, written to the audit log, and followed by revalidation.
- **API routes:** `GET/POST /api/admin/media` (library and uploads), `POST /api/admin/locks` (editing locks), `GET /media/[id]` (public image delivery), plus `sitemap.xml`, `robots.txt` and the lead CSV export.
- **Services:** `Service.isFeatured` ("Main service") controls the homepage slider, the top of `/services` and the footer; the rest appear under "More ways we can help". Order is the Services display order.

## Project structure

```
prisma/                 schema.prisma, migrations/, seed.ts, seed-data/ (starter content, images)
src/app/(site)/         public website
src/app/admin/          login + (panel) screens; layout.tsx holds the sidebar navigation
src/app/api/admin/      media and locks route handlers
src/actions/            Server Actions (every one authorises server-side)
src/components/admin/   AdminForm, unsaved-changes guard, edit-lock hook, editors, media picker
src/components/site/    header, footer, sections, forms
src/lib/                db, auth, edit-lock, settings, seo, media, blocks, rate limiting, helpers
src/proxy.ts            redirect table + optimistic admin gate (Next.js 16 "proxy")
public/                 static assets (brand logo, banners, service images)
tests/                  unit/ · integration/ · e2e/
scripts/                maintenance and debugging helpers (check-links, full-check.sh, ...)
docs/                   planning, design, SEO, testing and deployment documents
```

## File uploads and media

Images are uploaded in the admin (Media library or any picker) to `POST /api/admin/media`. The server verifies magic bytes with sharp (the declared type and extension are ignored), rejects SVG and non-image files, caps uploads at **5 MB**, strips metadata, resizes to at most 2400 px and re-encodes (WebP; GIFs stay GIFs). The bytes are stored **in MySQL** (`MediaBlob`), so there is no upload directory to back up or mount; images are served from `/media/<id>?v=<checksum>` with long-lived caching. Deleting an image that is still in use is refused. Uploads are rate-limited.

## Security summary

bcrypt (cost 12) passwords · HTTP-only SameSite cookie + server-side session rows · per-request authorisation for every page, action and API route · same-origin check on state-changing API routes · persistent login/contact/upload rate limits · honeypot and timing checks on the contact form · safe-URL validation for menus, buttons and redirects · CSV formula-injection protection · JSON-LD escaping · security headers (`next.config.ts`) · append-only audit log (`/admin/activity-logs`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `DATABASE_URL is not set` or connection refused | Check `.env`, that MySQL is running and the user can reach the database |
| `AUTH_SECRET must be set and at least 32 characters long` | Set a long random `AUTH_SECRET` and restart |
| `prisma migrate dev` fails on the shadow database | Create `shreeji_marketing_shadow` and grant the user rights, or use `migrate deploy` |
| `Cannot find module '@/generated/prisma/…'` | Run `npm run db:generate` (it also runs on `npm install`) |
| Cannot sign in | The seed never overwrites an existing user; reset the password in Users, or insert a new admin with a new `SEED_ADMIN_EMAIL` |
| "Too many sign-in attempts" | The throttle clears after 15 minutes (or `DELETE FROM RateLimit`) |
| Admin page says it is being edited by someone | Wait for their lock to release (at most 90 s after they close the page) or use **Request access**. Stale locks can also be cleared with `DELETE FROM EditLock` |
| E2E tests hang or time out | Make sure `next start -p 3100` is running a fresh build and that port 3100 is free |
| First `next dev` request is very slow on a network or synced drive | Next warns about slow file systems; use a local disk, or test against a production build |
| Old service address returns 404 | Check Admin → SEO & redirects; slug changes on published services add a 301 automatically |

## Further documentation

`docs/` holds the planning and reference documents: `PROJECT_AUDIT`, `WEBSITE_STRUCTURE`, `DESIGN_SYSTEM`, `TECHNICAL_ARCHITECTURE`, `DATABASE_SCHEMA`, `SEO_STRATEGY`, `ADMIN_PANEL_SPECIFICATION`, `ADMIN_PAGE_MANAGEMENT`, `DEVELOPMENT_TASKS`, `TESTING_AND_DEPLOYMENT`, `IMAGE_CREDITS`.
