import type { Metadata } from "next";
import Link from "next/link";
import { listingSeo } from "@/lib/seo/listing";
import { buildMetadata } from "@/lib/seo/metadata";
import { getBannerMedia, getPostCategories, getPosts } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { ServicesSliderSection } from "@/components/site/slider-sections";
import { HeroActions, PageHero } from "@/components/ui/breadcrumbs";
import { Section } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { PostCard } from "@/components/site/cards";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, page } = await searchParams;
  return buildMetadata({
    seo: await listingSeo("blog"),
    fallbackTitle: "Blog",
    path: "/blog",
    noindex: Boolean(q) || (page !== undefined && page !== "1"),
  });
}

export default async function BlogPage({ searchParams }: Props) {
  const { q, page } = await searchParams;
  const [data, categories, settings] = await Promise.all([getPosts({ q, page: Number(page) || 1 }), getPostCategories(), getSettings()]);
  const banner = await getBannerMedia(settings.banners.blog);
  const chip = "inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition";
  const makeHref = (n: number) => `/blog?${new URLSearchParams({ ...(q ? { q } : {}), ...(n > 1 ? { page: String(n) } : {}) }).toString()}`.replace(/\?$/, "");

  return (
    <>
      <PageHero eyebrow={settings.banners.blogEyebrow} title={settings.banners.blogTitle} intro={settings.banners.blogText} crumbs={[{ name: "Blog", path: "/blog" }]} image={resolveBanner("blog", banner)}>
        <HeroActions
          primary={{ label: settings.home.ctaPrimaryLabel || "Start Your Journey", href: settings.home.ctaPrimaryHref || "/contact" }}
          secondary={{ label: "Our Services", href: "/services" }}
        />
      </PageHero>
      <Section>
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <nav aria-label="Blog categories" className="flex flex-wrap gap-3">
            <Link href="/blog" aria-current="true" className={cn(chip, "border-forest-900 bg-forest-900 text-white")}>
              All
            </Link>
            {categories
              .filter((c) => c._count.posts > 0)
              .map((c) => (
                <Link key={c.id} href={`/blog/category/${c.slug}`} className={cn(chip, "border-line bg-white hover:border-bronze-300")}>
                  {c.name}
                </Link>
              ))}
          </nav>
          <AutoFilterForm label="Search articles" className="flex gap-2">
            <label htmlFor="blog-q" className="sr-only">
              Search articles
            </label>
            <input id="blog-q" name="q" type="search" defaultValue={q} placeholder="Search articles" maxLength={80} className="min-h-12 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-4 focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40 lg:w-72" />
          </AutoFilterForm>
        </div>

        {data.items.length === 0 ? (
          <EmptyState
            title={q ? `No articles match “${q}”` : "No articles yet"}
            text={q ? "Try a different search term." : "We are working on new articles. Check back soon."}
            action={q ? <ButtonLink href="/blog" variant="outline">Clear search</ButtonLink> : undefined}
          />
        ) : (
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" key={`${q}-${data.page}`}>
            {data.items.map((p) => (
              <StaggerItem key={p.id}>
                <PostCard {...p} featuredMediaId={p.featuredMediaId} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <Pagination page={data.page} pages={data.pages} makeHref={makeHref} />
      </Section>
      <ServicesSliderSection id="services-slider" title={settings.banners.blogServicesTitle} text={settings.banners.blogServicesText} />
    </>
  );
}
