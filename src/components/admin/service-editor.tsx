import { AdminForm, CheckboxField, CheckboxGroup, SelectField, TextArea, TextInput } from "@/components/admin/admin-form";
import { BlockEditor } from "@/components/admin/block-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card } from "@/components/admin/ui";
import { saveService } from "@/actions/services";
import { toDatetimeLocal } from "@/lib/content-helpers";
import { parseBlocks } from "@/lib/blocks/schema";
import { readServicePageOptions, SERVICE_SECTION_FLAGS } from "@/lib/service-page";
import { scoreSeo } from "@/lib/seo/score";
import { siteUrl } from "@/lib/env";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

type ServiceFull = Prisma.ServiceGetPayload<{ include: { seo: true; related: true } }>;

const ICONS = ["target", "megaphone", "layout", "camera", "users", "chart", "funnel", "search", "code", "server", "pen", "sparkles"];

const pairs = (v: unknown, a: string, b: string) =>
  ((v as Record<string, string>[] | null) ?? []).map((x) => `${x[a]} | ${x[b]}`).join("\n");

export async function ServiceEditor({ service }: { service: ServiceFull | null }) {
  const [categories, others, count, faqRows] = await Promise.all([
    db.serviceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, title: true } }),
    db.service.count(),
    service ? db.faq.findMany({ where: { serviceId: service.id }, orderBy: { sortOrder: "asc" } }) : [],
  ]);
  const po = readServicePageOptions(service?.pageOptions);
  const blocks = parseBlocks(service?.blocks ?? []);
  const seo = service?.seo ?? null;
  const relatedIds = new Set(service?.related.map((r) => r.relatedId) ?? []);
  const result = service
    ? scoreSeo({
        title: seo?.title,
        description: seo?.description,
        slug: service.slug,
        focusKeyword: seo?.focusKeyword,
        canonicalUrl: seo?.canonicalUrl,
        robotsIndex: seo?.robotsIndex,
        blocks,
        fallbackTitle: service.title,
        extraText: `${service.intro ?? ""}\n${service.summary}\n${((service.included as string[] | null) ?? []).join("\n")}\n${pairs(service.benefits, "title", "text")}\n${pairs(service.process, "title", "text")}`,
        imagesMissingAlt: blocks.filter((b) => b.type === "image" && !b.alt.trim()).length,
        published: service.status === "PUBLISHED",
      })
    : null;

  return (
    <AdminForm action={saveService} submitLabel={service ? "Save service" : "Create service"}>
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Overview">
            <div className="space-y-4">
              <TextInput label="Title" name="title" defaultValue={service?.title} required maxLength={150} />
              <TextInput label="URL slug" name="slug" defaultValue={service?.slug} hint="Address will be /services/your-slug. Changing it on a published service creates a 301 redirect." />
              <TextArea label="Summary (card text and fallback description)" name="summary" defaultValue={service?.summary} rows={2} required maxLength={500} />
              <TextInput label="Hero heading" name="heroHeading" defaultValue={service?.heroHeading} maxLength={255} hint="The page's main H1. Falls back to the title." />
              <TextArea label="Introduction" name="intro" defaultValue={service?.intro} rows={4} maxLength={5000} />
            </div>
          </Card>
          <Card title="Details">
            <div className="space-y-4">
              <TextArea label="Benefits" name="benefits" defaultValue={pairs(service?.benefits, "title", "text")} rows={5} hint="One per line, formatted: Title | Description" />
              <TextArea label="What is included" name="included" defaultValue={((service?.included as string[] | null) ?? []).join("\n")} rows={5} hint="One item per line." />
              <TextArea label="Process steps" name="process" defaultValue={pairs(service?.process, "title", "text")} rows={5} hint="One per line, formatted: Step title | Description" />
              <TextArea label="FAQs about this service" name="faqs" defaultValue={faqRows.map((f) => `${f.question} | ${f.answer}`).join("\n")} rows={5} hint="One per line, formatted: Question | Answer. Shown on this service's page (and as FAQ structured data). Site-wide FAQs are under FAQs." />

              <div>
                <p className="mb-2 text-sm font-semibold text-forest-900">Additional content (optional)</p>
                <BlockEditor defaultBlocks={blocks} />
              </div>
            </div>
          </Card>
          <Card title="Page sections & wording">
            <p className="mb-4 text-sm text-muted">Headings, buttons and which sections appear on this service&apos;s page. Defaults are the standard wording; a section with no content is never shown.</p>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Main button label" name="po_primaryLabel" defaultValue={po.primaryLabel} maxLength={40} hint="Empty hides the button." />
                <TextInput label="Main button link" name="po_primaryHref" defaultValue={po.primaryHref} maxLength={300} hint="/contact, #section or https://…" />
                <TextInput label="Second button label" name="po_secondaryLabel" defaultValue={po.secondaryLabel} maxLength={40} />
                <TextInput label="Second button link" name="po_secondaryHref" defaultValue={po.secondaryHref} maxLength={300} />
                <TextInput label="Introduction heading" name="po_introTitle" defaultValue={po.introTitle} maxLength={120} hint="Empty = “About” + the service title." />
                <TextInput label="Gains section label" name="po_benefitsEyebrow" defaultValue={po.benefitsEyebrow} maxLength={60} />
                <TextInput label="Gains section heading" name="po_benefitsTitle" defaultValue={po.benefitsTitle} maxLength={120} />
                <TextInput label="Included label" name="po_includedEyebrow" defaultValue={po.includedEyebrow} maxLength={60} />
                <TextInput label="Included heading" name="po_includedTitle" defaultValue={po.includedTitle} maxLength={120} />
                <TextInput label="Included intro" name="po_includedText" defaultValue={po.includedText} maxLength={300} />
                <TextInput label="Process label" name="po_processEyebrow" defaultValue={po.processEyebrow} maxLength={60} />
                <TextInput label="Process heading" name="po_processTitle" defaultValue={po.processTitle} maxLength={120} />
                <TextInput label="FAQ label" name="po_faqEyebrow" defaultValue={po.faqEyebrow} maxLength={60} />
                <TextInput label="FAQ heading" name="po_faqTitle" defaultValue={po.faqTitle} maxLength={120} />
                <TextInput label="Projects list label" name="po_projectsEyebrow" defaultValue={po.projectsEyebrow} maxLength={60} />
                <TextInput label="Projects list heading" name="po_projectsTitle" defaultValue={po.projectsTitle} maxLength={120} />
                <TextInput label="Services slider label" name="po_relatedEyebrow" defaultValue={po.relatedEyebrow} maxLength={60} />
                <TextInput label="Services slider heading" name="po_relatedTitle" defaultValue={po.relatedTitle} maxLength={120} />
              </div>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-forest-900">Show these sections</legend>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  {SERVICE_SECTION_FLAGS.map(([key, label]) => (
                    <CheckboxField key={key} label={label} name={`po_${key}`} defaultChecked={po[key]} />
                  ))}
                </div>
              </fieldset>
            </div>
          </Card>
          <Card title="SEO">
            <SeoPanel seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : null} checks={result?.checks} score={result?.score} previewUrl={`${siteUrl.replace(/^https?:\/\//, "")}/services/`} slugValue={service?.slug} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Publishing">
            <div className="space-y-4">
              <SelectField label="Status" name="status" defaultValue={service?.status ?? "DRAFT"} options={[{ value: "DRAFT", label: "Draft (not public)" }, { value: "PUBLISHED", label: "Published" }]} />
              <TextInput label="Publish date (IST)" name="publishedAt" type="datetime-local" defaultValue={toDatetimeLocal(service?.publishedAt)} />
              <TextInput label="Display order" name="sortOrder" type="number" min={0} max={9999} defaultValue={service?.sortOrder ?? count + 1} hint="Lower numbers appear first." />
            </div>
          </Card>
          <Card title="Organise">
            <div className="space-y-4">
              <SelectField label="Category" name="categoryId" required defaultValue={service?.categoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
              <SelectField label="Icon" name="icon" defaultValue={service?.icon ?? "sparkles"} options={ICONS.map((i) => ({ value: i, label: i }))} />
              <CheckboxGroup label="Related services" name="related" hint="Shown at the bottom of this service's page." options={others.filter((o) => o.id !== service?.id).map((o) => ({ value: o.id, label: o.title }))} defaultValues={[...relatedIds]} />
            </div>
          </Card>
          <Card title="Banner image">
            <MediaPicker name="featuredMediaId" label="Image" defaultId={service?.featuredMediaId} hint="Shown on the right of the service banner and on service cards. Landscape, at least 1200×800." />
          </Card>
        </div>
      </div>
    </AdminForm>
  );
}
