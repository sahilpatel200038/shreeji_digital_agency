import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, PageHeader } from "@/components/admin/ui";
import { ProjectEditor } from "@/components/admin/simple-editors";

export const dynamic = "force-dynamic";

export default async function EditProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const project = Number(id) > 0 ? await db.project.findUnique({ where: { id: Number(id) } }) : null;
  if (!project) notFound();
  return (
    <>
      <PageHeader title={`Edit: ${project.name}`} />
      <Flash params={await searchParams} />
      <ProjectEditor project={project} />
    </>
  );
}
