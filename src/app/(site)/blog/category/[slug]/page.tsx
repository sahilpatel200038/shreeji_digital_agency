import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getBannerMedia, getPostCategories, getPostCategory, getPosts } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { ServicesSliderSection } from "@/components/site/slider-sections";
import { PageHero } from "@/components/ui/breadcrumbs";
import { Section } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Stagger, StaggerItem } from "@/components/motion/reveal";
import { PostCard } from "@/components/site/cards";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const cat = await getPostCategory(slug);
  if (!cat) return { title: "Not found", robots: { index: false, follow: false } };
  return buildMetadata({
    seo: { title: `${cat.name} Articles | Shreeji Marketing`, description: cat.description || `Articles about ${cat.name.toLowerCase()} from Shreeji Marketing.` },
    fallbackTitle: cat.name,
    path: `/blog/category/${cat.slug}`,
    noindex: page !== undefined && page !== "1",
  });
}

export default async function BlogCategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { page } = await searchParams;
  const cat = await getPostCategory(slug);
  if (!cat) notFound();
  const [data, categories, settings] = await Promise.all([getPosts({ categorySlug: slug, page: Number(page) || 1 }), getPostCategories(), getSettings()]);
  const banner = await getBannerMedia(settings.banners.blog);
  const chip = "inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold transition";
  return (
    <>
      <PageHero
        title={cat.name}
        intro={cat.description ?? undefined}
        crumbs={[
          { name: "Blog", path: "/blog" },
          { name: cat.name, path: `/blog/category/${cat.slug}` },
        ]}
        image={resolveBanner("blog", banner)}
      />
      <Section>
        <nav aria-label="Blog categories" className="mb-10 flex flex-wrap gap-3">
          <Link href="/blog" className={cn(chip, "border-line bg-white hover:border-bronze-300")}>
            All
          </Link>
          {categories
            .filter((c) => c._count.posts > 0 || c.slug === slug)
            .map((c) => (
              <Link key={c.id} href={`/blog/category/${c.slug}`} aria-current={c.slug === slug ? "true" : undefined} className={cn(chip, c.slug === slug ? "border-forest-900 bg-forest-900 text-white" : "border-line bg-white hover:border-bronze-300")}>
                {c.name}
              </Link>
            ))}
        </nav>
        {data.items.length === 0 ? (
          <EmptyState title="No articles in this category yet" text="Check back soon or browse all articles." />
        ) : (
          <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((p) => (
              <StaggerItem key={p.id}>
                <PostCard {...p} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <Pagination page={data.page} pages={data.pages} makeHref={(n) => (n > 1 ? `/blog/category/${slug}?page=${n}` : `/blog/category/${slug}`)} />
      </Section>
      <ServicesSliderSection id="services-slider" title="Services that grow your brand" />
    </>
  );
}
