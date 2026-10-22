# Website Structure & Sitemap

Legend: **Existing** = content existed on the live single page; **New** = did not exist as a page.

## 1. Public sitemap

| # | URL | Page | Status | Source |
|---|---|---|---|---|
| 1 | `/` | Home | Existing (rebuilt) | Coded sections + DB entities (copy, stats and FAQs editable in admin) |
| 2 | `/about` | About Us | New page (content existed as a section) | CMS page (`template=DEFAULT`) |
| 3 | `/services` | Services index (two categories) | New page | DB services |
| 4 | `/services/[slug]` | 11 service detail pages | New | DB services |
| 5 | `/work` | Portfolio / Our Work | New page (section existed) | DB projects |
| 6 | `/blog` | Blog index (+ search, category filter, pagination) | New | DB posts |
| 7 | `/blog/[slug]` | Blog post | New | DB posts |
| 8 | `/blog/category/[slug]` | Category archive | New | DB categories |
| 9 | `/faq` | FAQ | New page (section existed) | DB FAQs |
| 10 | `/contact` | Contact Us + form | New page (section existed) | CMS page `template=CONTACT` |
| 11 | `/privacy-policy` | Privacy Policy | New | CMS page |
| 12 | `/terms-and-conditions` | Terms & Conditions | New | CMS page |
| 13 | `/cookie-policy` | Cookie Policy | New | CMS page |
| 14 | `*` | Custom 404 | New | `not-found.tsx` |
| 15 | `/[slug]` | Any additional CMS page | New | CMS page |
| — | `/sitemap.xml`, `/robots.txt` | Generated | New | Metadata routes |
| — | `/media/[id]` | Media delivery | New | Route handler |

Legal-page text is a **starter draft** to be reviewed by the owner/legal counsel before launch (documented limitation).

Not created (to avoid thin/duplicate content): per-project case study pages, separate "Process" page, per-industry pages, tag archive pages (tags are labels only; they `noindex`).

## 2. Admin sitemap (all `noindex`, behind auth)

`/admin/login` · `/admin` (dashboard) · `/admin/pages` · `/admin/posts` · `/admin/services` · `/admin/projects` · `/admin/testimonials` · `/admin/faqs` · `/admin/media` · `/admin/menus` · `/admin/leads` · `/admin/seo` (redirects + defaults + audit) · `/admin/settings` · `/admin/users` · `/admin/audit-log`.

## 3. Page specifications

### 3.1 Home `/`
Sections: Hero (headline "Where Brands Command Attention" retained; sub, 2 CTAs → `/contact`, `/work`) · Trust strip (only if stats verified) · Intro/About teaser → `/about` · Services overview (all 11, grouped) → `/services/*` · Why choose us (4) · Process (4 steps) · Portfolio (8 → `/work`) · Testimonials (verified only) · Stats (only if verified) · FAQ (top 5 → `/faq`) · Contact CTA band.
Components: `Hero`, `SectionHeading`, `ServiceCard`, `ProcessSteps`, `ProjectCard`, `TestimonialCard`, `StatCounter`, `FaqAccordion`, `CtaBand`.
CTAs: Book Free Consultation → `/contact`; View Our Work → `/work`.
SEO: Title ≤ 60, description ≤ 160, Organization + LocalBusiness (ProfessionalService) + WebSite JSON-LD, FAQPage JSON-LD (FAQs on the page).

### 3.2 About `/about`
Blocks: story, approach, strengths, team approach, tag list (Brand Strategy, Digital Marketing, Media Planning, Creative Direction, Analytics), CTA. JSON-LD: Organization, BreadcrumbList.

### 3.3 Services index `/services`
Two category groups: **Marketing & Growth** (Brand Strategy, Digital Marketing, Media Planning, Creative Production, Influencer Marketing, Analytics & Insights, Lead Generation, SEO) and **Web & Technology** (Web/App Development & Design, Web Hosting, UI/UX & Graphics Design). Cards link to details. CTA band. JSON-LD: BreadcrumbList, ItemList.

### 3.4 Service detail `/services/[slug]`
Each has: hero (title, summary, CTA) · introduction · benefits (cards) · detailed scope (what's included bullets from the live site) · process/workflow · FAQs (service-specific, only if present) · related services · related projects (by category tag, if any) · inline inquiry form (pre-fills `service`) · CTA band · unique SEO title/description · JSON-LD: `Service` (provider = Organization, areaServed from settings), BreadcrumbList, FAQPage (when FAQs exist).
Slugs: `brand-strategy`, `digital-marketing`, `media-planning`, `creative-production`, `influencer-marketing`, `analytics-insights`, `lead-generation`, `web-app-development`, `web-hosting`, `ui-ux-graphics-design`, `seo`.

### 3.5 Work `/work`
Filterable grid (All / Digital Marketing / Web Development / Web Application). Project card: logo image or branded placeholder, name, category, scope tags, optional external link. CTA band. JSON-LD: BreadcrumbList, CollectionPage.

### 3.6 Blog `/blog`, `/blog/[slug]`, `/blog/category/[slug]`
Index: search `?q=`, category chips, pagination `?page=`. Post: hero, author, date, reading time, block content, share meta, related posts, CTA. JSON-LD: BlogPosting + BreadcrumbList. Empty state if no posts. The seed adds 3 generic, evergreen starter posts that make no performance claims, so the blog is not empty at launch; the owner can edit or unpublish them. The empty state still exists for when all posts are unpublished.

### 3.7 FAQ `/faq`
Accordion grouped by category, FAQPage JSON-LD (content visible on page).

### 3.8 Contact `/contact`
Address, phone (tel:), email (mailto:), social links, hours placeholder (not shown unless set), form (first/last name, phone, email, company, service interest, message, honeypot) → server action → MySQL. Map: link to Google Maps search for the address (no embedded third-party iframe → performance/privacy). JSON-LD: ContactPage + LocalBusiness.

### 3.9 Legal pages
Block content from CMS; `index` allowed for privacy/terms, cookie policy `index` too. Footer-linked.

### 3.10 404
Branded; links to Home, Services, Contact; `noindex`; returns real HTTP 404.

## 4. Navigation

**Header (editable in Admin → Menus):** About · Services (dropdown: all 11 grouped) · Work · Blog · FAQ · Contact · **Book Free Consultation** (button). Active-state via `aria-current="page"`. Mobile: slide-down panel with focus trap, `Esc` to close.

**Footer (editable):** Brand block + tagline + socials · Services (top services) · Company (About, Work, Blog, FAQ, Contact) · Legal (Privacy, Terms, Cookie) · Contact details · © line.

**Breadcrumbs** on all inner pages (visual + JSON-LD).

## 5. Reusable component inventory
`SiteHeader`, `SiteFooter`, `MobileNav`, `Breadcrumbs`, `Button`, `Container`, `Section`, `SectionHeading`, `Reveal` (scroll), `Stagger`, `PageTransition`, `Counter`, `FaqAccordion`, `ServiceCard`, `ProjectCard`, `PostCard`, `TestimonialCard`, `CtaBand`, `ContactForm`, `BlockRenderer`, `JsonLd`, `Skeleton`, `EmptyState`, `Pagination`.
