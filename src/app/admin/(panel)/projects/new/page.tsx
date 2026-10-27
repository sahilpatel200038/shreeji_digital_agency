import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { ProjectEditor } from "@/components/admin/simple-editors";

export default async function NewProject() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader backHref="/admin/projects" title="New project" />
      <ProjectEditor project={null} />
    </>
  );
}
