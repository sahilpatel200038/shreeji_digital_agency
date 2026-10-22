import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminForm } from "@/components/admin/admin-form";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { saveListingSeo } from "@/actions/listing-seo";
import { getListingSeoRow, isListingKey, LISTING_PAGES } from "@/lib/seo/listing";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function EditSitePage({ params }: { params: Promise<{ key: string }> }) {
  await requirePagePermission("content:write");
  const { key } = await params;
  if (!isListingKey(key)) notFound();
  const page = LISTING_PAGES[key];
  const seo = await getListingSeoRow(key);
  return (
    <>
      <PageHeader
        title={`Edit: ${page.label} page`}
        actions={<LinkButton href={page.path} variant="outline">View live</LinkButton>}
      />
      <p className="mb-4 text-sm text-muted">
        <Link href="/admin/site-pages" className="underline">All site pages</Link>. Empty fields use the built-in wording. The page text and pictures are edited in{" "}
        <Link href="/admin/settings" className="underline">Settings</Link>.
      </p>
      <AdminForm action={saveListingSeo} submitLabel="Save SEO">
        <input type="hidden" name="key" value={key} />
        <Card title="SEO">
          <SeoPanel
            seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : { title: page.defaults.title, description: page.defaults.description }}
            previewUrl={`${siteUrl.replace(/^https?:\/\//, "")}${page.path === "/" ? "" : page.path}`}
          />
        </Card>
      </AdminForm>
    </>
  );
}
