# SEO Strategy

> No search-volume, difficulty, ranking or traffic figure appears in this document. Everything marked **VERIFY** must be checked in an SEO research tool (Google Keyword Planner, Search Console, Semrush/Ahrefs) before being treated as a target.

## 1. Technical SEO checklist (implemented in code)
| Area | Implementation |
|---|---|
| Rendering | Server-rendered HTML for all public pages; real `<a href>` navigation (the live site used `javascript:void(0)`). |
| URLs | Lowercase, hyphenated, flat: `/services/seo`, `/blog/<slug>`. Trailing slash off. Slug uniqueness enforced; slug change auto-creates a 301. |
| Metadata | Per-page title/description/canonical/robots/OG/Twitter from `SeoMeta` with templates (§3). `metadataBase` from `NEXT_PUBLIC_SITE_URL`. |
| Canonicals | Self-referencing absolute canonical on every indexable page; overridable per entity; pagination/filter URLs canonicalise to the clean list URL. |
| Sitemap | `/sitemap.xml`, published + indexable + `includeInSitemap` only, with `lastModified`. |
| Robots | `/robots.txt`: allow `/`, disallow `/admin`, `/api`, link to sitemap; staging env (`NEXT_PUBLIC_SITE_URL` not the prod host / `ALLOW_INDEXING=false`) → `Disallow: /` + `noindex`. |
| Noindex | Drafts (never rendered publicly → 404), admin, 404, search/filter results, tag-only URLs, thank-you states. |
| Status codes | Missing/draft → real 404; redirects 301/302/307/308 from table. |
| Structured data | See §6. |
| Core Web Vitals | next/font, next/image with dimensions, minimal JS, no layout-shifting animations, no third-party embeds. Measured results reported in `TESTING_AND_DEPLOYMENT.md` (Lighthouse run), not promised. |
| Images | Alt text required in media library; `alt=""` only for decorative. Descriptive filenames recommended. |
| i18n | `lang="en-IN"`; no hreflang (single language). |

## 2. Site architecture & internal linking
Hub-and-spoke: `/services` (hub) → 11 service pages (spokes) → related services (m:n, editable) → blog posts link to relevant service pages → `/work` links to services by category → every page ends with the contact CTA. Breadcrumbs on all inner pages. Footer links to top services + legal. Header "Services" dropdown links all services. Each service page lists 3 related services and FAQs. No orphan pages (sitemap + nav).

## 3. Metadata templates
- Home: `Shreeji Marketing — Digital Marketing & Web Development Agency in Ahmedabad` (≤ 60 chars; **VERIFY** wording against search intent).
- Service: `{Service} Services in Ahmedabad | Shreeji Marketing` / description: one sentence benefit + scope + "Get a free consultation." (≤ 155 chars).
- Blog post: `{Post title} | Shreeji Marketing Blog`.
- Category: `{Category} Articles | Shreeji Marketing`.
- Legal: `{Page} | Shreeji Marketing`.
Defaults and OG image are in Settings; every field overridable per entity.

## 4. Heading hierarchy
One `<h1>` per page (hero title / post title). Sections are `<h2>`, cards/sub-parts `<h3>`. Block editor offers only H2/H3 (H1 reserved) so editors cannot break the hierarchy.

## 5. Keyword research requirements & mapping
Business facts used: Ahmedabad (Nikol), Gujarat, India agency; serves Indian and (per testimonials, unverified) overseas clients; services listed in the audit.
Method (to complete **with a tool**): seed → Keyword Planner/Search Console → classify by intent → map one primary keyword per URL → check cannibalisation.

| URL | Primary keyword candidate (VERIFY) | Secondary / long-tail candidates (VERIFY) | Intent |
|---|---|---|---|
| `/` | digital marketing agency in Ahmedabad | marketing agency Ahmedabad, web development and marketing company | Commercial/local |
| `/services/digital-marketing` | digital marketing services Ahmedabad | social media marketing agency Ahmedabad, Google Ads management | Commercial/local |
| `/services/seo` | SEO services in Ahmedabad | technical SEO audit, local SEO company Ahmedabad | Commercial/local |
| `/services/web-app-development` | web development company Ahmedabad | Next.js development agency, mobile app development Ahmedabad | Commercial/local |
| `/services/ui-ux-graphics-design` | UI UX design agency Ahmedabad | logo design Ahmedabad, social media graphics design | Commercial |
| `/services/lead-generation` | B2B lead generation services | LinkedIn lead generation agency, email automation lead gen | Commercial |
| `/services/web-hosting` | managed web hosting India | website hosting with SSL and backups | Commercial |
| `/services/brand-strategy` | brand strategy agency | brand positioning services, brand identity design | Commercial |
| `/services/media-planning` | media planning agency India | outdoor and digital media buying | Commercial |
| `/services/creative-production` | creative production agency | video production, product photography Ahmedabad | Commercial |
| `/services/influencer-marketing` | influencer marketing agency India | influencer campaign management | Commercial |
| `/services/analytics-insights` | marketing analytics services | marketing dashboard reporting | Commercial/info |
| `/blog/*` | informational how-to / checklists | question-form long-tails | Informational |
| `/contact` | Shreeji Marketing contact | marketing agency near Nikol Ahmedabad | Navigational/local |

Types to research: primary, secondary, long-tail, local-intent, informational, commercial. Output belongs in a spreadsheet; update `SeoMeta.focusKeyword` per entity accordingly.

## 6. Schema.org
Organization + `ProfessionalService` (name, logo, address, telephone, email, sameAs from social settings, `areaServed` Ahmedabad/India as configured) site-wide on `/`; `WebSite`; `Service` on service pages (provider linked to Organization); `BlogPosting` on posts (headline, image, datePublished/dateModified, author, publisher); `BreadcrumbList` on inner pages; `FAQPage` **only** on pages where the FAQs are visible; `ItemList` on services index; `ContactPage` on contact. No review/rating markup (no verified review data). Aggregate ratings are never emitted.

## 7. Social
Open Graph (`og:title/description/image/url/type/site_name/locale`) + Twitter `summary_large_image`. Default OG image from Settings (fallback: generated from logo).

## 8. Redirects & broken links
Redirect table with admin UI (loop and open-redirect validation); auto 301 on slug change; custom 404 with helpful links; automated internal-link check script (`npm run check:links`) crawling the sitemap.

## 9. Local SEO
NAP consistency (name, address, phone) from Settings across footer/contact/schema. Recommend (outside this codebase): claim/verify Google Business Profile, consistent NAP in directories. Google Maps link (no embedded iframe).

## 10. Content strategy
Blog categories: Digital Marketing, SEO, Web & Technology, Branding & Design. Content types: practical guides, checklists, process explainers, case-style write-ups **only with client permission and real data**. Each post targets one primary keyword/intent, links to ≥ 1 service page, has featured image with alt, FAQ block where natural.

## 11. Analytics & Search Console
Settings fields: GA4 measurement ID (`G-…`), GTM ID (`GTM-…`), Search Console verification token (rendered as `<meta name="google-site-verification">`). Values validated against strict regexes; scripts loaded only if set, via `next/script`. Cookie policy page covers analytics. **Action for owner:** create GA4 property, verify domain in Search Console, submit `/sitemap.xml`.

## 12. Admin SEO score (internal indicator)
Rules: title present/length 30–60 · description present/length 70–160 · focus keyword set · keyword in title / description / first paragraph / any heading / slug · slug ≤ 5 words & readable · exactly one H1 supplied by template · all images have alt · ≥ 1 internal link in body · canonical valid URL or empty · indexing intent sensible (published but noindex flagged). Displayed as "Content-quality checklist — not a Google ranking prediction".
