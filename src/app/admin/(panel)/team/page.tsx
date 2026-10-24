import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteTeamMember, moveTeamMember, saveTeamSection, setTeamStatus } from "@/actions/team";
import { getSettings } from "@/lib/settings/get";
import { AdminForm, TextInput } from "@/components/admin/admin-form";
import { Icon } from "@/components/ui/icons";
import { lockKey } from "@/lib/lock-keys";

export const dynamic = "force-dynamic";

export default async function TeamList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requirePagePermission("content:write");
  const sp = await searchParams;
  const [items, settings] = await Promise.all([db.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }), getSettings()]);
  const canEditSection = can(user.role, "settings:write");
  return (
    <>
      <PageHeader title="Team" description="The leadership team shown on the About page. Order and status apply." actions={<LinkButton href="/admin/team/new">Add team member</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[640px]">
          <thead>
            <tr><th className={th}>Order</th><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((m, i) => (
              <tr key={m.id}>
                <td className={td}>
                  <div className="flex items-center gap-1">
                    <span className="w-6 text-muted">{i + 1}</span>
                    {(["up", "down"] as const).map((dir) => (
                      <form action={moveTeamMember} key={dir}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="dir" value={dir} />
                        <button disabled={dir === "up" ? i === 0 : i === items.length - 1} aria-label={`Move ${m.name} ${dir}`} className="grid size-9 place-items-center rounded-lg hover:bg-forest-50 disabled:opacity-30">
                          <Icon name="chevron-down" size={16} className={dir === "up" ? "rotate-180" : ""} />
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
                <td className={td}><Link href={`/admin/team/${m.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{m.name}</Link></td>
                <td className={`${td} text-muted`}>{m.role}</td>
                <td className={td}><StatusBadge status={m.status} /></td>
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
      {canEditSection && (
        <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-white p-5 md:p-6">
          <h2 className="mb-1 text-lg font-bold">Section heading on the About page</h2>
          <p className="mb-4 text-sm text-muted">The small label and the heading shown above the team.</p>
          <AdminForm action={saveTeamSection} submitLabel="Save heading" className="grid items-end gap-4 md:grid-cols-[1fr_2fr_auto]" lock={[lockKey.setting("banners")]} inline>
            <TextInput label="Label" name="teamEyebrow" defaultValue={settings.banners.teamEyebrow} maxLength={60} />
            <TextInput label="Heading" name="teamTitle" defaultValue={settings.banners.teamTitle} maxLength={120} required />
          </AdminForm>
        </div>
      )}
    </>
  );
}
