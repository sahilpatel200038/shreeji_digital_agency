import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!can(user.role, "leads:export")) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim().slice(0, 80);
  const valid = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"];
  const leads = await db.lead.findMany({
    where: {
      ...(status && valid.includes(status) ? { status: status as "NEW" } : {}),
      ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { company: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  await audit(user.id, "lead.export", "lead", "", `Exported ${leads.length} lead(s)`);

  const csv = toCsv(
    ["ID", "Received (UTC)", "First name", "Last name", "Email", "Phone", "Company", "Service", "Status", "Source", "Message"],
    leads.map((l) => [l.id, l.createdAt, l.firstName, l.lastName, l.email, l.phone, l.company, l.service, l.status, l.source, l.message]),
  );
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
