import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteFaq } from "@/actions/content";

export const dynamic = "force-dynamic";

export default async function FaqsList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await db.faq.findMany({ where: { serviceId: null }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <>
      <PageHeader title="FAQs" description="Site-wide questions. Service-specific FAQs are edited inside each service." actions={<LinkButton href="/admin/faqs/new">Add FAQ</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[680px]">
          <thead><tr><th className={th}>Question</th><th className={th}>Group</th><th className={th}>Home</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((f) => (
              <tr key={f.id}>
                <td className={td}><Link href={`/admin/faqs/${f.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{f.question}</Link></td>
                <td className={`${td} text-muted`}>{f.category}</td>
                <td className={td}>{f.showOnHome ? "Yes" : "—"}</td>
                <td className={td}><StatusBadge status={f.status} /></td>
                <td className={`${td} text-right`}>
                  <Link href={`/admin/faqs/${f.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                  {can(user.role, "content:delete") && <ConfirmButton small action={deleteFaq} fields={{ id: f.id }} title="Delete this FAQ?" message="This question will be permanently deleted." label="Delete" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No FAQs yet.</Empty>}
      </TableWrap>
    </>
  );
}
