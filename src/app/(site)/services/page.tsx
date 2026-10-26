import type { Metadata } from "next";
import { listingSeo } from "@/lib/seo/listing";
import { buildMetadata } from "@/lib/seo/metadata";
import { getBannerMedia, getCoreServices, getServicesGrouped } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { itemListSchema } from "@/lib/seo/schema";
import { HeroActions, PageHero } from "@/components/ui/breadcrumbs";
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
  const others = all.filter((s) => !s.isFeatured);
  return (
    <>
      <JsonLd data={itemListSchema(all.map((s) => ({ name: s.title, path: `/services/${s.slug}` })))} />
      <PageHero
        eyebrow={settings.banners.servicesEyebrow}
        title={settings.banners.servicesTitle}
        intro={settings.banners.servicesText}
        image={resolveBanner("services", banner)}
      >
        <HeroActions
          primary={{ label: settings.home.ctaPrimaryLabel || "Start Your Journey", href: settings.home.ctaPrimaryHref || "/contact" }}
          secondary={{ label: settings.home.ctaSecondaryLabel || "View Our Work", href: "/#work" }}
        />
      </PageHero>
      <Section labelledBy="core-title">
        {all.length === 0 && <EmptyState title="Services are coming soon" text="Please check back shortly or contact us directly." />}
        {core.length > 0 && (
          <>
            <SectionHeading id="core-title" eyebrow={settings.banners.servicesCoreEyebrow} title={settings.banners.servicesCoreTitle} />
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
          <SectionHeading id="more-title" eyebrow={settings.banners.servicesMoreEyebrow} title={settings.banners.servicesMoreTitle} />
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
