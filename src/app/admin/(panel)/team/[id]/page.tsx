import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, PageHeader } from "@/components/admin/ui";
import { TeamEditor } from "@/components/admin/simple-editors";

export const dynamic = "force-dynamic";

export default async function EditTeamMember({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const member = Number(id) > 0 ? await db.teamMember.findUnique({ where: { id: Number(id) } }) : null;
  if (!member) notFound();
  return (
    <>
      <PageHeader title={`Edit: ${member.name}`} />
      <Flash params={await searchParams} />
      <TeamEditor member={member} />
    </>
  );
}
