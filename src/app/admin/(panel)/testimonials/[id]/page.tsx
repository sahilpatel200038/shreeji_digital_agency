import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, PageHeader } from "@/components/admin/ui";
import { TestimonialEditor } from "@/components/admin/simple-editors";

export const dynamic = "force-dynamic";

export default async function EditTestimonial({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const t = Number(id) > 0 ? await db.testimonial.findUnique({ where: { id: Number(id) } }) : null;
  if (!t) notFound();
  return (
    <>
      <PageHeader title={`Edit: ${t.name}`} />
      <Flash params={await searchParams} />
      <TestimonialEditor t={t} />
    </>
  );
}
