import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real MySQL, separate test schema (see vitest.config.mts). Imports are dynamic so DATABASE_URL is the test one.
let db: typeof import("@/lib/db").db;
let helpers: typeof import("@/lib/content-helpers");
let adminActions: typeof import("@/lib/admin-actions");
let rateLimit: typeof import("@/lib/rate-limit");
let usage: typeof import("@/lib/media/usage");
let store: typeof import("@/lib/media/store");
let sharp: typeof import("sharp").default;

const tag = `it${Date.now()}`;
let userId: number;
let categoryId: number;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to run integration tests against a non-test database");
  ({ db } = await import("@/lib/db"));
  helpers = await import("@/lib/content-helpers");
  adminActions = await import("@/lib/admin-actions");
  rateLimit = await import("@/lib/rate-limit");
  usage = await import("@/lib/media/usage");
  store = await import("@/lib/media/store");
  sharp = (await import("sharp")).default;
  const u = await db.user.create({ data: { email: `${tag}@test.local`, name: "Test", passwordHash: "x", role: "EDITOR" } });
  userId = u.id;
  categoryId = (await db.serviceCategory.create({ data: { name: tag, slug: tag } })).id;
});

afterAll(async () => {
  await db.faq.deleteMany({ where: { category: tag } });
  await db.service.deleteMany({ where: { slug: { startsWith: tag } } });
  await db.post.deleteMany({ where: { slug: { startsWith: tag } } });
  await db.page.deleteMany({ where: { slug: { startsWith: tag } } });
  await db.serviceCategory.deleteMany({ where: { slug: tag } });
  await db.redirect.deleteMany({ where: { fromPath: { startsWith: `/${tag}` } } });
  await db.rateLimit.deleteMany({ where: { key: { startsWith: tag } } });
  await db.lead.deleteMany({ where: { email: { startsWith: tag } } });
  await db.media.deleteMany({ where: { folder: tag } });
  await db.user.deleteMany({ where: { email: `${tag}@test.local` } });
  await db.$disconnect();
});

describe("slugs and redirects", () => {
  it("rejects a duplicate slug but allows the same row to keep its own", async () => {
    const a = await db.page.create({ data: { title: "A", slug: `${tag}-a`, blocks: [] } });
    await expect(db.$transaction((tx) => helpers.resolveSlug(tx, "page", `${tag}-a`, "x"))).rejects.toThrow(/already in use/);
    await expect(db.$transaction((tx) => helpers.resolveSlug(tx, "page", `${tag}-a`, "x", a.id))).resolves.toBe(`${tag}-a`);
  });

  it("rejects reserved slugs when asked", async () => {
    await expect(db.$transaction((tx) => helpers.resolveSlug(tx, "page", "admin", "x", undefined, { checkReserved: true }))).rejects.toThrow(/reserved/);
  });

  it("the database itself enforces slug uniqueness", async () => {
    await db.post.create({ data: { title: "P", slug: `${tag}-dup`, blocks: [], authorId: userId } });
    await expect(db.post.create({ data: { title: "P2", slug: `${tag}-dup`, blocks: [], authorId: userId } })).rejects.toThrow();
  });

  it("slug change creates a 301, removes loops and re-points chains", async () => {
    await db.$transaction((tx) => adminActions.redirectOnSlugChange(tx, "/blog", `${tag}-old`, `${tag}-new`));
    const r = await db.redirect.findUnique({ where: { fromPath: `/blog/${tag}-old` } });
    expect(r).toMatchObject({ toPath: `/blog/${tag}-new`, statusCode: 301 });

    // Rename again: old -> new -> newer must collapse to old -> newer.
    await db.$transaction((tx) => adminActions.redirectOnSlugChange(tx, "/blog", `${tag}-new`, `${tag}-newer`));
    expect((await db.redirect.findUnique({ where: { fromPath: `/blog/${tag}-old` } }))?.toPath).toBe(`/blog/${tag}-newer`);

    // Renaming back must not leave a redirect that loops.
    await db.$transaction((tx) => adminActions.redirectOnSlugChange(tx, "/blog", `${tag}-newer`, `${tag}-old`));
    expect(await db.redirect.findUnique({ where: { fromPath: `/blog/${tag}-old` } })).toBeNull();
  });
});

describe("relations and deletion behaviour", () => {
  it("RESTRICT: a category with services cannot be deleted", async () => {
    const s = await db.service.create({ data: { categoryId, title: "S", slug: `${tag}-s`, summary: "x" } });
    await expect(db.serviceCategory.delete({ where: { id: categoryId } })).rejects.toThrow();
    expect(await db.service.findUnique({ where: { id: s.id } })).not.toBeNull();
  });

  it("CASCADE: deleting a service removes its FAQs and relations", async () => {
    const a = await db.service.create({ data: { categoryId, title: "A", slug: `${tag}-cas-a`, summary: "x" } });
    const b = await db.service.create({ data: { categoryId, title: "B", slug: `${tag}-cas-b`, summary: "x" } });
    await db.faq.create({ data: { question: "Q?????", answer: "A?????", category: tag, serviceId: a.id } });
    await db.serviceRelation.create({ data: { serviceId: a.id, relatedId: b.id } });
    await db.service.delete({ where: { id: a.id } });
    expect(await db.faq.count({ where: { serviceId: a.id } })).toBe(0);
    expect(await db.serviceRelation.count({ where: { OR: [{ serviceId: a.id }, { relatedId: a.id }] } })).toBe(0);
  });

  it("RESTRICT: a user with posts cannot be deleted", async () => {
    await db.post.create({ data: { title: "Owned", slug: `${tag}-owned`, blocks: [], authorId: userId } });
    await expect(db.user.delete({ where: { id: userId } })).rejects.toThrow();
  });

  it("CASCADE: deleting a user removes sessions", async () => {
    const u = await db.user.create({ data: { email: `${tag}-sess@test.local`, name: "S", passwordHash: "x" } });
    await db.session.create({ data: { userId: u.id, expiresAt: new Date(Date.now() + 1000) } });
    await db.user.delete({ where: { id: u.id } });
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
  });

  it("user email is unique", async () => {
    await expect(db.user.create({ data: { email: `${tag}@test.local`, name: "Dup", passwordHash: "x" } })).rejects.toThrow();
  });

  it("transactions roll back completely on failure", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await tx.page.create({ data: { title: "T", slug: `${tag}-rollback`, blocks: [] } });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await db.page.findUnique({ where: { slug: `${tag}-rollback` } })).toBeNull();
  });
});

describe("leads", () => {
  it("stores a lead with defaults and filters by status", async () => {
    const lead = await db.lead.create({ data: { firstName: "T", email: `${tag}@lead.local`, message: "Hello there friend" } });
    expect(lead.status).toBe("NEW");
    expect(await db.lead.count({ where: { email: `${tag}@lead.local`, status: "NEW" } })).toBe(1);
  });

  it("rejects an invalid status value at the database level", async () => {
    await expect(db.lead.create({ data: { firstName: "T", email: `${tag}@bad.local`, message: "Hello there", status: "HACKED" as never } })).rejects.toThrow();
  });
});

describe("rate limiter (persistent)", () => {
  it("blocks after the limit and survives across calls", async () => {
    const key = `${tag}:rl`;
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await rateLimit.hitRateLimit(key, 3, 60)).allowed);
    expect(results).toEqual([true, true, true, false]);
    await rateLimit.clearRateLimit(key);
    expect((await rateLimit.hitRateLimit(key, 3, 60)).allowed).toBe(true);
  });
});

describe("media", () => {
  it("stores bytes in a separate blob table and guards deletion while in use", async () => {
    const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "#053620" } }).png().toBuffer();
    const media = await store.saveMedia(png, { fileName: "t.png", folder: tag, uploadedById: userId });
    expect((await db.mediaBlob.findUnique({ where: { mediaId: media.id } }))?.data.length).toBeGreaterThan(0);

    expect(await usage.findMediaUsage(media.id)).toEqual([]);
    const page = await db.page.create({ data: { title: "M", slug: `${tag}-media`, blocks: [{ type: "image", mediaId: media.id, alt: "x", caption: "" }] } });
    expect((await usage.findMediaUsage(media.id)).join()).toContain("content image");

    await db.page.delete({ where: { id: page.id } });
    await db.page.create({ data: { title: "M2", slug: `${tag}-media2`, blocks: [], featuredMediaId: media.id } });
    expect((await usage.findMediaUsage(media.id)).join()).toContain("featured image");

    // Deleting media that is only referenced via SET NULL must not delete the page.
    await db.media.delete({ where: { id: media.id } });
    expect((await db.page.findUnique({ where: { slug: `${tag}-media2` } }))?.featuredMediaId).toBeNull();
    expect(await db.mediaBlob.count({ where: { mediaId: media.id } })).toBe(0);
  });
});
