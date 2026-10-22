import { getMenu, getServicesGrouped } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { HeaderNav } from "@/components/site/header-nav";

export async function SiteHeader() {
  const [items, groups, settings] = await Promise.all([
    getMenu("header").catch(() => []),
    getServicesGrouped().catch(() => []),
    getSettings(),
  ]);
  return (
    <HeaderNav
      items={items.map((i) => ({ label: i.label, href: i.href, openInNewTab: i.openInNewTab, children: i.children.map((c) => ({ label: c.label, href: c.href, openInNewTab: c.openInNewTab })) }))}
      groups={groups.map((g) => ({ name: g.name, services: g.services.map((s) => ({ slug: s.slug, title: s.title })) }))}
      siteName={settings.general.siteName}
      ctaLabel="Book Free Consultation"
    />
  );
}
