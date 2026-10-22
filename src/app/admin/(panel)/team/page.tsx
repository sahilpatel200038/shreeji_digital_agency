import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteTeamMember, setTeamStatus } from "@/actions/team";

export const dynamic = "force-dynamic";

export default async function TeamList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requirePagePermission("content:write");
  const sp = await searchParams;
  const items = await db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <>
      <PageHeader title="Team" description="The leadership team shown on the About page. Order and status apply." actions={<LinkButton href="/admin/team/new">Add team member</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[640px]">
          <thead>
            <tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Order</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((m) => (
              <tr key={m.id}>
                <td className={td}><Link href={`/admin/team/${m.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{m.name}</Link></td>
                <td className={`${td} text-muted`}>{m.role}</td>
                <td className={td}><StatusBadge status={m.status} /></td>
                <td className={`${td} text-muted`}>{m.sortOrder}</td>
                <td className={`${td} text-right`}>
                  <Link href={`/admin/team/${m.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                  <form action={setTeamStatus} className="inline">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value={m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                    <button className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">{m.status === "PUBLISHED" ? "Hide" : "Show"}</button>
                  </form>
                  {can(user.role, "content:delete") && <ConfirmButton small action={deleteTeamMember} fields={{ id: m.id }} title="Remove this team member?" message={`“${m.name}” will be removed from the About page.`} label="Delete" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No team members yet. The About page hides the team section until you add one.</Empty>}
      </TableWrap>
    </>
  );
}
