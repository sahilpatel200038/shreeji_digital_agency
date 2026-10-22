import type { ReactNode } from "react";
import { getCoreServices, getProjects, getPublishedServices } from "@/lib/data/public";
import { Section, SectionHeading } from "@/components/ui/layout";
import { Slider } from "@/components/ui/slider";
import { ProjectCard, ServiceCard } from "@/components/site/cards";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  text?: string;
  tone?: "paper" | "white";
  /** Optional call to action under the slider. */
  footer?: ReactNode;
};

/**
 * Slider sections used across the site. Each one only supplies content and a heading; layout, autoplay,
 * arrows, breakpoints and touch handling all come from the shared <Slider />.
 */
export async function ServicesSliderSection({
  id = "services-slider",
  eyebrow = "What we do",
  title,
  text,
  tone = "paper",
  footer,
  firstSlugs = [],
  excludeSlug,
  coreOnly = true,
}: SectionProps & { firstSlugs?: string[]; excludeSlug?: string; coreOnly?: boolean }) {
  const all = await (coreOnly ? getCoreServices() : getPublishedServices());
  const pool = all.filter((s) => s.slug !== excludeSlug);
  const priority = firstSlugs.map((slug) => pool.find((s) => s.slug === slug)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  const rest = pool.filter((s) => !firstSlugs.includes(s.slug));
  const services = [...priority, ...rest];
  if (services.length === 0) return null;
  return (
    <Section tone={tone} labelledBy={`${id}-title`}>
      <SectionHeading id={`${id}-title`} eyebrow={eyebrow} title={title} text={text} />
      <Slider
        label={title}
        cols={{ sm: 2, lg: 3 }}
        items={services.map((s) => (
          <ServiceCard key={s.id} slug={s.slug} title={s.title} summary={s.summary} icon={s.icon} featuredMedia={s.featuredMedia} />
        ))}
      />
      {footer && <div className="mt-10 text-center">{footer}</div>}
    </Section>
  );
}

export async function WorkSliderSection({ id = "work", eyebrow = "Our work", title, text, tone = "white", footer }: SectionProps) {
  const projects = await getProjects();
  if (projects.length === 0) return null;
  return (
    <Section tone={tone} id={id} labelledBy={`${id}-title`} className="scroll-mt-20">
      <SectionHeading id={`${id}-title`} eyebrow={eyebrow} title={title} text={text} />
      <Slider
        label={title}
        items={projects.map((p) => (
          <ProjectCard key={p.id} name={p.name} category={p.category} tags={(p.tags as string[] | null) ?? []} mediaId={p.media?.id ?? null} checksum={p.media?.checksum} alt={p.media?.altText} externalUrl={p.externalUrl} />
        ))}
      />
      {footer && <div className="mt-10 text-center">{footer}</div>}
    </Section>
  );
}
