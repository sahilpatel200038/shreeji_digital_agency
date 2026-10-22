import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, Flash, LinkButton, PageHeader, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteTestimonial } from "@/actions/content";

export const dynamic = "force-dynamic";

export default async function TestimonialsList({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const items = await db.testimonial.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return (
    <>
      <PageHeader title="Testimonials" description="Only testimonials that are both Published and Verified appear on the website." actions={<LinkButton href="/admin/testimonials/new">Add testimonial</LinkButton>} />
      <Flash params={sp} />
      <TableWrap>
        <table className="w-full min-w-[680px]">
          <thead><tr><th className={th}>Name</th><th className={th}>Quote</th><th className={th}>Status</th><th className={th}>Verified</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((t) => (
              <tr key={t.id}>
                <td className={td}><Link href={`/admin/testimonials/${t.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{t.name}</Link><span className="block text-sm text-muted">{t.location}</span></td>
                <td className={`${td} max-w-sm text-muted`}><span className="line-clamp-2">{t.quote}</span></td>
                <td className={td}><StatusBadge status={t.status} /></td>
                <td className={td}>{t.isVerified ? "Yes" : <span className="text-bronze-700">Not verified</span>}</td>
                <td className={`${td} text-right`}>
                  <Link href={`/admin/testimonials/${t.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                  {can(user.role, "content:delete") && <ConfirmButton small action={deleteTestimonial} fields={{ id: t.id }} title="Delete this testimonial?" message={`The testimonial from ${t.name} will be permanently deleted.`} label="Delete" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No testimonials yet.</Empty>}
      </TableWrap>
    </>
  );
}
