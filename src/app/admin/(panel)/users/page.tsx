import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function UsersList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("users:manage");
  const sp = await searchParams;
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });
  return (
    <>
      <PageHeader title="Users" description="Administrators and editors who can sign in." actions={<LinkButton href="/admin/users/new">Add user</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[640px]">
          <thead><tr><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Role</th><th className={th}>Status</th><th className={th}>Last sign-in</th></tr></thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className={td}><Link href={`/admin/users/${u.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{u.name}</Link></td>
                <td className={`${td} text-muted`}>{u.email}</td>
                <td className={td}>{ROLE_LABELS[u.role]}</td>
                <td className={td}>{u.isActive ? "Active" : <span className="text-bronze-700">Deactivated</span>}</td>
                <td className={`${td} text-muted`}>{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <Empty>No users.</Empty>}
      </TableWrap>
    </>
  );
}
