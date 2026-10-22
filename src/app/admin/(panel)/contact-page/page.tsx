import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/get";
import { siteUrl } from "@/lib/env";
import { AdminForm, CheckboxField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { saveContactPage } from "@/actions/site-content";

export const dynamic = "force-dynamic";

export default async function ContactPageEditor() {
  await requirePagePermission("settings:write");
  const [s, page] = await Promise.all([
    getSettings(),
    db.page.findFirst({ where: { template: "CONTACT" }, orderBy: [{ isSystem: "desc" }, { id: "asc" }], include: { seo: true } }),
  ]);
  const { contact } = s;
  const seo = page?.seo ?? null;

  return (
    <>
      <PageHeader title="Edit: Contact page" description="The Contact page banner, your contact details, the enquiry form wording and SEO. The enquiry form itself keeps working exactly as before." actions={<LinkButton href={page ? `/${page.slug}` : "/contact"} variant="outline">View live</LinkButton>} />
      {!page ? (
        <Card title="Contact page missing">
          <p className="text-muted">
            No page uses the Contact template. Create one under <Link href="/admin/pages/new" className="underline">Pages</Link> with the “Contact page” template, then return here.
          </p>
        </Card>
      ) : (
        <AdminForm action={saveContactPage} submitLabel="Save contact page">
          <input type="hidden" name="contactPageForm" value="1" />
          <div className="space-y-6">
            <Card title="Page banner">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Label above the heading" name="pageEyebrow" defaultValue={contact.pageEyebrow} maxLength={60} />
                <TextInput label="Heading (page title)" name="title" defaultValue={page.title} required maxLength={150} />
                <TextArea label="Intro under the heading" name="excerpt" defaultValue={page.excerpt} rows={2} maxLength={500} className="md:col-span-2" />
              </div>
              <div className="mt-5">
                <MediaPicker name="featuredMediaId" label="Banner picture" defaultId={page.featuredMediaId} hint="Landscape, at least 1200×800. Empty = the built-in photo." />
              </div>
            </Card>

            <Card title="Contact details">
              <p className="mb-4 text-sm text-muted">Shown in the enquiry section above the footer on every page, in the footer, and in LocalBusiness structured data. Keep them identical everywhere you are listed online.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Phone" name="phone" defaultValue={contact.phone} maxLength={40} />
                <TextInput label="Email" name="email" type="email" defaultValue={contact.email} maxLength={190} />
                <TextArea label="Address" name="address" defaultValue={contact.address} rows={2} maxLength={300} className="md:col-span-2" />
                <TextInput label="City / locality" name="locality" defaultValue={contact.locality} maxLength={80} />
                <TextInput label="State / region" name="region" defaultValue={contact.region} maxLength={80} />
                <TextInput label="Country code" name="country" defaultValue={contact.country} maxLength={2} hint="Two letters, e.g. IN" />
                <TextInput label="Google Maps link" name="mapsUrl" defaultValue={contact.mapsUrl} placeholder="https://maps.google.com/…" />
                <TextInput label="Opening hours (optional)" name="hours" defaultValue={contact.hours} maxLength={200} hint="Shown only when filled in." />
                <TextInput label="WhatsApp number" name="whatsapp" defaultValue={contact.whatsapp} maxLength={24} placeholder="+91 98765 43210" hint="Include the country code. Empty = no floating WhatsApp button." />
                <TextInput label="WhatsApp default message" name="whatsappMessage" defaultValue={contact.whatsappMessage} maxLength={300} />
              </div>
            </Card>

            <Card title="Enquiry section wording">
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput label="Section label" name="sectionEyebrow" defaultValue={contact.sectionEyebrow} maxLength={60} />
                <TextInput label="Enquiry form heading" name="formTitle" defaultValue={contact.formTitle} maxLength={80} />
                <TextArea label="Section intro" name="intro" defaultValue={contact.intro} rows={3} maxLength={400} className="md:col-span-2" />
                <TextInput label="Address label" name="visitLabel" defaultValue={contact.visitLabel} maxLength={40} />
                <TextInput label="Phone label" name="callLabel" defaultValue={contact.callLabel} maxLength={40} />
                <TextInput label="Email label" name="emailLabel" defaultValue={contact.emailLabel} maxLength={40} />
                <TextInput label="Map link text" name="mapsLabel" defaultValue={contact.mapsLabel} maxLength={60} />
              </div>
            </Card>

            <Card title="Services strip (under the banner section)">
              <CheckboxField label="Show the services strip on the Contact page" name="showServices" defaultChecked={contact.showServices} />
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <TextInput label="Heading" name="servicesTitle" defaultValue={contact.servicesTitle} maxLength={120} />
                <TextInput label="Intro" name="servicesText" defaultValue={contact.servicesText} maxLength={300} />
              </div>
            </Card>

            <Card title="SEO">
              <SeoPanel seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : null} previewUrl={`${siteUrl.replace(/^https?:\/\//, "")}/`} slugValue={page.slug} />
            </Card>
          </div>
        </AdminForm>
      )}
    </>
  );
}
