# Technical Architecture

## 1. Stack (verified versions installed)
Next.js **16.4** (App Router, React 19.3, Turbopack dev/build) · TypeScript 5 (strict) · Tailwind CSS 4 · `motion` 14 · Prisma **7.10** + `@prisma/adapter-mariadb` → MySQL 8.0 · Zod 4 · `jose` (JWT) · `bcryptjs` (password hashing, pure JS → no native build on any host) · `sharp` (image processing) · Vitest + Playwright.

> Next 16 differences honoured (from `node_modules/next/dist/docs`): `middleware.ts` is now **`proxy.ts`**; `params`/`searchParams`/`cookies()`/`headers()` are async; metadata files (`sitemap.ts`, `robots.ts`, `icon.png`) are file conventions.

## 2. Folder structure
```
prisma/            schema.prisma, migrations/, seed.ts, seed-data/*
prisma.config.ts   datasource + seed command (Prisma 7)
src/
  app/
    (site)/        public layout (header/footer), pages: /, /about?, /services, /work, /blog, /faq, /contact, /[slug]
    admin/         login + (panel)/ dashboard & CRUD screens (own layout, noindex)
    media/[id]/    GET media bytes (cache headers, ETag)
    sitemap.ts robots.ts not-found.tsx error.tsx global-error.tsx
  components/      ui/, site/, admin/, blocks/, motion/
  lib/             db.ts, auth/, validation/, seo/, settings/, blocks/, media/, rate-limit.ts, audit.ts, slug.ts, utils
  actions/         Server Actions (public: contact; admin: pages, posts, services, …)
  proxy.ts         redirects table lookup + optimistic admin cookie gate + security headers
docs/              the nine planning documents
tests/             unit (vitest) + e2e (playwright)
```

## 3. Rendering & data strategy
- Public pages are **Server Components** reading MySQL through `src/lib/data/public.ts`. Detail routes (`/services/[slug]`, `/blog/[slug]`, `/[slug]`) use `generateStaticParams` + `revalidate = 300` (ISR); unknown slugs render on demand and return a **real HTTP 404**. Every admin write calls `revalidatePath("/", "layout")`, so edits appear immediately. A production build therefore needs database connectivity.
- **No site-wide `loading.tsx`**: a Suspense boundary above a dynamic route makes Next stream a 200 before `notFound()` runs, which returned 200 for missing blog categories (found by the E2E suite). Correct status codes were prioritised for SEO; loading skeletons exist for the admin panel and are available as `PageSkeleton`.
- Client components only where needed: mobile nav, motion wrappers, accordion, forms, admin editors.
- Metadata via `generateMetadata` (title, description, canonical, robots, OG/Twitter) fed by `SeoMeta` + site defaults. JSON-LD emitted as `<script type="application/ld+json">` from typed builders (`src/lib/seo/schema.ts`) with `<` escaped.
- DB failure → `error.tsx` (friendly) and `getXSafe()` wrappers return empty states where a section is optional; the public site never prints SQL/stack traces.

## 4. Database access
`src/lib/db.ts` creates one `PrismaClient` (global singleton in dev) with `PrismaMariaDb` adapter using `DATABASE_URL` parsed into pool config (`connectionLimit` from env, default 5 → suitable for shared hosting/serverless). Transactions (`$transaction`) for: slug rename + auto redirect, post tag sync, menu reorder, media replace, lead status+note.

## 5. Authentication & authorization
- Login = Server Action: Zod validate → rate-limit (5 attempts / 15 min per IP-hash **and** per email) → constant-time bcrypt compare (dummy hash when user missing) → create `Session` row → sign a JWT (`HS256`, `AUTH_SECRET`, 12h) containing only `sid`, `uid`, `role` → set cookie `shreeji_session` **HttpOnly, SameSite=Lax, Secure in prod, Path=/**.
- Every protected read/write calls `requireUser(minRole)` / `requirePermission('pages:write')` which verifies JWT **and** the Session row (not revoked/expired) **and** `User.isActive` — server-side, per call. `proxy.ts` only does an optimistic cookie-presence redirect (not security).
- Permission matrix (`permissions.ts`, unit-tested): SUPER_ADMIN everything incl. users, analytics scripts, lead deletion, deleting system pages; ADMIN content (incl. delete), media (incl. delete), leads (read/export), menus, redirects, settings except analytics IDs, audit log; EDITOR can create/edit/publish content and upload media only (no deletes, leads, menus, settings, redirects, users, audit).
- CSRF: Server Actions are Origin-checked by Next; custom route handlers (upload) additionally verify `Origin`/`Sec-Fetch-Site` and require the session cookie (SameSite=Lax).
- Passwords: min 12 chars at creation/change, bcrypt cost 12.

## 6. Content model
Pages/Posts/Services store structured **blocks** (`src/lib/blocks/schema.ts`, Zod discriminated union): `heading`, `paragraph`, `list`, `image`, `quote`, `callout`, `cta`, `faq`, `divider`. `BlockRenderer` renders to React elements; inline formatting is a tiny safe subset (`**bold**`, `*italic*`, `[text](url)`) parsed to elements — **no `dangerouslySetInnerHTML`**, links restricted to `/…`, `https://`, `mailto:`, `tel:`.

## 7. Media
`POST /api/admin/media` (multipart): auth + permission → size ≤ 5 MB → MIME allow-list (jpeg/png/webp/avif/gif/svg-rejected) → **magic-byte verification via sharp** (not trusting client MIME) → re-encode metadata strip (EXIF) → store row + blob. Served from `/media/[id]` with `Cache-Control: public, max-age=31536000, immutable` keyed by `?v=<checksum8>`, ETag, `nosniff`. `next/image` consumes these URLs (local pattern configured). SVG upload disabled (script risk). Delete refuses when referenced.

## 8. SEO architecture
`SeoMeta` row per entity + global defaults in `Setting`. `src/lib/seo/` contains `buildMetadata()`, `schema.ts` (Organization, LocalBusiness/ProfessionalService, WebSite, Service, BlogPosting, FAQPage, BreadcrumbList, ItemList, ContactPage), `score.ts` (transparent checklist). `sitemap.ts` lists only `PUBLISHED && robotsIndex && includeInSitemap` content (and respects `ALLOW_INDEXING`). `robots.ts` disallows `/admin` and `/api/`, and references the sitemap. **Redirects:** `src/proxy.ts` (Node runtime in Next 16) loads the active redirect table into an in-process cache refreshed every 30 s, so a redirect or slug change takes effect within ~30 s. The cache is per-process; multi-instance deployments each refresh independently. Redirects are validated (internal path or https only, loop detection, `/admin` and `/api` excluded). Slug changes on published content create a 301 automatically and re-point existing chains.

## 9. Forms workflow (contact)
Client form (progressive enhancement via `useActionState`) → Server Action `submitLead`: honeypot field, min-fill-time token (HMAC signed timestamp), Zod validation (length/format/URL-spam heuristics), rate limit (5 / hour / IP-hash), insert `Lead`, return typed state (`success | fieldErrors | error`). No lead data is exposed to any public endpoint.

## 10. Errors & logging
`error.tsx`, `global-error.tsx`, `not-found.tsx`, admin `error.tsx`; typed `ActionResult` for actions; server logger (`console` JSON lines with level, request id when available, **never** secrets/PII) — pluggable. Audit log for sensitive admin actions (login, user changes, publish/unpublish/delete, settings, redirects, media delete, lead export).

## 11. Security headers (proxy + `next.config.ts`)
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geolocation/payment off), `Strict-Transport-Security` (production). Admin responses add `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`; `/media/*` adds `nosniff` and a sandboxing CSP. **A site-wide Content-Security-Policy is NOT implemented** (Next injects inline scripts; a nonce-based CSP via the proxy is listed as a follow-up in the task list). `poweredByHeader: false`.

## 12. Environment variables (`.env.example`)
`DATABASE_URL`, `DB_POOL_LIMIT`, `AUTH_SECRET` (≥ 32 chars), `IP_HASH_SALT`, `NEXT_PUBLIC_SITE_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `NODE_ENV`. Only `NEXT_PUBLIC_SITE_URL` is client-visible. `.env*` git-ignored.

## 13. Performance
Server rendering, ISR, `next/font`, `next/image` (AVIF/WebP, sizes), lazy images, no third-party scripts unless configured (loaded `afterInteractive`), minimal client JS, indexed queries, paginated admin tables (20/page), `select` only needed columns, `React.cache` to dedupe per-request queries.

## 14. Deployment requirements
Node ≥ 20.19 (tested on 24), MySQL 8 (utf8mb4), persistent process (`next start`) or container; `prisma migrate deploy` on release; env vars set; reverse proxy with TLS. Details in `TESTING_AND_DEPLOYMENT.md`.
