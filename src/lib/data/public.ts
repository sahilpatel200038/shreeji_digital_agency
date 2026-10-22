import { cache } from "react";
import { db } from "@/lib/db";
import { parseBlocks } from "@/lib/blocks/schema";
import { normalizePath } from "@/lib/safe-url";
import { CORE_SERVICE_SLUGS } from "@/lib/core-services";
import { readServicePageOptions } from "@/lib/service-page";

/** Public visibility rule: PUBLISHED and not scheduled for the future. */
export const publishedWhere = () => ({
  status: "PUBLISHED" as const,
  OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
});

export type MenuLink = { id: number; label: string; href: string; openInNewTab: boolean; children: MenuLink[] };

export const getMenu = cache(async (key: string): Promise<MenuLink[]> => {
  const menu = await db.menu.findUnique({
    where: { key },
    include: { items: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  if (!menu) return [];
  const map = new Map<number, MenuLink>();
  for (const i of menu.items) map.set(i.id, { id: i.id, label: i.label, href: i.href, openInNewTab: i.openInNewTab, children: [] });
  const roots: MenuLink[] = [];
  for (const i of menu.items) {
    const node = map.get(i.id)!;
    const parent = i.parentId ? map.get(i.parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
});

export const getServicesGrouped = cache(async () => {
  const cats = await db.serviceCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      services: {
        where: publishedWhere(),
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, title: true, summary: true, icon: true, featuredMedia: { select: { id: true, checksum: true, altText: true } }, },
      },
    },
  });
  return cats.filter((c) => c.services.length > 0);
});

export const getPublishedServices = cache(async () =>
  db.service.findMany({
    where: publishedWhere(),
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, title: true, summary: true, icon: true, featuredMedia: { select: { id: true, checksum: true, altText: true } }, category: { select: { name: true, slug: true } } },
  }),
);

/** The eight core services in their fixed display order (only those currently published). */
export const getCoreServices = cache(async () => {
  const all = await getPublishedServices();
  return CORE_SERVICE_SLUGS.map((slug) => all.find((s) => s.slug === slug)).filter((s): s is NonNullable<typeof s> => Boolean(s));
});

export const getServiceBySlug = cache(async (slug: string) => {
  const s = await db.service.findFirst({
    where: { slug, ...publishedWhere() },
    include: {
      category: true,
      seo: true,
      featuredMedia: BANNER_MEDIA,
      faqs: { where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      related: {
        include: { related: { select: { id: true, slug: true, title: true, summary: true, icon: true, status: true, publishedAt: true, featuredMedia: { select: { id: true, checksum: true, altText: true } }, } } },
      },
    },
  });
  if (!s) return null;
  const now = new Date();
  return {
    ...s,
    benefits: (s.benefits as { title: string; text: string }[] | null) ?? [],
    included: (s.included as string[] | null) ?? [],
    process: (s.process as { title: string; text: string }[] | null) ?? [],
    blocksParsed: parseBlocks(s.blocks ?? []),
    options: readServicePageOptions(s.pageOptions),
    relatedServices: s.related
      .map((r) => r.related)
      .filter((r) => r.status === "PUBLISHED" && (!r.publishedAt || r.publishedAt <= now)),
  };
});

export const getProjects = cache(async () =>
  db.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { sortOrder: "asc" },
    include: { media: { select: { id: true, checksum: true, altText: true, width: true, height: true } } },
  }),
);

export const getFaqs = cache(async (opts: { homeOnly?: boolean } = {}) =>
  db.faq.findMany({
    where: { status: "PUBLISHED", serviceId: null, ...(opts.homeOnly ? { showOnHome: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  }),
);

export const getVerifiedTestimonials = cache(async () =>
  db.testimonial.findMany({ where: { status: "PUBLISHED", isVerified: true }, orderBy: { sortOrder: "asc" } }),
);

/** Published leadership team for the About page, in admin-defined order. */
export const getTeamMembers = cache(async () =>
  db.teamMember.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { photo: { select: { id: true, checksum: true, altText: true } } },
  }),
);

const BANNER_MEDIA = { select: { id: true, checksum: true, altText: true } } as const;

/** The admin-chosen banner image for a settings-managed page (home, services, blog, FAQ), if it still exists. */
export const getBannerMedia = cache(async (id: number | null) =>
  id ? db.media.findFirst({ where: { id, mimeType: { startsWith: "image/" } }, ...BANNER_MEDIA }) : null,
);

export const getPageBySlug = cache(async (slug: string) => {
  const p = await db.page.findFirst({ where: { slug, ...publishedWhere() }, include: { seo: true, featuredMedia: BANNER_MEDIA } });
  return p ? { ...p, blocksParsed: parseBlocks(p.blocks) } : null;
});

const POST_LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  publishedAt: true,
  readingMinutes: true,
  featuredMediaId: true,
  category: { select: { name: true, slug: true } },
  author: { select: { name: true } },
} as const;

export async function getPosts(opts: { q?: string; categorySlug?: string; page?: number; pageSize?: number }) {
  const pageSize = opts.pageSize ?? 9;
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim().slice(0, 80);
  const where = {
    ...publishedWhere(),
    ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
    ...(q ? { AND: [{ OR: [{ title: { contains: q } }, { excerpt: { contains: q } }] }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: POST_LIST_SELECT }),
    db.post.count({ where }),
  ]);
  return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const getPostCategories = cache(async () =>
  db.postCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { posts: { where: publishedWhere() } } } } }),
);

export const getPostCategory = cache(async (slug: string) => db.postCategory.findUnique({ where: { slug } }));

export const getPostBySlug = cache(async (slug: string) => {
  const p = await db.post.findFirst({
    where: { slug, ...publishedWhere() },
    include: { seo: true, category: true, featuredMedia: BANNER_MEDIA, author: { select: { name: true } }, tags: { include: { tag: true } } },
  });
  return p ? { ...p, blocksParsed: parseBlocks(p.blocks) } : null;
});

export async function getRelatedPosts(postId: number, categoryId: number | null, take = 3) {
  const same = categoryId
    ? await db.post.findMany({
        where: { ...publishedWhere(), id: { not: postId }, categoryId },
        orderBy: { publishedAt: "desc" },
        take,
        select: POST_LIST_SELECT,
      })
    : [];
  if (same.length >= take) return same;
  const more = await db.post.findMany({
    where: { ...publishedWhere(), id: { notIn: [postId, ...same.map((s) => s.id)] } },
    orderBy: { publishedAt: "desc" },
    take: take - same.length,
    select: POST_LIST_SELECT,
  });
  return [...same, ...more];
}

export async function findRedirect(path: string) {
  const from = normalizePath(path);
  const r = await db.redirect.findFirst({ where: { fromPath: from, isActive: true } });
  if (r) await db.redirect.update({ where: { id: r.id }, data: { hits: { increment: 1 } } }).catch(() => {});
  return r;
}

/** Everything that may appear in the sitemap (published + indexable + opted in). */
export async function getSitemapEntries() {
  const where = { ...publishedWhere() };
  const seoOk = { OR: [{ seoId: null }, { seo: { robotsIndex: true, includeInSitemap: true } }] };
  const [pages, services, posts, categories] = await Promise.all([
    db.page.findMany({ where: { ...where, AND: [seoOk] }, select: { slug: true, updatedAt: true } }),
    db.service.findMany({ where: { ...where, AND: [seoOk] }, select: { slug: true, updatedAt: true } }),
    db.post.findMany({ where: { ...where, AND: [seoOk] }, select: { slug: true, updatedAt: true } }),
    db.postCategory.findMany({
      where: { posts: { some: publishedWhere() } },
      select: { slug: true },
    }),
  ]);
  return { pages, services, posts, categories };
}
