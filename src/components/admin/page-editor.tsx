import { AdminForm, SelectField, TextArea, TextInput } from "@/components/admin/admin-form";
import { BlockEditor } from "@/components/admin/block-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card } from "@/components/admin/ui";
import { savePage } from "@/actions/pages";
import { toDatetimeLocal } from "@/lib/content-helpers";
import { parseBlocks } from "@/lib/blocks/schema";
import { scoreSeo } from "@/lib/seo/score";
import { siteUrl } from "@/lib/env";
import type { Prisma } from "@/generated/prisma/client";
import { lockKey } from "@/lib/lock-keys";

type PageWithSeo = Prisma.PageGetPayload<{ include: { seo: true } }>;

export function PageEditor({ page }: { page: PageWithSeo | null }) {
  const blocks = parseBlocks(page?.blocks ?? []);
  const seo = page?.seo ?? null;
  const result = page
    ? scoreSeo({
        title: seo?.title,
        description: seo?.description,
        slug: page.slug,
        focusKeyword: seo?.focusKeyword,
        canonicalUrl: seo?.canonicalUrl,
        robotsIndex: seo?.robotsIndex,
        blocks,
        fallbackTitle: page.title,
        extraText: page.excerpt ?? "",
        imagesMissingAlt: blocks.filter((b) => b.type === "image" && !b.alt.trim()).length,
        published: page.status === "PUBLISHED",
      })
    : null;

  return (
    <AdminForm action={savePage} submitLabel={page ? "Save page" : "Create page"} lock={page ? [lockKey.page(page.id)] : undefined} cancelHref="/admin/pages">
      {page && <input type="hidden" name="id" value={page.id} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Content">
            <div className="space-y-4">
              <TextInput label="Title" name="title" defaultValue={page?.title} required maxLength={150} />
              <TextInput
                label="URL slug"
                name="slug"
                defaultValue={page?.slug}
                readOnly={page?.isSystem}
                hint={page?.isSystem ? "System pages keep their address." : "Leave empty to generate from the title. Changing the slug of a published page creates a 301 redirect automatically."}
              />
              <TextArea label="Excerpt" name="excerpt" defaultValue={page?.excerpt} rows={2} maxLength={500} hint="Shown under the page heading." />
              <div>
                <p className="mb-2 text-sm font-semibold text-forest-900">Page content</p>
                <BlockEditor defaultBlocks={blocks} />
              </div>
            </div>
          </Card>
          <Card title="SEO">
            <SeoPanel seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : null} checks={result?.checks} score={result?.score} previewUrl={`${siteUrl.replace(/^https?:\/\//, "")}/`} slugValue={page?.slug} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <SelectField label="Status" name="status" defaultValue={page?.status ?? "DRAFT"} options={[{ value: "DRAFT", label: "Draft (not public)" }, { value: "PUBLISHED", label: "Published" }]} />
              <TextInput label="Publish date (IST)" name="publishedAt" type="datetime-local" defaultValue={toDatetimeLocal(page?.publishedAt)} hint="Empty = publish immediately. A future date schedules the page." />
              <SelectField label="Template" name="template" defaultValue={page?.template ?? "DEFAULT"} options={[{ value: "DEFAULT", label: "Standard page" }, { value: "CONTACT", label: "Contact page (adds form + details)" }]} />
            </div>
          </Card>
          <Card title="Banner image">
            <MediaPicker name="featuredMediaId" label="Image" defaultId={page?.featuredMediaId} hint="Shown on the right of the page banner and as the social sharing fallback. Landscape, at least 1200×800. Empty = built-in photo." />
          </Card>
        </div>
      </div>
    </AdminForm>
  );
}
