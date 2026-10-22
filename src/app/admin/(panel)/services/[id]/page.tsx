import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, LinkButton, PageHeader } from "@/components/admin/ui";
import { ServiceEditor } from "@/components/admin/service-editor";

export const dynamic = "force-dynamic";

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const service = Number(id) > 0 ? await db.service.findUnique({ where: { id: Number(id) }, include: { seo: true, related: true } }) : null;
  if (!service) notFound();
  return (
    <>
      <PageHeader
        title={`Edit: ${service.title}`}
        actions={
          <>
            <LinkButton href={`/admin/preview/services/${service.id}`} variant="outline">Preview</LinkButton>
            {service.status === "PUBLISHED" && <LinkButton href={`/services/${service.slug}`} variant="outline">View live</LinkButton>}
          </>
        }
      />
      <Flash params={await searchParams} />
      <ServiceEditor service={service} />
    </>
  );
}
