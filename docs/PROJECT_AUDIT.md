# Project Audit — Shreeji Marketing (shreejidigitalagency.com)

_Audit date: 2026-10-12. Sources: the live site (fetched as rendered text/markdown) and the empty project directory._

## 1. Important finding: there was no source code to audit

The working directory `shreeji_new_website/` was **empty** when this project started. The only "source" is the live site. Consequences:

- This is a **greenfield rebuild** that uses the live site as the content/brand reference, not an in-place refactor.
- Nothing existing was overwritten. Nothing in any existing database was touched; a **new** MySQL database (`shreeji_marketing`) was created next to the other databases already on the local server.
- The live site's HTML/CSS/JS could not be diffed; the audit of markup-level issues (meta tags, headings, ARIA) is limited to what could be observed from the extracted page text. Items that could not be verified are marked **(unverified)**.

## 2. Existing website

| Item | Finding |
|---|---|
| Platform | WordPress with a custom theme `shreeji_marketing_theme` (`/wp-content/themes/shreeji_marketing_theme/…`, uploads under `/wp-content/uploads/2026/…`). |
| Structure | **Single long page.** All sections on `/`. |
| Brand name | Displayed as "Shreeji Marketing" (logo, copyright). Domain and agency name elsewhere: "Shreeji Digital Agency". |
| Tagline | Logo: "Digital Solution, Real Growth". Footer: "Strategy · Story · Scale". Two different taglines. |
| Stock imagery | Unsplash (hotlinked) for hero/about/analytics. |
| Portfolio images | 5 PNGs in WordPress uploads (Vastu Astro Swami, One Center, PickNgo Mart, Prihaan, Pufflio). 3 projects have no image. |

### 2.1 Sections on the homepage
Hero · About ("Precision Strategy. Unmatched Results.") · Services (6) · How We Work (5-step) · Core Services (5) · Our Work (8 projects) · Why Choose Us (4) · Stats (4) · Process (4 steps) · Testimonials (5) · FAQ (5) · Book-a-consultation CTA · Contact (address/phone/email/form) · Footer.

### 2.2 Content inventory (preserved in the rebuild)
- **Services (11 distinct):** Brand Strategy, Digital Marketing, Media Planning, Creative Production, Influencer Marketing, Analytics & Insights, Lead Generation, Web/App Development & Design, Web Hosting, UI/UX & Graphics Design, SEO.
- **Portfolio (8):** Vastu Astro Swami, One Center, PickNgo Mart, Prihaan Spices, Pufflio (digital marketing); Shreeji International Courier, Abundance Educational (web dev); Skyscraper (web application).
- **Contact:** 3, Shreemad Elegance, Nr Kanba Hospital, Nikol, Ahmedabad, Gujarat, India · +91 9512494494 · info@shreejidigitalagency.com
- **Social:** Instagram `shreeji_marketing__`, Facebook (share link).
- **FAQ (5)**, **Testimonials (5)**, **Stats (4)**, **Process (4 + 5 steps)**.

## 3. Issues found

### 3.1 Navigation / functionality (critical)
1. **Every nav, footer, logo and CTA link is `javascript:void(0)`** — none of "About, Services, Process, Work, Clients, Get Started", "Explore →", "Start Your Project" lead anywhere. This also makes the site un-crawlable by link.
2. The contact form has **no visible submit button text/handler** in the extracted content (unverified whether it submits). No confirmation/validation behaviour could be confirmed.
3. "Explore →" for each service goes nowhere; there are **no service detail pages**.
4. Footer links only 4 of 11 services and only 3 company links; no legal links.
5. Two different primary nav and secondary nav lists with different labels.

### 3.2 SEO
1. `https://shreejidigitalagency.com/sitemap.xml` → **404**.
2. `https://shreejidigitalagency.com/robots.txt` → **404**.
3. Single URL = single title/description; the page title, meta description, canonical, Open Graph and structured data **could not be confirmed (unverified)** — assume absent or generic.
4. No service/blog/portfolio URLs, so no keyword can be targeted beyond the homepage.
5. No blog, no FAQ page, no legal pages, no Organization/LocalBusiness schema.
6. Unsplash hotlinking = third-party dependency, no controlled alt text (unverified).

### 3.3 Content accuracy / trust
Claims that need **owner verification before being displayed as fact** (the rebuild imports them but marks them unverified and hidden by default — see §6):
- "Over a decade of brand transformation work"
- "Over 500 campaigns with documented ROI"
- Stats: +284% brand awareness, +340% engagement, +195% leads, +127% revenue ("average client results, last 12 months")
- "99.9% uptime", "24/7 support" for hosting
- Five testimonials with outcome numbers (300%+ brand recall, "more leads in 30 days than a prior agency did in a year").
- The WordPress uploads path dates (2026) suggest the agency is recent; "10+ years" should be confirmed.

### 3.4 UX / design
- Brand is green + gold (logo) but the logo is a complex gradient mark; the live design could not be visually diffed. The rebuild derives the palette directly from the logo (see `DESIGN_SYSTEM.md`).
- Name inconsistency: "Shreeji Marketing" vs "Shreeji Digital Agency".
- Tagline inconsistency (see above).

### 3.5 Performance (unverified — not measurable without lab tools against live site)
- WordPress + hotlinked Unsplash images + PNG portfolio images (likely unoptimised).
- All sections on one page → large DOM.

### 3.6 Accessibility
- `javascript:void(0)` anchors are not real links (not keyboard/AT-friendly as navigation).
- Heading hierarchy, alt text, contrast, focus styles: **(unverified)**.

### 3.7 Security (live site, observable)
- WordPress default surface (theme/plugins unknown). Nothing further can be asserted without authorised testing; no active probing was performed.

## 4. Missing functionality (vs. the brief)
Multi-page architecture · service pages · blog · FAQ page · legal pages (privacy/terms/cookie) · custom 404 · working contact flow with storage · admin/CMS · SEO management · sitemap · robots · structured data · redirects · lead management · media library · menu management · roles.

## 5. Reusable from the existing site
Brand name/logo/colours, all service copy, process steps, FAQ, portfolio list and logos, contact details, social links. All preserved verbatim where factual.

## 6. Decisions taken because of the audit

| Decision | Reason |
|---|---|
| Greenfield Next.js 16 + TypeScript + Tailwind v4 + Prisma 7 (MariaDB driver adapter → MySQL 8) | Directory is empty; brief mandates this stack. |
| Keep **"Shreeji Marketing"** as the display brand (matches logo) and use "Shreeji Digital Agency" for domain/legal entity text; editable in Settings | Resolves the naming inconsistency without inventing a legal name. |
| Use logo tagline "Digital Solution, Real Growth" as the primary tagline | It's part of the logo lock-up. |
| Testimonials & stats imported as **unverified / unpublished** by default | Brief: show only verified testimonials and real-data statistics. Admin can verify and publish. |
| Portfolio projects without images get a branded placeholder (no fake screenshots) | Don't fabricate visuals. |
| 11 service detail pages, no padding pages | Matches real services; avoids thin duplicates. |
| No separate case-study detail pages | The existing data is only a title, category and tag list — would be thin content. |

## 7. Technical issues on this machine (build environment)
- `npm audit` reports 5 high-severity advisories, all in the **dev-only** ESLint toolchain (`braces → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next`). They are not shipped to production. The suggested "fix" downgrades `eslint-config-next` to v14 (breaking), so it is **not applied**; tracked in `DEVELOPMENT_TASKS.md`.
- Prisma's npm `latest` tag currently points at an `8.0.0-rc` release candidate; the project pins **stable 7.10.0**.
- No SMTP credentials exist → lead notification e-mail is **not** implemented; leads are stored in MySQL and visible in the admin. Documented as a limitation.
