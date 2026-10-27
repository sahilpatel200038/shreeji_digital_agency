import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import Link from "next/link";
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
      <PageHeader backHref="/admin/pages"
        title={`Edit: ${page.title}`}
        actions={
          <>
            <LinkButton href={`/admin/preview/pages/${page.id}`} variant="outline">Preview</LinkButton>
            {page.status === "PUBLISHED" && <LinkButton href={`/${page.slug}`} variant="outline">View live</LinkButton>}
          </>
        }
      />
      <Flash params={await searchParams} />
      {page.slug === "about" && (
        <p className="mb-5 rounded-[var(--radius-field)] border border-bronze-300 bg-bronze-100/50 p-3.5 text-sm text-forest-900">
          This edits the company profile text and banner. The <strong>team section</strong> is managed in <Link href="/admin/team" className="font-semibold underline">Team</Link> (members, photos, order, show/hide and its heading); the profile photo and work heading are in <Link href="/admin/settings" className="font-semibold underline">Settings, Page banners</Link>.
        </p>
      )}
      <PageEditor page={page} />
    </>
  );
}
