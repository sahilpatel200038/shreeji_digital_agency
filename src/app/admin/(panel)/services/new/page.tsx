import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { ServiceEditor } from "@/components/admin/service-editor";

export default async function NewService() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader title="New service" />
      <ServiceEditor service={null} />
    </>
  );
}
