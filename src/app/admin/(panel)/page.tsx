import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, Empty, LinkButton, PageHeader, StatusBadge } from "@/components/admin/ui";
import { formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

function Stat({ label, value, href, icon }: { label: string; value: number; href: string; icon: string }) {
  return (
    <Link href={href} className="group rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-bronze-300 hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted">{label}</span>
        <span className="grid size-9 place-items-center rounded-lg bg-forest-900 text-gold-300">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <p className="mt-3 font-display text-4xl font-extrabold text-forest-900">{value}</p>
    </Link>
  );
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const canLeads = can(user.role, "leads:read");
  const weekAgo = daysAgo(7);

  const [pubPages, draftPages, pubPosts, draftPosts, services, leadsNew, leadsWeek, leadsTotal, recentLeads, activity] = await Promise.all([
    db.page.count({ where: { status: "PUBLISHED" } }),
    db.page.count({ where: { status: "DRAFT" } }),
    db.post.count({ where: { status: "PUBLISHED" } }),
    db.post.count({ where: { status: "DRAFT" } }),
    db.service.count({ where: { status: "PUBLISHED" } }),
    canLeads ? db.lead.count({ where: { status: "NEW" } }) : 0,
    canLeads ? db.lead.count({ where: { createdAt: { gte: weekAgo } } }) : 0,
    canLeads ? db.lead.count() : 0,
    canLeads ? db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 5 }) : [],
    can(user.role, "audit:read") ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { name: true } } } }) : [],
  ]);

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="An overview of your website, based on live database records." />
      {denied && <p role="alert" className="mb-5 rounded-[var(--radius-field)] bg-[#fbeceb] p-3.5 font-medium text-danger">You do not have permission to open that section.</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Published pages" value={pubPages} href="/admin/pages" icon="file" />
        <Stat label="Draft pages" value={draftPages} href="/admin/pages?status=DRAFT" icon="edit" />
        <Stat label="Published posts" value={pubPosts} href="/admin/posts" icon="list" />
        <Stat label="Draft posts" value={draftPosts} href="/admin/posts?status=DRAFT" icon="edit" />
        <Stat label="Published services" value={services} href="/admin/services" icon="target" />
        {canLeads && (
          <>
            <Stat label="New leads" value={leadsNew} href="/admin/leads?status=NEW" icon="inbox" />
            <Stat label="Leads (last 7 days)" value={leadsWeek} href="/admin/leads" icon="users" />
            <Stat label="Total leads" value={leadsTotal} href="/admin/leads" icon="inbox" />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {canLeads && (
          <Card title="Recent inquiries">
            {recentLeads.length === 0 ? (
              <Empty>No inquiries yet. Submissions from the contact form will appear here.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentLeads.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/leads/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-forest-50">
                      <span>
                        <span className="block font-semibold">{l.firstName} {l.lastName}</span>
                        <span className="block text-sm text-muted">{l.service || "General enquiry"} · {formatDate(l.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                      </span>
                      <StatusBadge status={l.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <div className="space-y-6">
          <Card title="Quick actions">
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/admin/pages/new">New page</LinkButton>
              <LinkButton href="/admin/posts/new" variant="outline">New post</LinkButton>
              <LinkButton href="/admin/services/new" variant="outline">New service</LinkButton>
              <LinkButton href="/admin/media" variant="outline">Upload media</LinkButton>
              {canLeads && <LinkButton href="/admin/leads" variant="outline">View leads</LinkButton>}
            </div>
          </Card>
          {activity.length > 0 && (
            <Card title="Recent activity">
              <ul className="space-y-2.5 text-sm">
                {activity.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold">{a.user?.name ?? (a.userName || "System")}</span> <span className="text-muted">{a.action}</span>
                    {a.summary && <span> · {a.summary}</span>}
                    <span className="block text-xs text-muted">{formatDate(a.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
                  </li>
                ))}
              </ul>
              <Link href="/admin/activity-logs" className="mt-4 inline-block text-sm font-semibold text-bronze-700 underline underline-offset-4">View all activity</Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
