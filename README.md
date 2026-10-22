# Shreeji Marketing — website & CMS

Multi-page, SEO-managed marketing website with a WordPress-style admin panel.
**Next.js 16 · TypeScript · Tailwind CSS 4 · Motion · Prisma 7 → MySQL 8.**

Planning documents (single source of truth) live in [`/docs`](./docs):
`PROJECT_AUDIT` · `WEBSITE_STRUCTURE` · `DESIGN_SYSTEM` · `TECHNICAL_ARCHITECTURE` · `DATABASE_SCHEMA` · `SEO_STRATEGY` · `ADMIN_PANEL_SPECIFICATION` · `DEVELOPMENT_TASKS` · `TESTING_AND_DEPLOYMENT` · `TEST_REPORT`.

## Quick start (local)

```bash
npm install
cp .env.example .env            # then edit the values (see .env.example comments)

# MySQL 8: create the database and a least-privilege user once
#   CREATE DATABASE shreeji_marketing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
#   CREATE DATABASE shreeji_marketing_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;  -- only for `migrate dev`
#   CREATE USER 'shreeji_site'@'localhost' IDENTIFIED BY '<password>';
#   GRANT ALL ON shreeji_marketing.* TO 'shreeji_site'@'localhost';
#   GRANT ALL ON shreeji_marketing_shadow.* TO 'shreeji_site'@'localhost';

npx prisma migrate deploy       # apply migrations
npm run db:seed                 # idempotent: creates the first Super Admin + all starter content
npm run dev                     # http://localhost:3000   admin: /admin
```

The seed creates the admin from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (it never overwrites an existing user). **Change that password after first sign-in and remove it from your environment.**

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm run lint` · `npm run typecheck` | ESLint · `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against the real MySQL **test** schema (`TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright E2E, responsive and accessibility tests against a running production build (`npx next start -p 3100`) |
| `npm run check:links` | Crawl the sitemap and verify every internal link |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrate (dev) / deploy (prod) / seed |

## Project layout

```
prisma/              schema, migrations, seed + seed content
src/app/(site)/      public website (home, services, work, blog, faq, CMS pages)
src/app/admin/       admin panel (login + (panel) screens)
src/actions/         Server Actions (every one authorises server-side)
src/lib/             db, auth, blocks, seo, settings, media, rate limiting, helpers
src/proxy.ts         redirect table + optimistic admin gate (Next 16 "proxy")
tests/               unit · integration · e2e
docs/                planning + reports
```

## Content & SEO management

Everything below is editable in **/admin** without touching code: pages, blog posts, services, projects, FAQs, testimonials, media, header/footer menus, site settings, per-page SEO (title, description, canonical, robots, Open Graph, focus keyword, sitemap inclusion), redirects (auto-created on slug change), leads, users and roles.

Content is stored as **structured blocks** (no raw HTML), rendered by React, so editors cannot inject scripts.

Testimonials and homepage statistics imported from the old site are **hidden until the owner verifies them** (Admin → Testimonials / Settings → Homepage).

## Security summary

bcrypt (cost 12) passwords · HTTP-only SameSite cookie with server-side session rows (revocable) · per-request server-side authorisation for every page, action and API route · persistent login/contact/upload rate limiting · honeypot + timing checks on the contact form · magic-byte image validation (SVG rejected, EXIF stripped, 5 MB cap) · safe-URL validation for menus, redirects and content links · CSV formula-injection protection · JSON-LD escaping · security headers · audit log. See `docs/TEST_REPORT.md` for what was actually tested.

## Deployment

See `docs/TESTING_AND_DEPLOYMENT.md` (build, migrate, env vars, backups, rollback).
