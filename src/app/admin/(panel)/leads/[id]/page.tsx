import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AdminForm, TextArea } from "@/components/admin/admin-form";
import { Card, Flash, PageHeader, StatusBadge } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { addLeadNote, deleteLead, updateLeadStatus } from "@/actions/leads";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"] as const;
const when = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" } as const;

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requirePagePermission("leads:read");
  const { id } = await params;
  const lead = Number(id) > 0 ? await db.lead.findUnique({ where: { id: Number(id) }, include: { notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } } } }) : null;
  if (!lead) notFound();

  return (
    <>
      <PageHeader title={`${lead.firstName} ${lead.lastName}`} description={`Received ${formatDate(lead.createdAt, when)}`} actions={<StatusBadge status={lead.status} />} />
      <Flash params={await searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Enquiry">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Email</dt><dd><a href={`mailto:${lead.email}`} className="font-semibold text-bronze-700 hover:underline">{lead.email}</a></dd>
              <dt className="text-muted">Phone</dt><dd>{lead.phone ? <a href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`} className="font-semibold text-bronze-700 hover:underline">{lead.phone}</a> : "—"}</dd>
              <dt className="text-muted">Company</dt><dd>{lead.company || "—"}</dd>
              <dt className="text-muted">Service</dt><dd>{lead.service || "—"}</dd>
              <dt className="text-muted">Submitted from</dt><dd>{lead.source || "—"}</dd>
            </dl>
            {/* Rendered as plain text (React escapes it); whitespace preserved. */}
            <p className="mt-5 whitespace-pre-wrap rounded-lg bg-paper p-4">{lead.message}</p>
          </Card>
          <Card title="Internal notes">
            <AdminForm action={addLeadNote} submitLabel="Add note" className="space-y-3" inline>
              <input type="hidden" name="leadId" value={lead.id} />
              <TextArea label="Note" name="body" rows={3} maxLength={2000} />
            </AdminForm>
            <ul className="mt-5 space-y-3">
              {lead.notes.length === 0 && <li className="text-muted">No notes yet.</li>}
              {lead.notes.map((n) => (
                <li key={n.id} className="rounded-lg border border-line p-3">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{n.author?.name ?? "Former user"} · {formatDate(n.createdAt, when)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Status">
            <form action={updateLeadStatus} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="id" value={lead.id} />
              <label className="block flex-1">
                <span className="mb-1.5 block text-sm font-semibold">Lead status</span>
                <select name="status" defaultValue={lead.status} className="min-h-11 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-3.5">
                  {STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
                </select>
              </label>
              <button className="min-h-11 rounded-[var(--radius-field)] bg-forest-900 px-5 font-semibold text-white hover:bg-forest-800">Update</button>
            </form>
          </Card>
          <Card>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/leads" className="inline-flex min-h-11 items-center rounded-lg px-4 font-semibold hover:bg-forest-50">← All leads</Link>
              {can(user.role, "leads:delete") && <ConfirmButton action={deleteLead} fields={{ id: lead.id }} title="Delete this lead?" message="The lead and its notes will be permanently deleted." label="Delete lead" />}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
