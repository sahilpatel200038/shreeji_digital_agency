import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getProjects, getServiceBySlug } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { faqSchema, serviceSchema } from "@/lib/seo/schema";
import { PageHero } from "@/components/ui/breadcrumbs";
import { Section, SectionHeading } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { JsonLd } from "@/components/ui/json-ld";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { FaqAccordion } from "@/components/ui/faq-accordion";
import { ServicesSliderSection } from "@/components/site/slider-sections";
import { BlockRenderer } from "@/components/blocks/block-renderer";

export const revalidate = 300;
export const dynamicParams = true;

/** Pre-render published entries at build; unknown slugs are still rendered on demand (and 404 correctly). */
export async function generateStaticParams() {
  try {
    const rows = await db.service.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getServiceBySlug(slug);
  if (!s) return { title: "Not found", robots: { index: false, follow: false } };
  return buildMetadata({ seo: s.seo, fallbackTitle: s.title, fallbackDescription: s.summary, path: `/services/${s.slug}`, imageMediaId: s.featuredMediaId });
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();
  const [settings, projects] = await Promise.all([getSettings(), getProjects()]);

  const relatedProjects = projects.filter((p) => {
    const tags = ((p.tags as string[] | null) ?? []).join(" ").toLowerCase();
    return tags.includes(service.title.split(" ")[0].toLowerCase()) || tags.includes(service.slug.replace(/-/g, " "));
  });
  const o = service.options;
  const showFaqs = o.showFaqs && service.faqs.length > 0;
  const path = `/services/${service.slug}`;
  const autoSchema = service.seo?.structuredData !== "NONE";

  return (
    <>
      {autoSchema && (
        <JsonLd data={serviceSchema({ name: service.title, description: service.summary, path, categoryName: service.category.name, s: settings })} />
      )}

      {showFaqs && <JsonLd data={faqSchema(service.faqs.map((f) => ({ question: f.question, answer: f.answer })))} />}

      <PageHero
        eyebrow={service.category.name}
        title={service.heroHeading || service.title}
        intro={service.summary}
        image={resolveBanner("services", service.featuredMedia, service.title)}
      >
        {o.primaryLabel && (
          <ButtonLink href={o.primaryHref || "#contact"} variant="accent" size="lg" arrow>
            {o.primaryLabel}
          </ButtonLink>
        )}
        {o.secondaryLabel && (
          <ButtonLink href={o.secondaryHref || "/#work"} variant="light" size="lg">
            {o.secondaryLabel}
          </ButtonLink>
        )}
      </PageHero>

      {o.showIntro && service.intro && (
        <Section tone="white" labelledBy="intro-title">
          <div>
            <Reveal>
              <h2 id="intro-title" className="t-h2">
                {o.introTitle || `About ${service.title}`}
              </h2>
              <p className="mt-5 text-lg text-muted">{service.intro}</p>
            </Reveal>
          </div>
        </Section>
      )}

      {o.showBenefits && service.benefits.length > 0 && (
        <Section labelledBy="benefits-title">
          <SectionHeading id="benefits-title" eyebrow={o.benefitsEyebrow} title={o.benefitsTitle} />
          <Stagger className="grid gap-5 md:grid-cols-3">
            {service.benefits.map((b) => (
              <StaggerItem key={b.title} className="rounded-[var(--radius-card)] border border-line bg-white p-6">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-forest-900 text-gold-300">
                  <Icon name="check" />
                </span>
                <h3 className="text-lg font-bold">{b.title}</h3>
                <p className="mt-2 text-muted">{b.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {o.showIncluded && service.included.length > 0 && (
        <Section tone="white" labelledBy="included-title">
          <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
            <SectionHeading id="included-title" eyebrow={o.includedEyebrow} title={o.includedTitle} text={o.includedText || undefined} />
            <Stagger className="grid gap-3 sm:grid-cols-2">
              {service.included.map((item) => (
                <StaggerItem key={item} className="flex items-start gap-3 rounded-[var(--radius-field)] border border-line bg-paper p-4">
                  <Icon name="check" size={20} className="mt-0.5 shrink-0 text-bronze-600" />
                  <span className="font-medium">{item}</span>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </Section>
      )}

      {o.showContent && service.blocksParsed.length > 0 && (
        <Section>
          <div>
            <BlockRenderer blocks={service.blocksParsed} />
          </div>
        </Section>
      )}

      {o.showProcess && service.process.length > 0 && (
        <Section tone="forest" labelledBy="process-title">
          <SectionHeading id="process-title" tone="dark" eyebrow={o.processEyebrow} title={o.processTitle} />
          <Stagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {service.process.map((p, i) => (
              <StaggerItem key={p.title} className="rounded-[var(--radius-card)] border border-white/15 bg-white/[0.06] p-6">
                <span className="font-display text-4xl font-extrabold text-gradient">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
                <p className="mt-2 text-white/75">{p.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {o.showProjects && relatedProjects.length > 0 && (
        <Section tone="white" labelledBy="proj-title">
          <SectionHeading id="proj-title" eyebrow={o.projectsEyebrow} title={o.projectsTitle} />
          <ul className="flex flex-wrap gap-3">
            {relatedProjects.map((p) => (
              <li key={p.id} className="rounded-full border border-line bg-paper px-4 py-2 font-semibold text-forest-900">
                {p.name}
              </li>
            ))}
          </ul>
          <ButtonLink href="/#work" variant="outline" className="mt-6" arrow>
            View all work
          </ButtonLink>
        </Section>
      )}

      {showFaqs && (
        <Section tone="white" labelledBy="service-faq-title">
          <div>
            <SectionHeading id="service-faq-title" align="center" eyebrow={o.faqEyebrow} title={o.faqTitle} />
            <FaqAccordion items={service.faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
          </div>
        </Section>
      )}

      {o.showRelated && (
        <ServicesSliderSection
          id="related"
          eyebrow={o.relatedEyebrow}
          title={o.relatedTitle}
          excludeSlug={service.slug}
          firstSlugs={service.relatedServices.map((r) => r.slug)}
        />
      )}
    </>
  );
}
