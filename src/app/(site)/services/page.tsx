import type { Metadata } from "next";
import { listingSeo } from "@/lib/seo/listing";
import { buildMetadata } from "@/lib/seo/metadata";
import { CORE_SERVICE_SLUGS } from "@/lib/core-services";
import { getBannerMedia, getCoreServices, getServicesGrouped } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { itemListSchema } from "@/lib/seo/schema";
import { PageHero } from "@/components/ui/breadcrumbs";
import { Section, SectionHeading } from "@/components/ui/layout";
import { JsonLd } from "@/components/ui/json-ld";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { ServiceCard } from "@/components/site/cards";
import { EmptyState } from "@/components/ui/skeleton";
import { WorkSliderSection } from "@/components/site/slider-sections";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    seo: await listingSeo("services"),
    fallbackTitle: "Services",
    path: "/services",
  });
}

export default async function ServicesPage() {
  const [groups, core, settings] = await Promise.all([getServicesGrouped(), getCoreServices(), getSettings()]);
  const banner = await getBannerMedia(settings.banners.services);
  const all = groups.flatMap((g) => g.services);
  const coreSlugs = new Set<string>(CORE_SERVICE_SLUGS);
  const others = all.filter((s) => !coreSlugs.has(s.slug));
  return (
    <>
      <JsonLd data={itemListSchema(all.map((s) => ({ name: s.title, path: `/services/${s.slug}` })))} />
      <PageHero
        eyebrow="Our services"
        title={settings.banners.servicesTitle}
        intro={settings.banners.servicesText}
        image={resolveBanner("services", banner)}
      />
      <Section labelledBy="core-title">
        {all.length === 0 && <EmptyState title="Services are coming soon" text="Please check back shortly or contact us directly." />}
        {core.length > 0 && (
          <>
            <SectionHeading id="core-title" eyebrow="What we do" title="Our Core Services" />
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {core.map((s) => (
                <StaggerItem key={s.id}>
                  <ServiceCard slug={s.slug} title={s.title} summary={s.summary} icon={s.icon} featuredMedia={s.featuredMedia} />
                </StaggerItem>
              ))}
            </Stagger>
          </>
        )}
      </Section>
      {others.length > 0 && (
        <Section tone="white" labelledBy="more-title">
          <SectionHeading id="more-title" eyebrow="Also available" title="More ways we can help" />
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((s) => (
              <StaggerItem key={s.id}>
                <ServiceCard slug={s.slug} title={s.title} summary={s.summary} icon={s.icon} featuredMedia={s.featuredMedia} />
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}
      <WorkSliderSection id="work" tone={others.length > 0 ? "paper" : "white"} title="Projects we have delivered" text="Marketing and development work across these services." />
    </>
  );
}
