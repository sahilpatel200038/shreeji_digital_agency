import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { Card, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { getListingSeoRow, LISTING_KEYS, LISTING_PAGES } from "@/lib/seo/listing";
import { db } from "@/lib/db";
import { CORE_SERVICE_SLUGS } from "@/lib/core-services";

export const dynamic = "force-dynamic";

const CONTENT_LINK: Record<string, string> = {
  home: "Home page screen (hero, every section, picture, SEO)",
  services: "Settings → Page banners (heading, intro, picture); services themselves under Services",
  blog: "Settings → Page banners (heading, intro, picture); articles under Blog posts",
  faq: "Settings → Page banners (heading, intro, picture); questions under FAQs",
};

export default async function SitePagesIndex() {
  await requirePagePermission("content:write");
  const rows = await Promise.all(LISTING_KEYS.map(async (key) => ({ key, ...LISTING_PAGES[key], seo: await getListingSeoRow(key) })));
  const [pages, services] = await Promise.all([
    db.page.findMany({ orderBy: [{ isSystem: "desc" }, { title: "asc" }], include: { seo: { select: { title: true } } } }),
    db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { seo: { select: { title: true, description: true } } } }),
  ]);
  const core = new Set<string>(CORE_SERVICE_SLUGS);
  return (
    <>
      <PageHeader title="Site pages" description="Every page of the site and where to edit it. The Homepage and Contact page have their own screens; Services, Blog and FAQ text is in Settings and their modules, and their SEO is edited here." />
      <Card title="Built-in pages">
        <TableWrap>
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={th}>Page</th>
                <th className={th}>Address</th>
                <th className={th}>SEO title</th>
                <th className={th}>Where the content is edited</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className={`${td} font-semibold`}>{r.label}</td>
                  <td className={td}><a href={r.path} target="_blank" className="text-bronze-700 underline">{r.path}</a></td>
                  <td className={td}>{r.seo?.title || <span className="text-muted">Default</span>}</td>
                  <td className={`${td} text-sm text-muted`}>{CONTENT_LINK[r.key]}</td>
                  <td className={td}>{r.key === "home" && <Link href="/admin/home-page" className="mr-3 font-semibold text-bronze-700 underline">Edit page</Link>}<Link href={`/admin/site-pages/${r.key}`} className="font-semibold text-bronze-700 underline">Edit SEO</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      <div className="mt-6 space-y-6">
        <Card title="CMS pages (About, Contact, legal…)">
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Page</th>
                  <th className={th}>Address</th>
                  <th className={th}>SEO title</th>
                  <th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-semibold`}>{p.title}</td>
                    <td className={td}><a href={`/${p.slug}`} target="_blank" className="text-bronze-700 underline">/{p.slug}</a></td>
                    <td className={td}>{p.seo?.title || <span className="text-muted">Default</span>}</td>
                    <td className={td}>
                      <Link href={p.template === "CONTACT" ? "/admin/contact-page" : `/admin/pages/${p.id}`} className="font-semibold text-bronze-700 underline">Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
        <Card title={`Service pages (${services.length})`}>
          <TableWrap>
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Service</th>
                  <th className={th}>Type</th>
                  <th className={th}>Address</th>
                  <th className={th}>SEO title</th>
                  <th className={th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.map((s) => (
                  <tr key={s.id}>
                    <td className={`${td} font-semibold`}>{s.title}</td>
                    <td className={td}>{core.has(s.slug) ? "Main" : "Additional"}</td>
                    <td className={td}><a href={`/services/${s.slug}`} target="_blank" className="text-bronze-700 underline">/services/{s.slug}</a></td>
                    <td className={td}>{s.seo?.title || <span className="text-muted">Default</span>}</td>
                    <td className={td}><Link href={`/admin/services/${s.id}`} className="font-semibold text-bronze-700 underline">Edit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      </div>
    </>
  );
}
