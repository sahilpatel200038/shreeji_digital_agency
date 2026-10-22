import Link from "next/link";
import { Banner } from "@/components/ui/layout";
import { JsonLd } from "@/components/ui/json-ld";
import { BannerImage } from "@/components/ui/banner-image";
import { breadcrumbSchema } from "@/lib/seo/schema";
import type { BannerImageData } from "@/lib/banner";
import { cn } from "@/lib/utils";

export type Crumb = { name: string; path: string };

export function Breadcrumbs({ items, tone = "dark" }: { items: Crumb[]; tone?: "dark" | "light" }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbSchema(all)} />
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${tone === "dark" ? "text-white/75" : "text-muted"}`}>
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.path} className="flex items-center gap-2">
                {last ? (
                  <span aria-current="page" className={tone === "dark" ? "font-semibold text-white" : "font-semibold text-forest-900"}>
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.path} className="underline-offset-4 hover:underline">
                    {c.name}
                  </Link>
                )}
                {!last && <span aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Inner-page banner, built to match the homepage hero: same grid, eyebrow pill, headline, intro, CTA row and
 * picture panel. Breadcrumbs are shown only when `crumbs` is passed, which only the blog pages do.
 * No entrance animation here: a banner that fades in again on every route change reads as flicker.
 */
export function PageHero({
  title,
  intro,
  crumbs,
  eyebrow,
  image,
  children,
}: {
  title: string;
  intro?: string;
  crumbs?: Crumb[];
  eyebrow?: string;
  image: BannerImageData;
  children?: React.ReactNode;
}) {
  return (
    <Banner rowClassName="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="min-w-0">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {eyebrow && (
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-semibold tracking-wide text-gold-300">
            <span className="size-2 rounded-full bg-gold-300" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        {/* Short titles use the homepage headline size; long ones (articles, service headlines) step down so they stay readable. */}
        <h1 className={cn(title.length <= 32 ? "t-display" : "t-h1", "!text-white")}>{title}</h1>
        {intro && <p className="mt-6 max-w-xl text-lg text-white/80 md:text-xl">{intro}</p>}
        {children && <div className="mt-9 flex flex-wrap gap-4">{children}</div>}
      </div>
      <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
        <div className="absolute inset-0 -z-0 rounded-full bg-gold-300/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <BannerImage image={image} />
        </div>
      </div>
    </Banner>
  );
}
