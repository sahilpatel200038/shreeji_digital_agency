import { redirect } from "next/navigation";

/** The audit log was renamed Activity Logs; keep old links and bookmarks working. */
export default async function LegacyAuditLogRedirect({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string" && v) as [string, string][]).toString();
  redirect(`/admin/activity-logs${qs ? `?${qs}` : ""}`);
}
