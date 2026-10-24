/* Idempotent seed: upserts only, never truncates or deletes existing rows. */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { hashPassword, passwordProblems } from "../src/lib/auth/password";
import { saveMedia } from "../src/lib/media/store";
import { blocksSchema, readingMinutes } from "../src/lib/blocks/schema";
import { SETTING_SCHEMAS } from "../src/lib/settings/schema";
import { CORE_SERVICE_RENAMES, LEGACY_WEB_APP, MAIN_SERVICE_SLUGS, SERVICES, SERVICE_CATEGORIES } from "./seed-data/services";
import { FAQS, MENUS, PAGES, POSTS, POST_CATEGORIES, PROJECTS, TESTIMONIALS } from "./seed-data/content";

const IMG_DIR = path.join(__dirname, "seed-data", "images");

async function ensureMedia(fileName: string, title: string, alt: string, absPath: string, folder: string) {
  const existing = await db.media.findFirst({ where: { fileName, folder } });
  if (existing) return existing;
  return saveMedia(readFileSync(absPath), { fileName, title, altText: alt, folder });
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
  const problem = passwordProblems(password);
  if (problem && process.env.NODE_ENV === "production") throw new Error(`SEED_ADMIN_PASSWORD rejected: ${problem}`);

  // Admin (never overwrite an existing user's password)
  let admin = await db.user.findUnique({ where: { email } });
  if (!admin) {
    admin = await db.user.create({
      data: { email, name: "Site Administrator", role: "SUPER_ADMIN", passwordHash: await hashPassword(password) },
    });
    console.log(`created super admin ${email}`);
  } else console.log(`admin ${email} already exists, left unchanged`);

  // Settings (only create missing groups)
  for (const [key, schema] of Object.entries(SETTING_SCHEMAS)) {
    const exists = await db.setting.findUnique({ where: { key } });
    if (!exists) await db.setting.create({ data: { key, value: schema.parse({}) as object } });
  }

  // Logo media
  const logo = await ensureMedia("logo-full.png", "Shreeji Marketing logo", "Shreeji Marketing logo: globe with rising arrow", path.join(__dirname, "..", "public", "brand", "logo-full.png"), "brand");
  const og = await db.setting.findUnique({ where: { key: "seo" } });
  if (og && !(og.value as { ogMediaId?: number | null }).ogMediaId) {
    await db.setting.update({ where: { key: "seo" }, data: { value: { ...(og.value as object), ogMediaId: logo.id } } });
  }

  // Menus
  for (const [key, items] of Object.entries(MENUS)) {
    const menu = await db.menu.upsert({ where: { key }, update: {}, create: { key, name: key.replace(/-/g, " ") } });
    if ((await db.menuItem.count({ where: { menuId: menu.id } })) === 0) {
      await db.menuItem.createMany({ data: items.map((i, idx) => ({ menuId: menu.id, label: i.label, href: i.href, sortOrder: idx })) });
    }
  }

  // The FAQ page is no longer linked from the header.
  await db.menuItem.deleteMany({ where: { href: "/faq", menu: { key: "header" } } });

  // Work is now a homepage section; Home is the first header item.
  const headerMenu = await db.menu.findUnique({ where: { key: "header" } });
  if (headerMenu) {
    await db.menuItem.deleteMany({ where: { menuId: headerMenu.id, href: "/work" } });
    if ((await db.menuItem.count({ where: { menuId: headerMenu.id, href: "/" } })) === 0) {
      await db.menuItem.updateMany({ where: { menuId: headerMenu.id }, data: { sortOrder: { increment: 1 } } });
      await db.menuItem.create({ data: { menuId: headerMenu.id, label: "Home", href: "/", sortOrder: 0 } });
    }
  }
  await db.menuItem.updateMany({ where: { href: "/work" }, data: { href: "/#work" } });

  // Service categories + services
  const cat = new Map<string, number>();
  for (const c of SERVICE_CATEGORIES) {
    const row = await db.serviceCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
    cat.set(c.slug, row.id);
  }
  // The combined "Web / App Development & Design" service is now two services. The existing row (and its page
  // history, images, SEO and relations) becomes "Web Development & Design"; the app service is created below.
  // Its old address keeps working through a 301. Wording is refreshed only while it is still the original seeded text.
  const legacyWeb = await db.service.findUnique({ where: { slug: LEGACY_WEB_APP.slug }, include: { seo: true } });
  const webSeed = SERVICES.find((x) => x.slug === "web-development-design")!;
  if (legacyWeb && !(await db.service.findUnique({ where: { slug: webSeed.slug } }))) {
    const untouched = legacyWeb.summary === LEGACY_WEB_APP.summary;
    const generic = ["Web & App Development", "Web / App Development & Design"].includes(legacyWeb.title);
    await db.$transaction(async (tx) => {
      await tx.service.update({
        where: { id: legacyWeb.id },
        data: {
          slug: webSeed.slug,
          isFeatured: true,
          ...(generic ? { title: webSeed.title } : {}),
          ...(untouched
            ? { summary: webSeed.summary, heroHeading: webSeed.heroHeading, intro: webSeed.intro, benefits: webSeed.benefits, included: webSeed.included, process: webSeed.process }
            : {}),
        },
      });
      if (untouched && legacyWeb.seoId) {
        await tx.seoMeta.update({ where: { id: legacyWeb.seoId }, data: { title: webSeed.seoTitle, description: webSeed.seoDescription, focusKeyword: webSeed.focusKeyword } });
      }
      const from = `/services/${LEGACY_WEB_APP.slug}`;
      const to = `/services/${webSeed.slug}`;
      await tx.redirect.upsert({ where: { fromPath: from }, create: { fromPath: from, toPath: to, statusCode: 301 }, update: { toPath: to, statusCode: 301, isActive: true } });
      // Internal links inside stored page and post content follow the new address.
      for (const model of [tx.page, tx.post] as const) {
        const rows = await (model as typeof tx.page).findMany({ select: { id: true, blocks: true } });
        for (const r of rows) {
          const json = JSON.stringify(r.blocks);
          if (json.includes(from)) await (model as typeof tx.page).update({ where: { id: r.id }, data: { blocks: JSON.parse(json.split(from).join(to)) } });
        }
      }
    });
    console.log(`renamed service ${LEGACY_WEB_APP.slug} -> ${webSeed.slug}`);
  }

  const svc = new Map<string, number>();
  let order = 0;
  for (const s of SERVICES) {
    order += 1;
    const existing = await db.service.findUnique({ where: { slug: s.slug } });
    if (existing) {
      svc.set(s.slug, existing.id);
      continue;
    }
    const seo = await db.seoMeta.create({
      data: { title: s.seoTitle, description: s.seoDescription, focusKeyword: s.focusKeyword },
    });
    // A service added after the first seed goes to the end of the list instead of clashing with an existing position.
    const topOrder = (await db.service.aggregate({ _max: { sortOrder: true } }))._max.sortOrder ?? 0;
    const row = await db.service.create({
      data: {
        categoryId: cat.get(s.category)!,
        title: s.title,
        slug: s.slug,
        summary: s.summary,
        icon: s.icon,
        heroHeading: s.heroHeading,
        intro: s.intro,
        benefits: s.benefits,
        included: s.included,
        process: s.process,
        blocks: [],
        status: "PUBLISHED",
        publishedAt: new Date(),
        sortOrder: Math.max(order, topOrder + 1),
        isFeatured: s.featured ?? MAIN_SERVICE_SLUGS.has(s.slug),
        seoId: seo.id,
      },
    });
    svc.set(s.slug, row.id);
  }
  // Core-service display names (only while the title is still the original seeded one).
  for (const [slug, r] of Object.entries(CORE_SERVICE_RENAMES)) {
    await db.service.updateMany({ where: { slug, title: r.from }, data: { title: r.to } });
  }
  for (const s of SERVICES) {
    for (const rel of s.related) {
      const a = svc.get(s.slug)!;
      const b = svc.get(rel);
      if (!b) continue;
      await db.serviceRelation.upsert({ where: { serviceId_relatedId: { serviceId: a, relatedId: b } }, update: {}, create: { serviceId: a, relatedId: b } });
    }
  }

  // Service images: files live in public/images/services and are imported into the media library,
  // so admins can swap them in the service editor. Existing featured images are never replaced.
  for (const s of SERVICES) {
    const file = path.join(__dirname, "..", "public", "images", "services", `${s.slug}.jpg`);
    if (!existsSync(file)) continue;
    const row = await db.service.findUnique({ where: { slug: s.slug } });
    if (!row || row.featuredMediaId) continue;
    const media = await ensureMedia(`${s.slug}.jpg`, `${s.title} image`, `${s.title}: illustrative photo`, file, "services");
    await db.service.update({ where: { id: row.id }, data: { featuredMediaId: media.id } });
  }

  // Projects
  for (const [i, p] of PROJECTS.entries()) {
    if (await db.project.findUnique({ where: { slug: p.slug } })) continue;
    let mediaId: number | null = null;
    if (p.image) {
      const file = path.join(IMG_DIR, p.image);
      if (existsSync(file)) mediaId = (await ensureMedia(p.image, p.name, `${p.name} project logo`, file, "projects")).id;
    }
    await db.project.create({
      data: {
        name: p.name,
        slug: p.slug,
        category: p.category,
        tags: [...p.tags],
        summary: null,
        mediaId,
        sortOrder: i,
        status: "PUBLISHED",
      },
    });
  }

  // Global FAQs
  if ((await db.faq.count({ where: { serviceId: null } })) === 0) {
    for (const [i, f] of FAQS.entries()) {
      await db.faq.create({ data: { question: f.question, answer: f.answer, category: f.category, showOnHome: f.showOnHome, sortOrder: i } });
    }
  }

  // Testimonials: imported but unverified + draft
  if ((await db.testimonial.count()) === 0) {
    for (const [i, t] of TESTIMONIALS.entries()) {
      await db.testimonial.create({ data: { name: t.name, location: t.location, quote: t.quote, isVerified: false, status: "DRAFT", sortOrder: i } });
    }
  }

  // Leadership team (About page). Photos are added later in Admin > Team once approved images are supplied.
  if ((await db.teamMember.count()) === 0) {
    const TEAM = [
      { name: "Mitesh Patel", role: "CEO", title: "Chief Executive Officer" },
      { name: "Sahil Patel", role: "CTO", title: "Chief Technology Officer" },
      { name: "Abhishek Thakar", role: "COO", title: "Chief Operating Officer" },
      { name: "Hirenbhai Patel", role: "MD", title: "Managing Director" },
      { name: "Dev Patel", role: "Digital Marketing Head", title: "Head of Digital Marketing" },
    ];
    for (const [i, m] of TEAM.entries()) await db.teamMember.create({ data: { ...m, status: "PUBLISHED", sortOrder: i } });
  }

  // CMS pages
  for (const pg of PAGES) {
    if (await db.page.findUnique({ where: { slug: pg.slug } })) continue;
    const seo = await db.seoMeta.create({ data: { title: pg.seoTitle, description: pg.seoDescription } });
    await db.page.create({
      data: {
        title: pg.title,
        slug: pg.slug,
        template: pg.template,
        excerpt: pg.excerpt,
        blocks: blocksSchema.parse(pg.blocks),
        status: "PUBLISHED",
        publishedAt: new Date(),
        isSystem: true,
        seoId: seo.id,
      },
    });
  }

  // Blog
  const pc = new Map<string, number>();
  for (const c of POST_CATEGORIES) {
    const row = await db.postCategory.upsert({ where: { slug: c.slug }, update: {}, create: c });
    pc.set(c.slug, row.id);
  }
  for (const post of POSTS) {
    if (await db.post.findUnique({ where: { slug: post.slug } })) continue;
    const blocks = blocksSchema.parse(post.blocks);
    const seo = await db.seoMeta.create({ data: { title: post.seoTitle, description: post.seoDescription, focusKeyword: post.focusKeyword } });
    const created = await db.post.create({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        blocks,
        authorId: admin.id,
        categoryId: pc.get(post.category) ?? null,
        status: "PUBLISHED",
        publishedAt: new Date(),
        readingMinutes: readingMinutes(blocks),
        seoId: seo.id,
      },
    });
    for (const t of post.tags) {
      const slug = t.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const tag = await db.tag.upsert({ where: { slug }, update: {}, create: { name: t, slug } });
      await db.postTag.create({ data: { postId: created.id, tagId: tag.id } });
    }
  }

  console.log("seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
