import Link from "next/link";
import Image from "next/image";
import { getBannerMedia, getMenu, getCoreServices } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { Container, Row } from "@/components/ui/layout";
import { Icon } from "@/components/ui/icons";
import { isExternal } from "@/lib/safe-url";

function FooterLinks({ title, links, twoColumns, className }: { title: string; links: { label: string; href: string; openInNewTab?: boolean }[]; twoColumns?: boolean; className?: string }) {
  return (
    <div className={className}>
      <h2 className="mb-4 text-sm font-bold tracking-[0.14em] !text-gold-300 uppercase">{title}</h2>
      <ul className={twoColumns ? "grid gap-x-8 gap-y-2.5 sm:grid-cols-2" : "space-y-2.5"}>
        {links.map((l) => (
          <li key={`${l.href}-${l.label}`}>
            {isExternal(l.href) ? (
              <a href={l.href} target={l.openInNewTab ? "_blank" : undefined} rel="noopener noreferrer" className="text-white/80 hover:text-white">
                {l.label}
              </a>
            ) : (
              <Link href={l.href} className="text-white/80 hover:text-white">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SiteFooter() {
  const [settings, company, legal, services] = await Promise.all([
    getSettings(),
    getMenu("footer-company").catch(() => []),
    getMenu("footer-legal").catch(() => []),
    getCoreServices().catch(() => []),
  ]);
  const { general, contact, social, footer } = settings;
  const logoMedia = await getBannerMedia(footer.logoMediaId).catch(() => null);
  const socials = footer.showSocial
    ? [
        { name: "Instagram", icon: "instagram", href: social.instagram },
        { name: "Facebook", icon: "facebook", href: social.facebook },
        { name: "LinkedIn", icon: "linkedin", href: social.linkedin },
        { name: "YouTube", icon: "youtube", href: social.youtube },
        { name: "X", icon: "x-social", href: social.x },
      ].filter((s) => s.href)
    : [];
  const shownServices = services.slice(0, footer.servicesLimit);
  const companyLinks = [...company, ...legal];
  const year = new Date().getFullYear();

  return (
    <footer className="section section--footer bg-forest-950 text-white">
      <div className="rule-gradient" />
      <Container className="py-14 md:py-16">
        <Row>
        <div className={`grid gap-12 ${footer.showServices && shownServices.length > 0 ? "lg:grid-cols-2 lg:gap-x-16" : ""}`}>
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label={`${general.siteName} home`}>
              <Image src={logoMedia ? `/media/${logoMedia.id}?v=${logoMedia.checksum.slice(0, 8)}` : "/brand/logo-mark.png"} alt="" width={48} height={44} className="h-11 w-auto" />
              {(footer.brandName || footer.brandTagline) && (
                <span className="leading-none">
                  {footer.brandName && <span className="block font-display text-xl font-extrabold tracking-tight text-white">{footer.brandName}</span>}
                  {footer.brandTagline && <span className="block font-display text-xs font-bold tracking-[0.28em] text-bronze-300">{footer.brandTagline}</span>}
                </span>
              )}
            </Link>
            <p className="mt-5 max-w-sm text-white/75">{general.footerBlurb}</p>
            <p className="mt-3 text-sm font-semibold text-gold-300">{general.tagline}</p>
            {socials.length > 0 && (
              <ul className="mt-6 flex gap-3">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${general.siteName} on ${s.name}`}
                      className="grid size-11 place-items-center rounded-full border border-white/20 text-white transition hover:border-gold-300 hover:text-gold-300"
                    >
                      <Icon name={s.icon} size={20} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-10 lg:space-y-12">
          {footer.showServices && shownServices.length > 0 && <FooterLinks twoColumns title={footer.servicesHeading} links={shownServices.map((s) => ({ label: s.title, href: `/services/${s.slug}` }))} />}
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_1.3fr]">
            {companyLinks.length > 0 && <FooterLinks title={footer.companyHeading} links={companyLinks} />}

            {footer.showContact && (
            <div>
              <h2 className="mb-4 text-sm font-bold tracking-[0.14em] !text-gold-300 uppercase">{footer.contactHeading}</h2>
              <address className="space-y-3 text-white/80 not-italic">
                <p className="flex gap-3">
                  <Icon name="map-pin" size={20} className="mt-1 shrink-0 text-bronze-300" />
                  <span>{contact.address}</span>
                </p>
                <p className="flex gap-3">
                  <Icon name="phone" size={20} className="mt-1 shrink-0 text-bronze-300" />
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="hover:text-white">
                    {contact.phone}
                  </a>
                </p>
                <p className="flex gap-3">
                  <Icon name="mail" size={20} className="mt-1 shrink-0 text-bronze-300" />
                  <a href={`mailto:${contact.email}`} className="[overflow-wrap:anywhere] hover:text-white">
                    {contact.email}
                  </a>
                </p>
              </address>
            </div>
            )}
          </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-white/60 sm:flex-row sm:justify-between">
          <p>
            © {year} {general.copyright}
          </p>
          {footer.bottomLine && <p>{footer.bottomLine}</p>}
        </div>
        </Row>
      </Container>
    </footer>
  );
}
