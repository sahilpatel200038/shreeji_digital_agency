import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, FilterBar, Flash, LinkButton, PageHeader, Pager, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deletePage, setPageStatus } from "@/actions/pages";
import { deleteService, setServiceStatus } from "@/actions/services";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function PagesList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status === "DRAFT" || sp.status === "PUBLISHED" ? (sp.status as "DRAFT" | "PUBLISHED") : undefined;
  const q = sp.q?.trim().slice(0, 80);
  const textMatch = (title: string, slug: string) => !q || title.toLowerCase().includes(q.toLowerCase()) || slug.toLowerCase().includes(q.toLowerCase());
  const [pages, services, homeSettings] = await Promise.all([
    db.page.findMany({ where: { ...(status ? { status } : {}), ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}) } }),
    db.service.findMany({ include: { category: { select: { name: true } } } }),
    db.setting.findMany({ where: { key: { in: ["home", "banners", "seoPages"] } }, select: { updatedAt: true } }),
  ]);
  // One list: CMS pages, the Homepage (always live, edited on its own screen) and every service page.
  type Row = { key: string; kind: "page" | "home" | "service"; id: number; title: string; path: string; status: "DRAFT" | "PUBLISHED"; updatedAt: Date; isSystem: boolean; tag?: string };
  const rows: Row[] = [
    ...pages.map((p): Row => ({ key: `p${p.id}`, kind: "page", id: p.id, title: p.title, path: `/${p.slug}`, status: p.status, updatedAt: p.updatedAt, isSystem: p.isSystem })),
    ...services
      .filter((x) => (!status || x.status === status) && textMatch(x.title, x.slug))
      .map((x): Row => ({ key: `s${x.id}`, kind: "service", id: x.id, title: x.title, path: `/services/${x.slug}`, status: x.status, updatedAt: x.updatedAt, isSystem: false, tag: `${x.isFeatured ? "main service" : "additional service"} · ${x.category.name}` })),
  ];
  if ((!status || status === "PUBLISHED") && textMatch("Home", "")) {
    const updatedAt = homeSettings.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), new Date(0));
    rows.push({ key: "home", kind: "home", id: 0, title: "Home", path: "/", status: "PUBLISHED", updatedAt, isSystem: true });
  }
  rows.sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime());
  const total = rows.length;
  const items = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) });
  const canDelete = can(user.role, "content:delete");

  return (
    <>
      <PageHeader title="Pages" description="Home, About, contact, legal pages, every service page and any other standalone pages." actions={<LinkButton href="/admin/pages/new">Add page</LinkButton>} />
      <Flash params={sp} />
      <FilterBar q={q} placeholder="Search title or slug" filters={[{ name: "status", label: "All statuses", value: status, options: [{ value: "PUBLISHED", label: "Published" }, { value: "DRAFT", label: "Draft" }] }]} />
      <TableWrap>
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className={th}>Title</th>
              <th className={th}>URL</th>
              <th className={th}>Status</th>
              <th className={th}>Updated</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => {
              const editHref = p.kind === "home" ? "/admin/home-page" : p.kind === "service" ? `/admin/services/${p.id}` : `/admin/pages/${p.id}`;
              return (
              <tr key={p.key}>
                <td className={td}>
                  <Link href={editHref} className="font-semibold text-forest-900 hover:text-bronze-700">{p.title}</Link>
                  {p.isSystem && <span className="ml-2 rounded bg-forest-50 px-1.5 py-0.5 text-xs text-muted">system</span>}
                  {p.tag && <span className="ml-2 rounded bg-forest-50 px-1.5 py-0.5 text-xs text-muted">{p.tag}</span>}
                </td>
                <td className={`${td} text-muted`}>{p.path}</td>
                <td className={td}><StatusBadge status={p.status} /></td>
                <td className={`${td} text-muted`}>{formatDate(p.updatedAt)}</td>
                <td className={`${td} text-right`}>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link href={editHref} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                    {p.kind === "home" ? (
                      <Link href="/" target="_blank" className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Preview</Link>
                    ) : (
                      <Link href={`/admin/preview/${p.kind === "service" ? "services" : "pages"}/${p.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Preview</Link>
                    )}
                    {p.kind !== "home" && (
                      <form action={p.kind === "service" ? setServiceStatus : setPageStatus}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="returnTo" value="/admin/pages" />
                        <input type="hidden" name="status" value={p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                        <button className="min-h-9 rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">{p.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
                      </form>
                    )}
                    {canDelete && p.kind !== "home" && <ConfirmButton small action={p.kind === "service" ? deleteService : deletePage} fields={{ id: p.id, returnTo: "/admin/pages" }} title={p.kind === "service" ? "Delete this service?" : "Delete this page?"} message={`“${p.title}” will be permanently deleted${p.isSystem ? ". This is a system page; deleting it may break links in the site footer or navigation" : ""}.`} label="Delete" />}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No pages found.</Empty>}
      </TableWrap>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} base={base} />
    </>
  );
}
