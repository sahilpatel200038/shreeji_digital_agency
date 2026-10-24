# Admin management of Home, Contact and Service pages

_Added 2026-10-17. Builds on the existing About / Pages / Services editors; no parallel architecture._

## Page checklist (public route → where it is edited)

| Public route | Admin screen | Content store | SEO |
|---|---|---|---|
| `/` | **Home page** (`/admin/home-page`) | Setting `home` + `banners.home` (hero picture) | `SeoMeta` via Setting `seoPages.home` (same row as Site pages → Homepage) |
| `/contact` | **Contact page** (`/admin/contact-page`) | `Page` (template CONTACT: title, intro, banner picture) + Setting `contact` | `Page.seo` |
| `/about` (reference) | Pages → About (`/admin/pages/:id`), Settings → Page banners, Team | `Page` + Setting `banners` | `Page.seo` |
| `/services` | Settings → Page banners; SEO under Site pages | Setting `banners` | Setting `seoPages.services` |
| `/services/<slug>` ×15 | Services → Edit (`/admin/services/:id`) | `Service` (+ `pageOptions`, `Faq` rows) | `Service.seo` |
| `/blog`, `/faq` | unchanged | | |

**Main vs additional services.** The data model has no parent/child relation; every service is a flat `/services/<slug>` page. "Main" = the eight in `CORE_SERVICE_SLUGS` (homepage + top of `/services`): web-app-development, custom-software-development, seo, digital-marketing, ads-management, ugc-content-creation, social-media-marketing, influencer-marketing. "Additional" (listed under "More ways we can help"): brand-strategy, media-planning, creative-production, analytics-insights, lead-generation, web-hosting, ui-ux-graphics-design. No hierarchy was invented; URLs are unchanged.

## What is editable

- **Home**: hero (eyebrow, headline, sub-headline, two buttons, picture + alt text), on/off switch per section (About, Core services, How we work, Testimonials, Videos, Projects, FAQ, Statistics), About text + topic tags + button + 4 "why us" cards, services/process/testimonials/videos/projects/FAQ headings, labels and buttons, 4 statistics, 2 videos, SEO (title, description, canonical, robots, sitemap, Open Graph incl. image).
- **Contact**: banner label, heading, intro, banner picture, phone, email, address, locality/region/country, map link, opening hours (now rendered), WhatsApp, enquiry-section wording and labels, services-strip heading/intro/on-off, SEO. The enquiry form (`submitLead`) is untouched.
- **Each service**: everything it already had (title, slug, summary, hero heading, intro, benefits, included, process, extra blocks, banner picture, related services, status, order, SEO) plus **Page sections & wording** (both buttons, every section label/heading, on/off per section) and **FAQs about this service** (new on the public page, with FAQPage structured data).

## Backend / data changes

- Migration `20261017133529_service_page_options`: `Service.pageOptions JSON NULL` (additive, nullable). A service without it renders exactly as before (defaults live in `src/lib/service-page.ts`).
- Service FAQs reuse `Faq.serviceId` (already in the schema, previously unused). They are replaced as a set on each service save; site-wide FAQs (`serviceId = NULL`) are never touched.
- New settings fields all default to the previous hard-coded wording (`src/lib/settings/schema.ts`), so no data migration or seed change is needed.
- `saveSettings` now merges into the stored value, so the old Settings → Homepage / Contact / Page banners forms can no longer reset fields they do not show.
- New actions: `saveHomePage`, `saveContactPage` (`src/actions/site-content.ts`); both require `settings:write`, validate with the same zod schemas as Settings, check picture ids against the media library, write content + SEO in one transaction and write an audit-log entry. Editors (content only) cannot open them.

## Fixes found on the way

- Contact `hours` could be saved but was never shown on the site.
- Service FAQs could not be attached or shown anywhere.
- Heading, button and section text on service pages, the home About tags/buttons, and the Contact page labels were hard-coded.
- Hero alt-text override on the homepage (caught by the new e2e test).

## Tests

`tests/unit/page-content.test.ts`, `tests/e2e/page-management.spec.ts` (coverage of all routes vs admin screens, Home, Contact, each of the 15 services, FAQs, section switches, images, validation, access control). `tests/e2e/admin.spec.ts` now also checks that editors are blocked from the two new screens.

## Update 2026-10-22: header, footer, team, locks and guards

| Public element | Admin screen | Stored in |
|---|---|---|
| Header: logo, brand text, navigation, call-to-action button | **Header Management** (`/admin/header`) | Setting `header` + Menu `header` |
| Footer: logo, description, tagline, copyright, services column, company/legal links, contact, social, bottom line | **Footer Management** (`/admin/footer`) | Settings `footer`, `general`, `contact`, `social` + Menus `footer-company`, `footer-legal` |
| About page team (members, photos, order, show/hide, section heading) | **Team** (`/admin/team`); the About page editor links to it | `TeamMember`, Setting `banners` (`teamEyebrow`, `teamTitle`) |
| Section headings of /services, /blog, /faq and CMS pages | Settings, Page banners | Setting `banners` |
| Main services (homepage slider, top of /services, footer) | Services, tick **Main service** | `Service.isFeatured` |

Every editor now has a sticky Save bar, the unsaved-changes dialog (`UnsavedChangesProvider`) and, for pages and modules, an exclusive editing lock (`AdminForm lock={[...]}`), enforced again on the server by every save and delete action. Menus for the header and footer are edited only in Header/Footer Management; the Menus screen points there.

**Team: what was found.** Saving a team member's name, role, photo, status and the section heading all persisted and appeared on `/about` in a production build (verified in a browser). The problems were structural: the About page editor gave no hint that the team lives elsewhere, new members were created with order 0 and so jumped to the front, order could only be changed by typing numbers (duplicates made it ambiguous), and the section heading was only editable deep inside Settings. All four are fixed (see the table above, "Move up/down", default order after the last member, and a pointer from the About editor).

**Hard-coded wording made editable.** Services page headings, FAQ and Blog banner labels and call-to-action band, the services heading on CMS pages, and the contact "Opening hours" label. Deliberately left in code: the 404 page and the structural labels of the admin itself.
