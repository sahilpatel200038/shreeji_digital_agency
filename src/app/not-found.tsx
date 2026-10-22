import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: { absolute: "Page not found | Shreeji Marketing" },
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Banner as="section" size="hero" rowClassName="text-center">
            <p className="font-display text-7xl font-extrabold text-gradient md:text-9xl">404</p>
            <h1 className="t-h2 mt-4 !text-white">We could not find that page</h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-white/80">The link may be old, or the page may have moved. Try one of these instead.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <ButtonLink href="/" variant="accent" size="lg">
                Go home
              </ButtonLink>
              <ButtonLink href="/services" variant="light" size="lg">
                Our services
              </ButtonLink>
              <ButtonLink href="/contact" variant="light" size="lg">
                Contact us
              </ButtonLink>
            </div>
        </Banner>
      </main>
      <SiteFooter />
    </>
  );
}
