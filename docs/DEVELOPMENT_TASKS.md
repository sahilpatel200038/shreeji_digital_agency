# Development Tasks

Format: `- [ ] ID — description · P0–P2 · deps · expected result · **Impl:** ☐/☑ · **Test:** ☐/☑`
A task is ticked (`[x]`) only after implementation **and** verification. Status notes are added at the end of each phase.

## Phase A — Foundation
- [x] A1 — Inspect repo & live site · P0 · — · Audit written · Impl ☑ · Test ☑ (repo was empty; live site fetched)
- [x] A2 — Planning docs (9 files) · P0 · A1 · `/docs/*` · Impl ☑ · Test ☑ (review)
- [ ] A3 — Scaffold Next.js 16 + TS + Tailwind 4 · P0 · A2 · builds · Impl ☐ · Test ☐
- [ ] A4 — MySQL DB/user, Prisma 7 config, `.env.example` · P0 · A3 · `prisma migrate` works · Impl ☐ · Test ☐
- [ ] A5 — Brand tokens, fonts, global layout · P0 · A3 · Impl ☐ · Test ☐

## Phase B — Frontend
- [ ] B1 — UI primitives (Button, Section, forms, icons) · P0 · A5
- [ ] B2 — Header (dropdown, mobile nav), footer, breadcrumbs · P0 · B1, C-menus data
- [ ] B3 — Home page · P0 · B1,B2,C1
- [ ] B4 — Services index + 11 detail pages · P0 · C1
- [ ] B5 — Work page · P0 · C1
- [ ] B6 — Blog index/post/category · P0 · C1
- [ ] B7 — FAQ, About, Contact, legal CMS pages · P0 · C1
- [ ] B8 — Motion (reveal, stagger, hero, counters, accordion, route fade, reduced-motion) · P1 · B1
- [ ] B9 — loading.tsx / error.tsx / not-found / skeletons / empty states · P1
- [ ] B10 — Responsive pass at 320–1440 · P0 · B3–B7

## Phase C — Backend & DB
- [ ] C1 — Prisma schema + migration + seed (all content imported) · P0 · A4
- [ ] C2 — Zod schemas (blocks, SEO, forms) · P0
- [ ] C3 — Auth (login, session table, JWT cookie, logout, throttling) · P0 · C1
- [ ] C4 — Authorization (roles/permissions, `requireUser`) · P0 · C3
- [ ] C5 — Contact form action + rate limit + honeypot · P0 · C1,C2
- [ ] C6 — Media upload/serve pipeline · P0 · C4
- [ ] C7 — Audit logging, error handling, safe DB-failure UX · P1

## Phase D — Admin
- [ ] D1 — Layout, dashboard · P0 · C4
- [ ] D2 — Pages CRUD + block editor + preview · P0
- [ ] D3 — Posts CRUD (categories, tags) · P0
- [ ] D4 — Services CRUD (benefits/process/FAQs/related/order) · P0
- [ ] D5 — Projects, Testimonials, FAQs · P1
- [ ] D6 — Media library UI · P0 · C6
- [ ] D7 — Menus · P1
- [ ] D8 — Leads (list, detail, notes, status, CSV) · P0
- [ ] D9 — Settings · P0
- [ ] D10 — Users & roles · P0
- [ ] D11 — Audit log screen · P2

## Phase E — SEO
- [ ] E1 — `generateMetadata` for all entities + defaults · P0
- [ ] E2 — Canonical + robots directives · P0
- [ ] E3 — `sitemap.xml` (published/indexable only) · P0
- [ ] E4 — `robots.txt` (+ staging guard) · P0
- [ ] E5 — JSON-LD builders (Org, LocalBusiness, Service, BlogPosting, FAQ, Breadcrumb…) · P0
- [ ] E6 — Redirect management + auto-301 on slug change · P0
- [ ] E7 — SEO checklist/score in admin · P1
- [ ] E8 — Keyword mapping doc (candidates flagged VERIFY) · P1 · ☑ in `SEO_STRATEGY.md`
- [ ] E9 — Verify indexing rules (drafts, admin, 404) · P0

## Phase F — Testing
- [ ] F1 — ESLint · F2 — `tsc` · F3 — Vitest unit · F4 — Integration (MySQL) · F5 — Playwright E2E
- [ ] F6 — Production build · F7 — DB persistence · F8 — Every public page · F9 — Responsive screenshots
- [ ] F10 — SEO validation · F11 — Security tests · F12 — Fix & retest · F13 — Lighthouse (measured) · F14 — Final report `docs/TEST_REPORT.md`

## Known blockers / open items (updated at end)
- SMTP not configured → no lead e-mail notifications.
- Keyword volumes need a research tool (VERIFY items).
- Testimonials/stats/claims need owner verification before publishing.
- Legal pages are drafts requiring legal review.
- Dev-only `npm audit` advisories in the ESLint toolchain.
