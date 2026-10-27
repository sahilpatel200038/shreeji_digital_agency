import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, PageHeader } from "@/components/admin/ui";
import { FaqEditor } from "@/components/admin/simple-editors";

export const dynamic = "force-dynamic";

export default async function EditFaq({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const f = Number(id) > 0 ? await db.faq.findUnique({ where: { id: Number(id) } }) : null;
  if (!f || f.serviceId) notFound();
  return (
    <>
      <PageHeader backHref="/admin/faqs" title="Edit FAQ" />
      <Flash params={await searchParams} />
      <FaqEditor f={f} />
    </>
  );
}
