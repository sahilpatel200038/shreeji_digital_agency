import type { Metadata } from "next";
import { db } from "@/lib/db";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { findRedirect, getBannerMedia, getPageBySlug, getTeamMembers } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { bannerKeyForSlug, resolveBanner } from "@/lib/banner";
import { organizationSchema, webPageSchema } from "@/lib/seo/schema";
import { HeroActions, PageHero } from "@/components/ui/breadcrumbs";
import { Section } from "@/components/ui/layout";
import { JsonLd } from "@/components/ui/json-ld";
import { ServicesSliderSection, WorkSliderSection } from "@/components/site/slider-sections";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { CompanyProfileSection, TeamSection } from "@/components/site/about-sections";

export const revalidate = 300;

/** Pre-render published entries at build; unknown slugs are still rendered on demand (and 404 correctly). */
export async function generateStaticParams() {
  try {
    const rows = await db.page.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Page not found", robots: { index: false, follow: false } };
  return buildMetadata({ seo: page.seo, fallbackTitle: page.title, fallbackDescription: page.excerpt ?? undefined, path: `/${page.slug}`, imageMediaId: page.featuredMediaId });
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) {
    // A renamed or removed page may have a redirect on record.
    const r = await findRedirect(`/${slug}`);
    if (r) {
      if (r.statusCode === 301 || r.statusCode === 308) permanentRedirect(r.toPath);
      redirect(r.toPath);
    }
    notFound();
  }

  const path = `/${page.slug}`;
  const isContact = page.template === "CONTACT";
  const settings = await getSettings();
  const team = page.slug === "about" ? await getTeamMembers() : [];
  const profileMedia = page.slug === "about" ? await getBannerMedia(settings.banners.aboutProfile) : null;
  const profileImage = profileMedia
    ? { src: `/media/${profileMedia.id}?v=${profileMedia.checksum.slice(0, 8)}`, alt: profileMedia.altText || "Shreeji Marketing company profile" }
    : { src: "/images/about/company-profile.webp", alt: "A bright, modern open-plan office with glass partitions and a long corridor" };
  const schemaType = page.slug === "about" ? "AboutPage" : isContact ? "ContactPage" : "WebPage";

  return (
    <>
      <JsonLd data={webPageSchema(schemaType, page.title, path)} />
      {isContact && <JsonLd data={organizationSchema(settings, settings.seo.ogMediaId)} />}
      <PageHero eyebrow={isContact ? settings.contact.pageEyebrow : page.slug === "about" ? settings.banners.aboutEyebrow : undefined} title={page.title} intro={page.excerpt ?? undefined} image={resolveBanner(bannerKeyForSlug(page.slug), page.featuredMedia, page.title)}>
        {(isContact || page.slug === "about") && (
          <HeroActions
            primary={isContact ? { label: "Send a Message", href: "#contact" } : { label: settings.home.ctaPrimaryLabel || "Start Your Journey", href: settings.home.ctaPrimaryHref || "/contact" }}
            secondary={{ label: "Our Services", href: "/services" }}
          />
        )}
      </PageHero>

      {page.slug === "about" ? (
        <>
          <CompanyProfileSection blocks={page.blocksParsed} image={profileImage} />
          <TeamSection members={team} eyebrow={settings.banners.teamEyebrow} title={settings.banners.teamTitle} />
        </>
      ) : (
        !isContact && (
          <Section tone="white">
            <BlockRenderer blocks={page.blocksParsed} />
          </Section>
        )
      )}
      {page.slug === "about" ? (
        <WorkSliderSection id="work" tone="paper" title={settings.banners.aboutWorkTitle} text={settings.banners.aboutWorkText} />
      ) : (
        (!isContact || settings.contact.showServices) && (
          <ServicesSliderSection id="services-slider" title={isContact ? settings.contact.servicesTitle : settings.banners.pageServicesTitle} text={isContact ? settings.contact.servicesText || undefined : undefined} />
        )
      )}
    </>
  );
}
