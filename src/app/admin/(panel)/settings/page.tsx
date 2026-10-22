import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getSettings } from "@/lib/settings/get";
import { AdminForm, CheckboxField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { Card, PageHeader } from "@/components/admin/ui";
import { saveSettings } from "@/actions/settings";

export const dynamic = "force-dynamic";

function Group({ name, title, children, note }: { name: string; title: string; children: React.ReactNode; note?: string }) {
  return (
    <Card title={title}>
      {note && <p className="mb-4 text-sm text-muted">{note}</p>}
      <AdminForm action={saveSettings} submitLabel="Save">
        <input type="hidden" name="group" value={name} />
        {children}
      </AdminForm>
    </Card>
  );
}

export default async function SettingsPage() {
  const user = await requirePagePermission("settings:write");
  const s = await getSettings();
  const stats = [...s.home.stats, ...Array.from({ length: 4 })].slice(0, 4) as (typeof s.home.stats[number] | undefined)[];

  return (
    <>
      <PageHeader title="Settings" description="Site-wide details used in the header, footer, contact page, structured data and SEO defaults." />
      <div className="space-y-6">
        <Group name="general" title="General">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Site name" name="siteName" defaultValue={s.general.siteName} maxLength={80} />
            <TextInput label="Legal / business name" name="legalName" defaultValue={s.general.legalName} maxLength={120} />
            <TextInput label="Tagline" name="tagline" defaultValue={s.general.tagline} maxLength={120} />
            <TextInput label="Copyright text" name="copyright" defaultValue={s.general.copyright} maxLength={160} hint="The year is added automatically." />
            <TextArea label="Site description" name="description" defaultValue={s.general.description} rows={3} maxLength={300} className="md:col-span-2" />
            <TextArea label="Footer blurb" name="footerBlurb" defaultValue={s.general.footerBlurb} rows={2} maxLength={300} className="md:col-span-2" />
          </div>
        </Group>

        <Group name="contact" title="Contact details" note="Used on the contact page, footer and in LocalBusiness structured data. Keep it identical everywhere you are listed online.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Phone" name="phone" defaultValue={s.contact.phone} maxLength={40} />
            <TextInput label="Email" name="email" type="email" defaultValue={s.contact.email} maxLength={190} />
            <TextArea label="Address" name="address" defaultValue={s.contact.address} rows={2} maxLength={300} className="md:col-span-2" />
            <TextInput label="City / locality" name="locality" defaultValue={s.contact.locality} maxLength={80} />
            <TextInput label="State / region" name="region" defaultValue={s.contact.region} maxLength={80} />
            <TextInput label="Country code" name="country" defaultValue={s.contact.country} maxLength={2} hint="Two letters, e.g. IN" />
            <TextInput label="Google Maps link" name="mapsUrl" defaultValue={s.contact.mapsUrl} placeholder="https://maps.google.com/…" />
            <TextInput label="Opening hours (optional)" name="hours" defaultValue={s.contact.hours} maxLength={200} />
            <TextInput label="WhatsApp number" name="whatsapp" defaultValue={s.contact.whatsapp} maxLength={24} placeholder="+91 98765 43210" hint="Include the country code. Leave empty to use the Phone above for WhatsApp." />
            <TextInput label="WhatsApp default message" name="whatsappMessage" defaultValue={s.contact.whatsappMessage} maxLength={300} hint="Pre-filled in the visitor's chat." />
            <TextInput label="Contact section label" name="sectionEyebrow" defaultValue={s.contact.sectionEyebrow} maxLength={60} />
            <TextInput label="Enquiry form heading" name="formTitle" defaultValue={s.contact.formTitle} maxLength={80} />
            <TextArea label="Contact section intro" name="intro" defaultValue={s.contact.intro} rows={3} maxLength={400} className="md:col-span-2" />
          </div>
        </Group>

        <Group name="social" title="Social links" note="Full https:// URLs. Empty ones are hidden. Used in the footer and as sameAs in structured data.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Instagram" name="instagram" defaultValue={s.social.instagram} />
            <TextInput label="Facebook" name="facebook" defaultValue={s.social.facebook} />
            <TextInput label="LinkedIn" name="linkedin" defaultValue={s.social.linkedin} />
            <TextInput label="YouTube" name="youtube" defaultValue={s.social.youtube} />
            <TextInput label="X (Twitter)" name="x" defaultValue={s.social.x} />
          </div>
        </Group>

        <Group name="home" title="Homepage" note="Statistics are shown only when switched on. Enter only figures you can substantiate with real data.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Eyebrow text" name="eyebrow" defaultValue={s.home.eyebrow} maxLength={80} />
            <TextInput label="Headline" name="headline" defaultValue={s.home.headline} maxLength={120} />
            <TextArea label="Sub-headline" name="subheadline" defaultValue={s.home.subheadline} rows={2} maxLength={300} className="md:col-span-2" />
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">Hero buttons</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Main button label" name="ctaPrimaryLabel" defaultValue={s.home.ctaPrimaryLabel} maxLength={40} hint="Empty hides the button." />
            <TextInput label="Main button link" name="ctaPrimaryHref" defaultValue={s.home.ctaPrimaryHref} maxLength={300} hint="/contact, #section or https://…" />
            <TextInput label="Second button label" name="ctaSecondaryLabel" defaultValue={s.home.ctaSecondaryLabel} maxLength={40} />
            <TextInput label="Second button link" name="ctaSecondaryHref" defaultValue={s.home.ctaSecondaryHref} maxLength={300} />
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">Section headings</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="About label" name="aboutEyebrow" defaultValue={s.home.aboutEyebrow} maxLength={60} />
            <TextInput label="Services heading" name="servicesTitle" defaultValue={s.home.servicesTitle} maxLength={120} />
            <TextInput label="Services intro" name="servicesText" defaultValue={s.home.servicesText} maxLength={300} />
            <TextInput label="Testimonials heading" name="testimonialsTitle" defaultValue={s.home.testimonialsTitle} maxLength={120} />
            <TextInput label="Work heading" name="workTitle" defaultValue={s.home.workTitle} maxLength={120} />
            <TextInput label="Work intro" name="workText" defaultValue={s.home.workText} maxLength={300} />
            <TextInput label="FAQ heading" name="faqTitle" defaultValue={s.home.faqTitle} maxLength={120} />
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">About section</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="About heading" name="aboutTitle" defaultValue={s.home.aboutTitle} maxLength={120} />
            <TextArea label="About text" name="aboutText" defaultValue={s.home.aboutText} rows={3} maxLength={400} />
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">Why choose us (up to 4 cards)</h3>
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => s.home.whyUs[i]).map((w, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <TextInput label={`Card ${i + 1} title`} name={`why_title_${i}`} defaultValue={w?.title} maxLength={80} />
                <TextInput label={`Card ${i + 1} text`} name={`why_text_${i}`} defaultValue={w?.text} maxLength={300} />
              </div>
            ))}
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">Work videos (2 cards)</h3>
          <p className="mb-3 text-sm text-muted">Paste an https:// YouTube or Vimeo link, or a direct .mp4/.webm file. Leave a link empty to show a &quot;coming soon&quot; card.</p>
          <div className="grid gap-4 md:grid-cols-3">
            <TextInput label="Section label" name="videosEyebrow" defaultValue={s.home.videosEyebrow} maxLength={60} />
            <TextInput label="Section heading" name="videosTitle" defaultValue={s.home.videosTitle} maxLength={120} />
            <TextInput label="Section intro" name="videosText" defaultValue={s.home.videosText} maxLength={300} />
          </div>
          <div className="mt-3 space-y-3">
            {Array.from({ length: 2 }, (_, i) => s.home.videos[i]).map((v, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-3">
                <TextInput label={`Video ${i + 1} title`} name={`video_title_${i}`} defaultValue={v?.title} maxLength={80} />
                <TextInput label={`Video ${i + 1} description`} name={`video_text_${i}`} defaultValue={v?.text} maxLength={200} />
                <TextInput label={`Video ${i + 1} link`} name={`video_url_${i}`} defaultValue={v?.url} maxLength={500} placeholder="https://www.youtube.com/watch?v=..." />
              </div>
            ))}
          </div>
          <h3 className="t-h3 mt-6 mb-3 !text-lg">Process (up to 6 steps)</h3>
          <TextInput label="Process heading" name="processTitle" defaultValue={s.home.processTitle} maxLength={160} />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 6 }, (_, i) => s.home.process[i]).map((p, i) => (
              <div key={i} className="grid gap-3 md:grid-cols-[1fr_2fr]">
                <TextInput label={`Step ${i + 1} title`} name={`process_title_${i}`} defaultValue={p?.title} maxLength={80} />
                <TextInput label={`Step ${i + 1} text`} name={`process_text_${i}`} defaultValue={p?.text} maxLength={300} />
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <CheckboxField label="Show statistics section on the homepage" name="showStats" defaultChecked={s.home.showStats} />
            {stats.map((st, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-[1fr_120px_90px]">
                <TextInput label={`Statistic ${i + 1} label`} name={`stat_label_${i}`} defaultValue={st?.label} maxLength={80} />
                <TextInput label="Value" name={`stat_value_${i}`} type="number" min={0} defaultValue={st?.value} />
                <TextInput label="Suffix" name={`stat_suffix_${i}`} defaultValue={st?.suffix} maxLength={8} placeholder="% or +" />
              </div>
            ))}
          </div>
        </Group>

        <Group name="banners" title="Page banners" note="The heading, intro and picture of the Services, Blog and FAQ banners, plus the homepage picture (its text is under Homepage). Leave a picture empty to use the built-in photo. Other pages, services and blog posts use the title, summary and Image set on that item's own edit page.">
          <div className="grid gap-6 md:grid-cols-2">
            <TextInput label="Services page: heading" name="servicesTitle" defaultValue={s.banners.servicesTitle} maxLength={120} />
            <TextInput label="Services page: intro" name="servicesText" defaultValue={s.banners.servicesText} maxLength={300} />
            <TextInput label="Blog page: heading" name="blogTitle" defaultValue={s.banners.blogTitle} maxLength={120} />
            <TextInput label="Blog page: intro" name="blogText" defaultValue={s.banners.blogText} maxLength={300} />
            <TextInput label="FAQ page: heading" name="faqTitle" defaultValue={s.banners.faqTitle} maxLength={120} />
            <TextInput label="FAQ page: intro" name="faqText" defaultValue={s.banners.faqText} maxLength={300} />
            <MediaPicker name="home" label="Homepage picture" defaultId={s.banners.home} hint="Landscape, at least 1200×800." />
            <TextInput label="About page: banner label" name="aboutEyebrow" defaultValue={s.banners.aboutEyebrow} maxLength={60} />
            <TextInput label="About page: team label" name="teamEyebrow" defaultValue={s.banners.teamEyebrow} maxLength={60} />
            <TextInput label="About page: team heading" name="teamTitle" defaultValue={s.banners.teamTitle} maxLength={120} />
            <TextInput label="About page: work heading" name="aboutWorkTitle" defaultValue={s.banners.aboutWorkTitle} maxLength={120} />
            <TextInput label="About page: work intro" name="aboutWorkText" defaultValue={s.banners.aboutWorkText} maxLength={300} />
            <MediaPicker name="aboutProfile" label="About page: company profile picture" defaultId={s.banners.aboutProfile} hint="Shown beside the company profile text. Landscape, at least 1200×900." />
            <MediaPicker name="services" label="Services page picture" defaultId={s.banners.services} />
            <MediaPicker name="blog" label="Blog picture (also blog categories and posts without an image)" defaultId={s.banners.blog} />
            <MediaPicker name="faq" label="FAQ page picture" defaultId={s.banners.faq} />
          </div>
        </Group>

        <Group name="seo" title="Default SEO" note="Used when a page has no SEO title/description of its own.">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Title template" name="titleTemplate" defaultValue={s.seo.titleTemplate} maxLength={100} hint="Use %s where the page title goes." />
            <TextInput label="Default title" name="defaultTitle" defaultValue={s.seo.defaultTitle} maxLength={120} />
            <TextArea label="Default meta description" name="defaultDescription" defaultValue={s.seo.defaultDescription} rows={3} maxLength={300} className="md:col-span-2" />
          </div>
          <MediaPicker name="ogMediaId" label="Default social sharing image & logo for structured data" defaultId={s.seo.ogMediaId} />
        </Group>

        {can(user.role, "settings:scripts") ? (
          <Group name="analytics" title="Analytics & verification" note="Only these exact ID formats are accepted; arbitrary scripts cannot be injected. If a GTM ID is set, GA4 should be configured inside GTM instead.">
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Google Analytics 4 ID" name="ga4" defaultValue={s.analytics.ga4} placeholder="G-XXXXXXXXXX" />
              <TextInput label="Google Tag Manager ID" name="gtm" defaultValue={s.analytics.gtm} placeholder="GTM-XXXXXXX" />
              <TextInput label="Search Console verification token" name="gscToken" defaultValue={s.analytics.gscToken} hint="The content value from the verification meta tag." />
            </div>
          </Group>
        ) : (
          <Card title="Analytics & verification"><p className="text-muted">Only a Super Admin can change analytics and verification settings.</p></Card>
        )}
      </div>
    </>
  );
}
