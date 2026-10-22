import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, LinkButton, PageHeader } from "@/components/admin/ui";
import { PageEditor } from "@/components/admin/page-editor";

export const dynamic = "force-dynamic";

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const page = Number(id) > 0 ? await db.page.findUnique({ where: { id: Number(id) }, include: { seo: true } }) : null;
  if (!page) notFound();
  return (
    <>
      <PageHeader
        title={`Edit: ${page.title}`}
        actions={
          <>
            <LinkButton href={`/admin/preview/pages/${page.id}`} variant="outline">Preview</LinkButton>
            {page.status === "PUBLISHED" && <LinkButton href={`/${page.slug}`} variant="outline">View live</LinkButton>}
          </>
        }
      />
      <Flash params={await searchParams} />
      <PageEditor page={page} />
    </>
  );
}
