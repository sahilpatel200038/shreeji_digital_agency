import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AdminForm, SelectField, TextInput } from "@/components/admin/admin-form";
import { Card, Empty, Flash, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteRedirect, saveRedirect, toggleRedirect } from "@/actions/redirects";
import { parseBlocks } from "@/lib/blocks/schema";
import { scoreSeo } from "@/lib/seo/score";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SeoPage({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [pages, posts, services, redirects] = await Promise.all([
    db.page.findMany({ include: { seo: true }, orderBy: { title: "asc" } }),
    db.post.findMany({ include: { seo: true }, orderBy: { title: "asc" } }),
    db.service.findMany({ include: { seo: true }, orderBy: { title: "asc" } }),
    db.redirect.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const rows = [
    ...pages.map((p) => ({ kind: "Page", href: `/admin/pages/${p.id}`, live: `/${p.slug}`, title: p.title, status: p.status, seo: p.seo, slug: p.slug, blocks: parseBlocks(p.blocks), extra: p.excerpt ?? "" })),
    ...services.map((s) => ({ kind: "Service", href: `/admin/services/${s.id}`, live: `/services/${s.slug}`, title: s.title, status: s.status, seo: s.seo, slug: s.slug, blocks: parseBlocks(s.blocks ?? []), extra: `${s.intro ?? ""} ${s.summary}` })),
    ...posts.map((p) => ({ kind: "Post", href: `/admin/posts/${p.id}`, live: `/blog/${p.slug}`, title: p.title, status: p.status, seo: p.seo, slug: p.slug, blocks: parseBlocks(p.blocks), extra: p.excerpt ?? "" })),
  ].map((r) => {
    const { score } = scoreSeo({
      title: r.seo?.title, description: r.seo?.description, slug: r.slug, focusKeyword: r.seo?.focusKeyword, canonicalUrl: r.seo?.canonicalUrl, robotsIndex: r.seo?.robotsIndex,
      blocks: r.blocks, fallbackTitle: r.title, extraText: r.extra, imagesMissingAlt: r.blocks.filter((b) => b.type === "image" && !b.alt.trim()).length, published: r.status === "PUBLISHED",
    });
    return { ...r, score };
  });
  const canRedirects = can(user.role, "redirects:write");

  return (
    <>
      <PageHeader title="SEO & redirects" description="Per-page SEO is edited inside each page, post and service. Here you can review them all and manage redirects." />
      <Flash params={sp} />
      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <a href="/sitemap.xml" target="_blank" className="font-semibold text-bronze-700 underline">View sitemap.xml</a>
        <a href="/robots.txt" target="_blank" className="font-semibold text-bronze-700 underline">View robots.txt</a>
        <span className="text-muted">Site address: {siteUrl}</span>
      </div>

      <Card title="SEO overview">
        <p className="mb-4 text-sm text-muted">The score is an internal content-quality checklist (title, description, keyword use, alt text, links…). It is not a Google ranking prediction.</p>
        <TableWrap>
          <table className="w-full min-w-[820px]">
            <thead><tr><th className={th}>Content</th><th className={th}>Type</th><th className={th}>SEO title</th><th className={th}>Description</th><th className={th}>Keyword</th><th className={th}>Indexing</th><th className={th}>Checklist</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.href}`}>
                  <td className={td}><Link href={r.href} className="font-semibold text-forest-900 hover:text-bronze-700">{r.title}</Link><span className="block"><StatusBadge status={r.status} /></span></td>
                  <td className={`${td} text-muted`}>{r.kind}</td>
                  <td className={td}>{r.seo?.title ? "✓" : <span className="text-bronze-700">Missing</span>}</td>
                  <td className={td}>{r.seo?.description ? "✓" : <span className="text-bronze-700">Missing</span>}</td>
                  <td className={`${td} text-muted`}>{r.seo?.focusKeyword || "—"}</td>
                  <td className={td}>{r.seo?.robotsIndex === false ? <span className="text-bronze-700">noindex</span> : "Index"}</td>
                  <td className={td}><span className="font-bold">{r.score}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="mt-6" />
      <Card title="Redirects">
        <p className="mb-4 text-sm text-muted">Redirects are created automatically when a published URL changes. Changes take effect within about 30 seconds.</p>
        {canRedirects && (
          <AdminForm action={saveRedirect} submitLabel="Save redirect" className="mb-6 grid items-end gap-4 md:grid-cols-[1fr_1fr_160px_auto]">
            <TextInput label="From path" name="fromPath" placeholder="/old-page" required />
            <TextInput label="To (path or https URL)" name="toPath" placeholder="/new-page" required />
            <SelectField label="Type" name="statusCode" defaultValue="301" options={[{ value: 301, label: "301 Permanent" }, { value: 302, label: "302 Temporary" }, { value: 307, label: "307 Temporary" }, { value: 308, label: "308 Permanent" }]} />
          </AdminForm>
        )}
        <TableWrap>
          <table className="w-full min-w-[720px]">
            <thead><tr><th className={th}>From</th><th className={th}>To</th><th className={th}>Type</th><th className={th}>Hits</th><th className={th}>Active</th>{canRedirects && <th className={th}><span className="sr-only">Actions</span></th>}</tr></thead>
            <tbody className="divide-y divide-line">
              {redirects.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} break-all`}>{r.fromPath}</td>
                  <td className={`${td} break-all`}>{r.toPath}</td>
                  <td className={td}>{r.statusCode}</td>
                  <td className={`${td} text-muted`}>{r.hits}</td>
                  <td className={td}>{r.isActive ? "Yes" : "No"}</td>
                  {canRedirects && (
                    <td className={`${td} text-right`}>
                      <form action={toggleRedirect} className="inline">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="min-h-9 rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">{r.isActive ? "Disable" : "Enable"}</button>
                      </form>
                      <ConfirmButton small action={deleteRedirect} fields={{ id: r.id }} title="Delete this redirect?" message={`${r.fromPath} will no longer redirect.`} label="Delete" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {redirects.length === 0 && <Empty>No redirects yet.</Empty>}
        </TableWrap>
      </Card>
    </>
  );
}
