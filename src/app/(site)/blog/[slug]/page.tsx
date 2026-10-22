import type { Metadata } from "next";
import { db } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMetadata } from "@/lib/seo/metadata";
import { getBannerMedia, getPostBySlug, getRelatedPosts } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { resolveBanner } from "@/lib/banner";
import { blogPostingSchema, faqSchema } from "@/lib/seo/schema";
import { Slider } from "@/components/ui/slider";
import { ServicesSliderSection } from "@/components/site/slider-sections";
import { PageHero } from "@/components/ui/breadcrumbs";
import { Section, SectionHeading } from "@/components/ui/layout";
import { JsonLd } from "@/components/ui/json-ld";
import { PostCard } from "@/components/site/cards";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

/** Pre-render published entries at build; unknown slugs are still rendered on demand (and 404 correctly). */
export async function generateStaticParams() {
  try {
    const rows = await db.post.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
    return rows.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p) return { title: "Not found", robots: { index: false, follow: false } };
  return buildMetadata({
    seo: p.seo,
    fallbackTitle: p.title,
    fallbackDescription: p.excerpt ?? undefined,
    path: `/blog/${p.slug}`,
    imageMediaId: p.featuredMediaId,
    type: "article",
    publishedTime: p.publishedAt,
    modifiedTime: p.updatedAt,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const [settings, related] = await Promise.all([getSettings(), getRelatedPosts(post.id, post.categoryId, 6)]);
  const blogBanner = post.featuredMedia ? null : await getBannerMedia(settings.banners.blog);
  const path = `/blog/${post.slug}`;
  const faqBlocks = post.blocksParsed.flatMap((b) => (b.type === "faq" ? b.items : []));

  return (
    <>
      {post.seo?.structuredData !== "NONE" && (
        <JsonLd
          data={blogPostingSchema({
            headline: post.title,
            description: post.seo?.description || post.excerpt || "",
            path,
            imageMediaId: post.featuredMediaId,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            authorName: post.author.name,
            s: settings,
          })}
        />
      )}
      {faqBlocks.length > 0 && <JsonLd data={faqSchema(faqBlocks)} />}

      <PageHero
        eyebrow={post.category?.name}
        title={post.title}
        intro={post.excerpt ?? undefined}
        crumbs={[
          { name: "Blog", path: "/blog" },
          { name: post.title, path },
        ]}
        image={resolveBanner("blog", post.featuredMedia ?? blogBanner, post.title)}
      >
        <p className="text-sm text-white/70">
          By {post.author.name}
          {post.publishedAt && (
            <>
              {" · "}
              <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
            </>
          )}
          {" · "}
          {post.readingMinutes} min read
        </p>
      </PageHero>

      <Section tone="white">
        <div>
          <BlockRenderer blocks={post.blocksParsed} />
          {post.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2 border-t border-line pt-6" aria-label="Tags">
              {post.tags.map((t) => (
                <li key={t.tagId} className="rounded-full bg-forest-50 px-3 py-1 text-sm font-medium text-forest-800">
                  #{t.tag.name}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8">
            <Link href="/blog" className="font-semibold text-bronze-700 hover:underline">
              ← Back to all articles
            </Link>
          </p>
        </div>
      </Section>

      {related.length > 0 ? (
        <Section labelledBy="related-title">
          <SectionHeading id="related-title" eyebrow="Keep reading" title="Related articles" />
          <Slider label="Related articles" items={related.map((r) => <PostCard key={r.id} {...r} />)} />
        </Section>
      ) : (
        <ServicesSliderSection id="services-slider" title="Services that grow your brand" />
      )}
    </>
  );
}
