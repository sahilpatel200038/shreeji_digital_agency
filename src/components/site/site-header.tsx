import { getBannerMedia, getMenu, getServicesGrouped } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { HeaderNav } from "@/components/site/header-nav";

export async function SiteHeader() {
  const [items, groups, settings] = await Promise.all([
    getMenu("header").catch(() => []),
    getServicesGrouped().catch(() => []),
    getSettings(),
  ]);
  const { header } = settings;
  const logoMedia = await getBannerMedia(header.logoMediaId).catch(() => null);
  return (
    <HeaderNav
      items={items.map((i) => ({ label: i.label, href: i.href, openInNewTab: i.openInNewTab, children: i.children.map((c) => ({ label: c.label, href: c.href, openInNewTab: c.openInNewTab })) }))}
      groups={groups.map((g) => ({ name: g.name, services: g.services.map((s) => ({ slug: s.slug, title: s.title })) }))}
      siteName={settings.general.siteName}
      logo={logoMedia ? `/media/${logoMedia.id}?v=${logoMedia.checksum.slice(0, 8)}` : null}
      brandName={header.brandName}
      brandTagline={header.brandTagline}
      cta={header.showCta && header.ctaLabel && header.ctaHref ? { label: header.ctaLabel, href: header.ctaHref, newTab: header.ctaNewTab } : null}
    />
  );
}
