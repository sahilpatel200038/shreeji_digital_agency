import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Empty, LinkButton, PageHeader, Pager, TableWrap, td, th } from "@/components/admin/ui";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { ACTION_LABELS, ACTION_TYPES, MODULE_NAMES } from "@/lib/audit-format";
import { ActionBadge, WHEN } from "@/components/admin/activity";
import { APP_TIMEZONE, LOG_PAGE_SIZE, parseLogFilters, type LogFilters } from "@/lib/audit-query";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const field = "min-h-11 rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-3.5 text-[15px] focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40";

export default async function ActivityLogsPage({ searchParams }: { searchParams: Promise<LogFilters> }) {
  await requirePagePermission("audit:read");
  const f = parseLogFilters(await searchParams);
  const [items, total, users] = await Promise.all([
    db.auditLog.findMany({ where: f.where, orderBy: f.orderBy, skip: (f.page - 1) * LOG_PAGE_SIZE, take: LOG_PAGE_SIZE }),
    db.auditLog.count({ where: f.where }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const base = new URLSearchParams(Object.entries(f.clean).filter(([, v]) => v) as [string, string][]);
  const qs = base.toString();
  const hasFilters = qs.length > 0;
  const pages = Math.max(1, Math.ceil(total / LOG_PAGE_SIZE));
  const detailQs = (id: number) => `/admin/activity-logs/${id}${qs ? `?${qs}${f.page > 1 ? `&page=${f.page}` : ""}` : f.page > 1 ? `?page=${f.page}` : ""}`;

  return (
    <>
      <PageHeader
        title="Activity Logs"
        description={`A read-only record of sign-ins and changes made in the admin panel. Times are shown in ${APP_TIMEZONE}.`}
        actions={<LinkButton href={`/admin/activity-logs${qs ? `?${qs}` : ""}`} variant="outline">Refresh</LinkButton>}
      />
      <AutoFilterForm className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" label="Filter activity logs">
        <label className="sm:col-span-2 lg:col-span-4">
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={f.clean.q} placeholder="Search by user, action, module or description" className={cn(field, "w-full")} />
        </label>
        <label>
          <span className="sr-only">Action type</span>
          <select name="actionType" defaultValue={f.clean.actionType ?? ""} className={cn(field, "w-full")}>
            <option value="">All actions</option>
            {ACTION_TYPES.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Module</span>
          <select name="module" defaultValue={f.clean.module ?? ""} className={cn(field, "w-full")}>
            <option value="">All modules</option>
            {MODULE_NAMES.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">User</span>
          <select name="userId" defaultValue={f.clean.userId ?? ""} className={cn(field, "w-full")}>
            <option value="">All users</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Sort order</span>
          <select name="sort" defaultValue={f.sort} className={cn(field, "w-full")}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          From
          <input type="date" name="from" defaultValue={f.clean.from} className={cn(field, "min-w-0 flex-1")} />
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          To
          <input type="date" name="to" defaultValue={f.clean.to} className={cn(field, "min-w-0 flex-1")} />
        </label>
        {hasFilters && (
          <Link href="/admin/activity-logs" className="inline-flex min-h-11 items-center text-sm font-semibold text-bronze-700 underline underline-offset-4">
            Clear filters
          </Link>
        )}
      </AutoFilterForm>

      <p className="mb-3 text-sm text-muted" aria-live="polite">{total === 0 ? "No matching activity" : `${total} ${total === 1 ? "entry" : "entries"}`}</p>
      <TableWrap>
        <table className="w-full min-w-[860px]">
          <thead>
            <tr>
              <th className={th}>Date &amp; time</th>
              <th className={th}>User</th>
              <th className={th}>Action</th>
              <th className={th}>Module</th>
              <th className={th}>Description</th>
              <th className={th}><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((a) => (
              <tr key={a.id}>
                <td className={`${td} whitespace-nowrap text-muted`}>{formatDate(a.createdAt, WHEN)}</td>
                <td className={td}>{a.userName || <span className="text-muted">System / unknown</span>}</td>
                <td className={td}><ActionBadge type={a.actionType} /></td>
                <td className={td}>{a.module || "—"}</td>
                <td className={`${td} text-muted`}>
                  {a.summary}
                  {a.entityId && <span className="block text-xs">ID {a.entityId}</span>}
                </td>
                <td className={td}>
                  <Link href={detailQs(a.id)} className="font-semibold text-bronze-700 underline underline-offset-4" aria-label={`View details of activity ${a.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>{hasFilters ? "No activity matches these filters." : "No activity has been recorded yet."}</Empty>}
      </TableWrap>
      <Pager page={Math.min(f.page, pages)} pages={pages} base={base} />
    </>
  );
}
