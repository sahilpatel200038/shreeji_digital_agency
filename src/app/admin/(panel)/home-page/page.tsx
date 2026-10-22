import Link from "next/link";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/get";
import { getListingSeoRow, LISTING_PAGES } from "@/lib/seo/listing";
import { HOME_SECTION_FLAGS } from "@/lib/settings/forms";
import { siteUrl } from "@/lib/env";
import { AdminForm, CheckboxField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { saveHomePage } from "@/actions/site-content";

export const dynamic = "force-dynamic";

const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="t-h3 mt-6 mb-3 !text-lg">{children}</h3>;

export default async function HomePageEditor() {
  await requirePagePermission("settings:write");
  const [s, seo] = await Promise.all([getSettings(), getListingSeoRow("home")]);
  const { home } = s;
  const stats = [...home.stats, ...Array.from({ length: 4 })].slice(0, 4) as (typeof home.stats[number] | undefined)[];

  return (
    <>
      <PageHeader title="Edit: Homepage" description="Every section of the homepage in one place: text, buttons, picture, which sections appear, and SEO." actions={<LinkButton href="/" variant="outline">View live</LinkButton>} />
      <AdminForm action={saveHomePage} submitLabel="Save homepage">
        <input type="hidden" name="sectionsForm" value="1" />
        <div className="space-y-6">
          <Card title="Hero (top of the page)">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Eyebrow text" name="eyebrow" defaultValue={home.eyebrow} maxLength={80} />
              <TextInput label="Headline" name="headline" defaultValue={home.headline} maxLength={120} />
              <TextArea label="Sub-headline" name="subheadline" defaultValue={home.subheadline} rows={2} maxLength={300} className="md:col-span-2" />
              <TextInput label="Main button label" name="ctaPrimaryLabel" defaultValue={home.ctaPrimaryLabel} maxLength={40} hint="Empty hides the button." />
              <TextInput label="Main button link" name="ctaPrimaryHref" defaultValue={home.ctaPrimaryHref} maxLength={300} hint="/contact, #section or https://…" />
              <TextInput label="Second button label" name="ctaSecondaryLabel" defaultValue={home.ctaSecondaryLabel} maxLength={40} />
              <TextInput label="Second button link" name="ctaSecondaryHref" defaultValue={home.ctaSecondaryHref} maxLength={300} hint="#work scrolls to the projects section, so keep that section switched on." />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <MediaPicker name="heroMediaId" label="Hero picture" defaultId={s.banners.home} hint="Landscape, at least 1200×800. Empty = the built-in photo." />
              <TextInput label="Hero picture description (alt text)" name="heroImageAlt" defaultValue={home.heroImageAlt} maxLength={160} hint="Describes the picture for screen readers. Empty = the description saved with the picture, then a built-in one." />
            </div>
          </Card>

          <Card title="Sections shown on the page">
            <p className="mb-3 text-sm text-muted">Untick a section to hide it from the homepage. Sections with nothing to show (for example no published FAQs marked “show on home”) stay hidden either way.</p>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {HOME_SECTION_FLAGS.map(([key, label]) => (
                <CheckboxField key={key} label={label} name={key} defaultChecked={home[key]} />
              ))}
              <CheckboxField label="Statistics (only with figures you can substantiate)" name="showStats" defaultChecked={home.showStats} />
            </div>
          </Card>

          <Card title="About section">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Label" name="aboutEyebrow" defaultValue={home.aboutEyebrow} maxLength={60} />
              <TextInput label="Heading" name="aboutTitle" defaultValue={home.aboutTitle} maxLength={120} />
              <TextArea label="Text" name="aboutText" defaultValue={home.aboutText} rows={3} maxLength={400} className="md:col-span-2" />
              <TextArea label="Topic tags" name="aboutPills" defaultValue={home.aboutPills.join("\n")} rows={5} hint="One per line, up to 8." />
              <div className="space-y-4">
                <TextInput label="Button label" name="aboutButtonLabel" defaultValue={home.aboutButtonLabel} maxLength={40} hint="Empty hides the button." />
                <TextInput label="Button link" name="aboutButtonHref" defaultValue={home.aboutButtonHref} maxLength={300} />
              </div>
            </div>
            <H3>Why choose us (up to 4 cards)</H3>
            <div className="space-y-3">
              {Array.from({ length: 4 }, (_, i) => home.whyUs[i]).map((w, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-[1fr_2fr]">
                  <TextInput label={`Card ${i + 1} title`} name={`why_title_${i}`} defaultValue={w?.title} maxLength={80} />
                  <TextInput label={`Card ${i + 1} text`} name={`why_text_${i}`} defaultValue={w?.text} maxLength={300} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Core services">
            <p className="mb-3 text-sm text-muted">
              The cards come from the eight core services; edit those under <Link href="/admin/services" className="underline">Services</Link>.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Heading" name="servicesTitle" defaultValue={home.servicesTitle} maxLength={120} />
              <TextInput label="Intro" name="servicesText" defaultValue={home.servicesText} maxLength={300} />
              <TextInput label="Button label" name="servicesButtonLabel" defaultValue={home.servicesButtonLabel} maxLength={40} hint="Empty hides the “all services” button." />
            </div>
          </Card>

          <Card title="How we work (process)">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Label" name="processEyebrow" defaultValue={home.processEyebrow} maxLength={60} />
              <TextInput label="Heading" name="processTitle" defaultValue={home.processTitle} maxLength={160} />
            </div>
            <H3>Steps (up to 6)</H3>
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => home.process[i]).map((p, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-[1fr_2fr]">
                  <TextInput label={`Step ${i + 1} title`} name={`process_title_${i}`} defaultValue={p?.title} maxLength={80} />
                  <TextInput label={`Step ${i + 1} text`} name={`process_text_${i}`} defaultValue={p?.text} maxLength={300} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Statistics">
            <p className="mb-3 text-sm text-muted">Enter only figures you can substantiate with real data. Shown only when “Statistics” is ticked above.</p>
            <div className="space-y-3">
              {stats.map((st, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_120px_90px]">
                  <TextInput label={`Statistic ${i + 1} label`} name={`stat_label_${i}`} defaultValue={st?.label} maxLength={80} />
                  <TextInput label="Value" name={`stat_value_${i}`} type="number" min={0} defaultValue={st?.value} />
                  <TextInput label="Suffix" name={`stat_suffix_${i}`} defaultValue={st?.suffix} maxLength={8} placeholder="% or +" />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Testimonials">
            <p className="mb-3 text-sm text-muted">
              Only published, verified testimonials are shown. Manage them under <Link href="/admin/testimonials" className="underline">Testimonials</Link>.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Label" name="testimonialsEyebrow" defaultValue={home.testimonialsEyebrow} maxLength={60} />
              <TextInput label="Heading" name="testimonialsTitle" defaultValue={home.testimonialsTitle} maxLength={120} />
            </div>
          </Card>

          <Card title="Work videos (2 cards)">
            <p className="mb-3 text-sm text-muted">Paste an https:// YouTube or Vimeo link, or a direct .mp4/.webm file. Leave a link empty to show a “coming soon” card.</p>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Label" name="videosEyebrow" defaultValue={home.videosEyebrow} maxLength={60} />
              <TextInput label="Heading" name="videosTitle" defaultValue={home.videosTitle} maxLength={120} />
              <TextInput label="Intro" name="videosText" defaultValue={home.videosText} maxLength={300} />
            </div>
            <div className="mt-3 space-y-3">
              {Array.from({ length: 2 }, (_, i) => home.videos[i]).map((v, i) => (
                <div key={i} className="grid gap-3 md:grid-cols-3">
                  <TextInput label={`Video ${i + 1} title`} name={`video_title_${i}`} defaultValue={v?.title} maxLength={80} />
                  <TextInput label={`Video ${i + 1} description`} name={`video_text_${i}`} defaultValue={v?.text} maxLength={200} />
                  <TextInput label={`Video ${i + 1} link`} name={`video_url_${i}`} defaultValue={v?.url} maxLength={500} placeholder="https://www.youtube.com/watch?v=..." />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Projects">
            <p className="mb-3 text-sm text-muted">
              The cards come from <Link href="/admin/projects" className="underline">Projects</Link>.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Heading" name="workTitle" defaultValue={home.workTitle} maxLength={120} />
              <TextInput label="Intro" name="workText" defaultValue={home.workText} maxLength={300} />
            </div>
          </Card>

          <Card title="FAQ">
            <p className="mb-3 text-sm text-muted">
              Questions marked “show on home” under <Link href="/admin/faqs" className="underline">FAQs</Link> appear here.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput label="Label" name="faqEyebrow" defaultValue={home.faqEyebrow} maxLength={60} />
              <TextInput label="Heading" name="faqTitle" defaultValue={home.faqTitle} maxLength={120} />
              <TextInput label="Button label" name="faqButtonLabel" defaultValue={home.faqButtonLabel} maxLength={40} hint="Empty hides the “more questions” button." />
            </div>
          </Card>

          <Card title="SEO">
            <SeoPanel
              seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : { title: LISTING_PAGES.home.defaults.title || s.seo.defaultTitle, description: LISTING_PAGES.home.defaults.description || s.seo.defaultDescription }}
              previewUrl={siteUrl.replace(/^https?:\/\//, "")}
            />
          </Card>
        </div>
      </AdminForm>
    </>
  );
}
