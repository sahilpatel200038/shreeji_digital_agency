import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteProject } from "@/actions/content";

export const dynamic = "force-dynamic";

export default async function ProjectsList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await db.project.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <>
      <PageHeader title="Projects" description="The portfolio shown in the Our Work slider on the homepage. Order and status apply." actions={<LinkButton href="/admin/projects/new">Add project</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[640px]">
          <thead><tr><th className={th}>Project</th><th className={th}>Category</th><th className={th}>Status</th><th className={th}>Order</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.id}>
                <td className={td}><Link href={`/admin/projects/${p.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{p.name}</Link></td>
                <td className={`${td} text-muted`}>{p.category.replace(/_/g, " ").toLowerCase()}</td>
                <td className={td}><StatusBadge status={p.status} /></td>
                <td className={`${td} text-muted`}>{p.sortOrder}</td>
                <td className={`${td} text-right`}>
                  <Link href={`/admin/projects/${p.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                  {can(user.role, "content:delete") && <ConfirmButton small action={deleteProject} fields={{ id: p.id }} title="Delete this project?" message={`“${p.name}” will be removed from the portfolio.`} label="Delete" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No projects yet.</Empty>}
      </TableWrap>
    </>
  );
}
