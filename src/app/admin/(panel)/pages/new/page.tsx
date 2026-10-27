import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { PageEditor } from "@/components/admin/page-editor";

export default async function NewPage() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader backHref="/admin/pages" title="New page" />
      <PageEditor page={null} />
    </>
  );
}
