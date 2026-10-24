import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteService, moveService, setServiceStatus } from "@/actions/services";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function ServicesList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: { category: true, seo: { select: { title: true, description: true } } } });
  const canDelete = can(user.role, "content:delete");
  return (
    <>
      <PageHeader title="Services" description="Each published service gets its own page at /services/…. Main services (tick “Main service” in the editor) are shown on the homepage, the top of the Services page and the footer; the others are listed under “More ways we can help”." actions={<LinkButton href="/admin/services/new">Add service</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[900px]">
          <thead>
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Service</th>
              <th className={th}>Type</th>
              <th className={th}>Category</th>
              <th className={th}>SEO</th>
              <th className={th}>Status</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((s, i) => (
              <tr key={s.id}>
                <td className={td}>
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-muted">{i + 1}</span>
                    {(["up", "down"] as const).map((dir) => (
                      <form action={moveService} key={dir}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button disabled={(dir === "up" && i === 0) || (dir === "down" && i === items.length - 1)} aria-label={`Move ${s.title} ${dir}`} className="grid size-8 place-items-center rounded-md hover:bg-forest-50 disabled:opacity-30">
                          <Icon name="chevron-down" size={16} className={dir === "up" ? "rotate-180" : ""} />
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
                <td className={td}>
                  <Link href={`/admin/services/${s.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{s.title}</Link>
                  <span className="block text-sm text-muted">/services/{s.slug}</span>
                </td>
                <td className={td}>{s.isFeatured ? <span className="font-semibold text-forest-900">Main</span> : <span className="text-muted">Additional</span>}</td>
                <td className={`${td} text-muted`}>{s.category.name}</td>
                <td className={td}>{s.seo?.title && s.seo?.description ? <span className="text-forest-800">Set</span> : <span className="text-muted" title="Uses the service title and summary">Default</span>}</td>
                <td className={td}><StatusBadge status={s.status} /></td>
                <td className={`${td} text-right`}>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link href={`/admin/services/${s.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                    <Link href={`/admin/preview/services/${s.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Preview</Link>
                    <form action={setServiceStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value={s.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                      <button className="min-h-9 rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">{s.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
                    </form>
                    {canDelete && <ConfirmButton small action={deleteService} fields={{ id: s.id }} title="Delete this service?" message={`“${s.title}” will be permanently deleted.`} label="Delete" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No services yet.</Empty>}
      </TableWrap>
    </>
  );
}
