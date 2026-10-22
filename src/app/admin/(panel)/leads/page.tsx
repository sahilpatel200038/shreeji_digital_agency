import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, FilterBar, Flash, PageHeader, Pager, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"] as const;

export default async function LeadsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string; msg?: string; err?: string }> }) {
  const user = await requirePagePermission("leads:read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as (typeof STATUSES)[number]) : undefined;
  const q = sp.q?.trim().slice(0, 80);
  const where = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { company: { contains: q } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.lead.count({ where }),
  ]);
  const base = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}) });
  const exportHref = `/admin/leads/export?${base.toString()}`;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Enquiries submitted through the website forms. Private: never exposed publicly."
        actions={can(user.role, "leads:export") ? <a href={exportHref} className="inline-flex min-h-11 items-center rounded-[var(--radius-field)] border-2 border-forest-900 px-5 font-semibold text-forest-900 hover:bg-forest-900 hover:text-white">Export CSV</a> : undefined}
      />
      <Flash params={sp} />
      <FilterBar q={q} placeholder="Search name, email, phone or company" filters={[{ name: "status", label: "All statuses", value: status, options: STATUSES.map((s) => ({ value: s, label: s[0] + s.slice(1).toLowerCase() })) }]} />
      <TableWrap>
        <table className="w-full min-w-[820px]">
          <thead><tr><th className={th}>Name</th><th className={th}>Contact</th><th className={th}>Service</th><th className={th}>Status</th><th className={th}>Received</th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((l) => (
              <tr key={l.id} className="hover:bg-forest-50/50">
                <td className={td}>
                  <Link href={`/admin/leads/${l.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{l.firstName} {l.lastName}</Link>
                  {l.company && <span className="block text-sm text-muted">{l.company}</span>}
                </td>
                <td className={td}><span className="block">{l.email}</span><span className="block text-sm text-muted">{l.phone}</span></td>
                <td className={`${td} text-muted`}>{l.service || "—"}</td>
                <td className={td}><StatusBadge status={l.status} /></td>
                <td className={`${td} text-muted`}>{formatDate(l.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>{q || status ? "No leads match these filters." : "No leads yet. Contact form submissions will appear here."}</Empty>}
      </TableWrap>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} base={base} />
    </>
  );
}
