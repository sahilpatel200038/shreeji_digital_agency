import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { FaqEditor } from "@/components/admin/simple-editors";

export default async function NewFaq() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader backHref="/admin/faqs" title="New FAQ" />
      <FaqEditor f={null} />
    </>
  );
}
