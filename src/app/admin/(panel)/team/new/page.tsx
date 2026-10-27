import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { TeamEditor } from "@/components/admin/simple-editors";

export default async function NewTeamMember() {
  await requirePagePermission("content:write");
  const last = await db.teamMember.aggregate({ _max: { sortOrder: true } });
  return (
    <>
      <PageHeader backHref="/admin/team" title="New team member" />
      <TeamEditor member={null} nextOrder={(last._max.sortOrder ?? 0) + 1} />
    </>
  );
}
