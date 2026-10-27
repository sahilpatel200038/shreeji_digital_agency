import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Card, PageHeader, TableWrap, td, th } from "@/components/admin/ui";
import { ActionBadge, WHEN } from "@/components/admin/activity";
import { APP_TIMEZONE } from "@/lib/audit-query";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v === "" ? "(empty)" : v;
  return JSON.stringify(v);
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export default async function ActivityDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("audit:read");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  const log = await db.auditLog.findUnique({ where: { id: n } });
  if (!log) notFound();
  const related = log.requestId
    ? await db.auditLog.findMany({ where: { requestId: log.requestId, NOT: { id: log.id } }, orderBy: { id: "asc" }, take: 20 })
    : [];

  // Return to the list with the same filters.
  const back = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]);
  const before = asRecord(log.oldValues);
  const after = asRecord(log.newValues);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  const rows: [string, React.ReactNode][] = [
    ["Log ID", log.id],
    ["Date & time", `${formatDate(log.createdAt, WHEN)} (${APP_TIMEZONE})`],
    ["UTC timestamp", log.createdAt.toISOString()],
    ["User", log.userName ? `${log.userName}${log.userId ? ` (ID ${log.userId})` : " (account removed)"}` : "System / unknown"],
    ["Action type", <ActionBadge key="t" type={log.actionType} />],
    ["Action", <code key="a" className="rounded bg-forest-50 px-1.5 py-0.5 text-sm">{log.action}</code>],
    ["Module", log.module || "—"],
    ["Description", log.summary || "—"],
    ["Affected record", log.entityType ? `${log.entityName || "(unnamed)"}${log.entityId ? ` — ID ${log.entityId}` : ""}` : "—"],
    ["Request ID", log.requestId ? <code key="r" className="text-sm">{log.requestId}</code> : "—"],
    ["Client (hashed)", log.ipHash ? <code key="i" className="text-sm">{log.ipHash.slice(0, 16)}…</code> : "—"],
  ];

  return (
    <>
      <PageHeader backHref={`/admin/activity-logs${back.toString() ? `?${back}` : ""}`} backLabel="Back to Activity Logs" title={`Activity #${log.id}`} description={log.summary || undefined} />
      <Card>
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="text-sm font-semibold text-muted">{k}</dt>
              <dd className="min-w-0 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <h2 className="t-h3 mt-8 mb-3">Changes</h2>
      {keys.length === 0 ? (
        <p className="text-muted">No field-level changes were recorded for this action.</p>
      ) : (
        <TableWrap>
          <table className="w-full min-w-[560px]">
            <thead>
              <tr><th className={th}>Field</th><th className={th}>Previous value</th><th className={th}>New value</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k}>
                  <td className={`${td} font-semibold`}>{k}</td>
                  <td className={`${td} break-words text-muted`}>{show(before[k])}</td>
                  <td className={`${td} break-words`}>{show(after[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <p className="mt-2 text-xs text-muted">Passwords, tokens and secrets are never stored in the log; long text is shortened.</p>

      {related.length > 0 && (
        <>
          <h2 className="t-h3 mt-8 mb-3">Other activity in the same request</h2>
          <ul className="space-y-1">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/activity-logs/${r.id}`} className="text-bronze-700 underline underline-offset-4">#{r.id}</Link> · {r.action} · {r.summary}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
