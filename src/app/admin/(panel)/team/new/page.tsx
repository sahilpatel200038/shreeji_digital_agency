import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { TeamEditor } from "@/components/admin/simple-editors";

export default async function NewTeamMember() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader title="New team member" />
      <TeamEditor member={null} />
    </>
  );
}
