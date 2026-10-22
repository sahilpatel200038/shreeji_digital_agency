# Admin Panel Specification (`/admin`)

All screens are server-rendered with Server Actions for mutations, `noindex`, and protected by `requireUser()` on every page, action and API route. UI visibility follows permissions, but **authorisation is always re-checked server-side**.

## Roles & permissions
| Permission | SUPER_ADMIN | ADMIN | EDITOR |
|---|:-:|:-:|:-:|
| content (pages/posts/services/projects/faqs/testimonials) create/edit/publish | ✔ | ✔ | ✔ |
| delete content | ✔ | ✔ | ✘ |
| delete system pages | ✔ | ✘ | ✘ |
| media upload/edit | ✔ | ✔ | ✔ |
| media delete | ✔ | ✔ | ✘ |
| menus | ✔ | ✔ | ✘ |
| leads view/update/notes | ✔ | ✔ | ✘ |
| leads export / delete | ✔ | ✔ (export) | ✘ |
| redirects, SEO defaults | ✔ | ✔ | ✘ |
| settings (site) | ✔ | ✔ | ✘ |
| analytics/script IDs | ✔ | ✘ | ✘ |
| users & roles | ✔ | ✘ | ✘ |
| audit log | ✔ | ✔ (read) | ✘ |

## Screens
1. **Login** `/admin/login` — email + password, throttled, generic error, `?next=` validated to `/admin/*`. Logout in top bar (revokes session row).
2. **Dashboard** — counts from DB: published/draft pages, published/draft posts, services, leads (new / total), last 7 days leads; recent leads (5), recent activity from audit log (8), quick actions (new page/post/service, view leads, upload media). No fabricated analytics.
3. **Pages** — table (title, slug, template, status, updated) with search, status filter, pagination. Editor: title, slug (auto from title, uniqueness check), status, publish date, featured image picker, excerpt, **block editor** (add/remove/reorder/edit blocks), SEO panel (see below), preview (`/admin/preview/pages/[id]` renders draft with banner), delete w/ confirm dialog. Slug change → auto redirect (transaction).
4. **Posts** — same as pages plus category, tags (comma input, created on save), author, excerpt, reading time auto, related posts shown by category. Search + status + category filters.
5. **Services** — list ordered by `sortOrder` (up/down controls), category, status. Editor: title, slug, summary, icon key, hero heading, intro, benefits / process / FAQs (one per line as `Title | Text`), included list, extra blocks, related services checklist, featured image, status, SEO panel.
6. **Projects** (portfolio), **Testimonials** (with *Verified* checkbox; public only when verified+published), **FAQs** (global/service scope, show on home, order).
7. **Media Library** — grid/list, upload (multi-file, progress via XHR), drag-drop, type/size validation messages, edit title/alt/folder, replace file (keeps ID/URLs), delete (blocked with usage list if referenced), copy URL, search & folder filter, pagination.
8. **Menus** — pick menu (header, footer groups), items with label, URL (validated), new-tab, active toggle, parent (one level), up/down reorder, add/remove, save in one transaction.
9. **Leads** — table (name, email, phone, service, status, date) with search (name/email/phone/company), status filter, date sort, pagination; detail view with full message, status change, internal notes; CSV export (permission-gated, audit-logged, formula-injection-safe); spam status; delete (SUPER_ADMIN).
10. **SEO** — (a) global defaults (title template, description, OG image) in Settings; (b) **Redirects** CRUD (from/to/status code, active, hits; loop + open-redirect validation); (c) **SEO overview** table of all pages/posts/services with checklist score, missing title/description, indexability flags; (d) quick link to sitemap/robots.
11. **Settings** — site name, tagline, logo & favicon (media), contact (phone/email/address/maps link), social links, hero copy, stats (values + `show stats` toggle, default off), `show testimonials`, default SEO (title/description/OG image/robots), analytics IDs + Search Console token (SUPER_ADMIN), copyright text.
12. **Users** (SUPER_ADMIN) — list, create (role, min-12-char password), edit role/name/active, reset password, cannot demote/deactivate the last active SUPER_ADMIN or self-lock; session revocation on password change/deactivate.
13. **Audit log** — read-only table, filter by action/entity, paginated.

## SEO panel (Pages / Posts / Services)
Fields: SEO title (counter + SERP preview), meta description (counter), URL slug, canonical URL, robots index/follow, include in sitemap, focus keyword, secondary keywords, OG title/description/image, structured-data mode (Auto/None). **Checklist score** with pass/fail items and the label "Content-quality indicator — not a ranking prediction".

## Validation rules (Zod, server-side)
Title 1–150; slug `^[a-z0-9]+(?:-[a-z0-9]+)*$` 1–120 and not reserved (`admin`, `api`, `media`, `services`, `blog`, `work`, `contact`, `faq`, `sitemap.xml`, `robots.txt`, `_next`); meta title ≤ 70, description ≤ 200 (warning thresholds 60/160); canonical must be absolute `https://` URL; URLs in blocks/menus must be internal path, `https`, `mailto`, `tel`; passwords ≥ 12; uploads ≤ 5 MB, jpeg/png/webp/avif/gif; analytics IDs regex-validated.

## Workflows
- **Publish:** status DRAFT→PUBLISHED sets `publishedAt` (if empty); unpublish keeps data; drafts 404 publicly and never appear in sitemap.
- **Delete:** confirm dialog → server action → audit log → `revalidatePath`.
- **Autosave / unsaved-changes warning:** not implemented (explicit Save only).
- **Loading/errors:** `loading.tsx` skeletons per section, pending button states via `useFormStatus`, toast-style inline success/error banners, empty states with CTA.

## DB operations
Each screen maps 1:1 to Prisma operations in `src/actions/*.ts`; multi-row changes use `$transaction`; every create/update/delete/publish/login/role change/export writes `AuditLog`.
