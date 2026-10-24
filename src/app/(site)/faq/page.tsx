import type { Metadata } from "next";
import { listingSeo } from "@/lib/seo/listing";
import { buildMetadata } from "@/lib/seo/metadata";
import { getBannerMedia, getFaqs } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { faqSchema } from "@/lib/seo/schema";
import { ServicesSliderSection } from "@/components/site/slider-sections";
import { PageHero } from "@/components/ui/breadcrumbs";
import { Section } from "@/components/ui/layout";
import { JsonLd } from "@/components/ui/json-ld";
import { EmptyState } from "@/components/ui/skeleton";
import { FaqAccordion } from "@/components/ui/faq-accordion";
import { Reveal } from "@/components/motion/reveal";
import { CtaBand } from "@/components/site/cta-band";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    seo: await listingSeo("faq"),
    fallbackTitle: "FAQ",
    path: "/faq",
  });
}

export default async function FaqPage() {
  const [faqs, settings] = await Promise.all([getFaqs(), getSettings()]);
  const banner = await getBannerMedia(settings.banners.faq);
  const categories = [...new Set(faqs.map((f) => f.category))];
  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer })))} />}
      <PageHero eyebrow={settings.banners.faqEyebrow} title={settings.banners.faqTitle} intro={settings.banners.faqText} image={resolveBanner("faq", banner)} />
      <Section>
        <div className="space-y-12">
          {faqs.length === 0 && <EmptyState title="No questions yet" text="Contact us and we will be happy to help." />}
          {categories.map((c) => (
            <Reveal key={c}>
              <h2 className="t-h3 mb-4">{c}</h2>
              <FaqAccordion items={faqs.filter((f) => f.category === c).map((f) => ({ question: f.question, answer: f.answer }))} />
            </Reveal>
          ))}
        </div>
      </Section>
      <CtaBand title={settings.banners.faqCtaTitle} text={settings.banners.faqCtaText} label={settings.banners.faqCtaLabel} />
      <ServicesSliderSection id="services-slider" title={settings.banners.faqServicesTitle} />
    </>
  );
}
