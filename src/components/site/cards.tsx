import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/ui/icons";
import { Pill } from "@/components/ui/layout";
import { formatDate } from "@/lib/utils";

export type CardMedia = { id: number; checksum?: string | null; altText?: string | null } | null;

export function ServiceCard({ slug, title, summary, icon, featuredMedia }: { slug: string; title: string; summary: string; icon: string; featuredMedia?: CardMedia }) {
  return (
    <Link
      href={`/services/${slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition duration-300 hover:-translate-y-1 hover:border-bronze-300 hover:shadow-[var(--shadow-lift)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-forest-900">
        {featuredMedia ? (
          <Image
            src={`/media/${featuredMedia.id}${featuredMedia.checksum ? `?v=${featuredMedia.checksum.slice(0, 8)}` : ""}`}
            alt={featuredMedia.altText || ""}
            fill
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="bg-brand-glow grid h-full place-items-center text-gold-300">
            <Icon name={icon} size={40} />
          </div>
        )}
        <span className="absolute bottom-3 left-3 grid size-10 place-items-center rounded-lg bg-forest-900 text-gold-300 shadow-md">
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="t-h3 !text-xl">{title}</h3>
        <p className="mt-2 flex-1 text-muted">{summary}</p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-bronze-700">
          Explore service
          <Icon name="arrow-right" size={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  DIGITAL_MARKETING: "Digital Marketing",
  WEB_DEVELOPMENT: "Web Development",
  WEB_APPLICATION: "Web Application",
};

export function categoryLabel(c: string) {
  return CATEGORY_LABEL[c] ?? c;
}

export function ProjectCard({
  name,
  category,
  tags,
  mediaId,
  checksum,
  alt,
  externalUrl,
}: {
  name: string;
  category: string;
  tags: string[];
  mediaId: number | null;
  checksum?: string | null;
  alt?: string;
  externalUrl?: string | null;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-[3/2] overflow-hidden bg-forest-50">
        {mediaId ? (
          <Image
            src={`/media/${mediaId}${checksum ? `?v=${checksum.slice(0, 8)}` : ""}`}
            alt={alt || `${name} project`}
            fill
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-3 transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="bg-brand-glow grid h-full place-items-center">
            <span className="px-6 text-center font-display text-2xl font-extrabold text-gold-300">{name}</span>
          </div>
        )}
      </div>
      <div className=" flex-1 flex-col p-5">
        <Pill>{categoryLabel(category)}</Pill>
        <h3 className="t-h3 mt-3 !text-xl">{name}</h3>
        {tags.length > 0 && <p className="mt-2 flex-1 text-sm text-muted">{tags.join(" · ")}</p>}
        {externalUrl && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-bronze-700 hover:underline"
          >
            Visit project <Icon name="arrow-up-right" size={16} />
          </a>
        )}
      </div>
    </article>
  );
}

export function PostCard({
  slug,
  title,
  excerpt,
  publishedAt,
  readingMinutes,
  featuredMediaId,
  category,
}: {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  featuredMediaId: number | null;
  category: { name: string; slug: string } | null;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
      <Link href={`/blog/${slug}`} className="block" tabIndex={-1} aria-hidden="true">
        <div className="relative aspect-[16/9] overflow-hidden bg-forest-50">
          {featuredMediaId ? (
            <Image src={`/media/${featuredMediaId}`} alt="" fill sizes="(min-width: 1024px) 380px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="bg-brand-glow grid h-full place-items-center">
              <Icon name="file" size={40} className="text-gold-300" />
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {category && <Pill>{category.name}</Pill>}
          {publishedAt && <time dateTime={publishedAt.toISOString()}>{formatDate(publishedAt)}</time>}
          <span aria-hidden="true">·</span>
          <span>{readingMinutes} min read</span>
        </div>
        <h3 className="t-h3 mt-3 !text-xl">
          <Link href={`/blog/${slug}`} className="hover:text-bronze-700">
            {title}
          </Link>
        </h3>
        {excerpt && <p className="mt-2 line-clamp-3 flex-1 text-muted">{excerpt}</p>}
      </div>
    </article>
  );
}

export function TestimonialCard({ name, location, quote }: { name: string; location: string; quote: string }) {
  return (
    <figure className="flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-white p-6">
      <Icon name="star" className="text-bronze-500" />
      <blockquote className="mt-4 flex-1 text-lg text-ink">“{quote}”</blockquote>
      <figcaption className="mt-5 text-sm">
        <span className="font-bold text-forest-900">{name}</span>
        {location && <span className="text-muted"> · {location}</span>}
      </figcaption>
    </figure>
  );
}
