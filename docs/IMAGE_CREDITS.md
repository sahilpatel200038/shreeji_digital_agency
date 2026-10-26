# Image credits

Service photos in `public/images/services/` come from Unsplash (https://unsplash.com), used under the
[Unsplash License](https://unsplash.com/license): free for commercial use, no attribution required.
Files were resized to 1200px wide and recompressed. Photo IDs (`https://unsplash.com/photos/<id>` or
`https://images.unsplash.com/photo-<id>`):

| File | Unsplash photo ID |
| --- | --- |
| web-app-development.jpg | 1498050108023-c5249f4df085 |
| custom-software-development.jpg | 1555066931-4365d14bab8c |
| seo.jpg | 1460925895917-afdab827c52f |
| digital-marketing.jpg | 1533750349088-cd871a92f312 |
| ads-management.jpg | 1551288049-bebda4e38f71 |
| ugc-content-creation.jpg | 1492619375914-88005aa9e8fb |
| social-media-marketing.jpg | 1611926653458-09294b3142bf |
| influencer-marketing.jpg | 1522202176988-66273c2fd55f |
| brand-strategy.jpg | 1557804506-669a67965ba0 |
| media-planning.jpg | 1432888498266-38ffec3eaf0a |
| creative-production.jpg | 1516035069371-29a1b244cc32 |
| analytics-insights.jpg | 1504868584819-f8e8b4b6d7e3 |
| lead-generation.jpg | 1542744173-8e7e53415bb0 |
| app-development-design.jpg | 1551650975-87deedd944c3 |
| whatsapp-marketing.jpg | 1611746872915-64382b5c76da |
| google-business-profile-optimization.jpg | 1556742049-0cfed4f6a45d |
| web-hosting.jpg | 1486312338219-ce68d2c6f44d |
| ui-ux-graphics-design.jpg | 1581291518857-4e27b48ff24e |

The seed (`npm run db:seed`) imports each file into the media library (folder "services") and sets it as the
service's featured image when none is set. Admins can change it in Admin > Services > Image.

## Page banner images

Banner photos in `public/images/banners/` (1200x900 WebP) are Unsplash photos under the same licence. They are the
fallbacks used when no banner image has been chosen in the admin panel.

| File | Used for | Unsplash photo ID |
| --- | --- | --- |
| home.webp | Homepage | 1552664730-d307ca884978 |
| about.webp | About page | 1522071820081-009f0129c71c |
| contact.webp | Contact page | 1534536281715-e28d76689b4d |
| services.webp | Services index | 1460925895917-afdab827c52f |
| blog.webp | Blog, blog categories, posts without an image | 1499750310107-5fef28a66643 |
| faq.webp | FAQ | 1434030216411-0b793f4b4173 |
| default.webp | Any other CMS page | 1600880292203-757bb62b4baf |

## About page company photo

`public/images/about/company-profile.webp` (1200x900 WebP) is an Unsplash photo under the same licence
(photo ID 1497366216548-37526070297c). It is deliberately a people-free office, so it cannot be mistaken for the team.
Team cards use a neutral placeholder until approved photographs are supplied (`photo` field in `src/lib/team.ts`).
