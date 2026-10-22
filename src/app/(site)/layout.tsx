import type { Metadata } from "next";
import Script from "next/script";
import { SiteHeader } from "@/components/site/site-header";
import { NavigationProgress } from "@/components/site/navigation-progress";
import { RefreshOnFocus } from "@/components/site/refresh-on-focus";
import { WhatsAppButton } from "@/components/site/whatsapp-button";
import { ContactSection } from "@/components/site/contact-section";
import { SiteFooter } from "@/components/site/site-footer";
import { getSettings } from "@/lib/settings/get";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const { analytics } = await getSettings();
  return analytics.gscToken ? { verification: { google: analytics.gscToken } } : {};
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { analytics } = await getSettings();
  return (
    <>
      <noscript>
        <style>{`[style*="opacity: 0"],[style*="opacity:0;"],[style="opacity:0"],[style*="translateY(105%)"]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a
        href="#main"
        className="sr-only z-[100] rounded-lg bg-gold-300 px-4 py-2 font-semibold text-forest-950 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <ContactSection />
      <SiteFooter />
      <WhatsAppButton />
      <RefreshOnFocus />
      <NavigationProgress />
      {analytics.gtm && (
        <Script id="gtm" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${analytics.gtm}');`}</Script>
      )}
      {analytics.ga4 && !analytics.gtm && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${analytics.ga4}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analytics.ga4}');`}</Script>
        </>
      )}
    </>
  );
}
