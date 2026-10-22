"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { seoFromForm, saveSeo } from "@/lib/validation/seo";
import { fromDatetimeLocal, parseBlocksField, resolveSlug } from "@/lib/content-helpers";
import { readingMinutes } from "@/lib/blocks/schema";
import { slugify } from "@/lib/slug";
import { flashOnError, redirectOnSlugChange } from "@/lib/admin-actions";

const postSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  excerpt: z.string().trim().max(500),
  featuredMediaId: z.number().int().positive().nullable(),
  categoryId: z.number().int().positive().nullable(),
});

export async function savePost(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    const media = Number(fd.get("featuredMediaId"));
    const cat = Number(fd.get("categoryId"));
    const parsed = postSchema.safeParse({
      title: fd.get("title") ?? "",
      status: fd.get("status") ?? "DRAFT",
      excerpt: fd.get("excerpt") ?? "",
      featuredMediaId: Number.isInteger(media) && media > 0 ? media : null,
      categoryId: Number.isInteger(cat) && cat > 0 ? cat : null,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    const blocks = parseBlocksField(fd.get("blocks"));
    const publishedAtInput = fromDatetimeLocal(fd.get("publishedAt"));
    const tagNames = [...new Set(String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);

    const saved = await db.$transaction(async (tx) => {
      const existing = id ? await tx.post.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new AppError("This post no longer exists.");
      if (parsed.data.categoryId && !(await tx.postCategory.findUnique({ where: { id: parsed.data.categoryId } }))) {
        throw new AppError("That category no longer exists.", { categoryId: ["Choose a valid category"] });
      }
      const slug = await resolveSlug(tx, "post", String(fd.get("slug") ?? ""), parsed.data.title, id || undefined);
      const seoId = await saveSeo(tx, existing?.seoId, seo.data);
      const publishedAt = parsed.data.status === "PUBLISHED" ? (publishedAtInput ?? existing?.publishedAt ?? new Date()) : (publishedAtInput ?? existing?.publishedAt ?? null);
      const data = {
        title: parsed.data.title,
        slug,
        excerpt: parsed.data.excerpt || null,
        blocks,
        featuredMediaId: parsed.data.featuredMediaId,
        categoryId: parsed.data.categoryId,
        status: parsed.data.status,
        publishedAt,
        readingMinutes: readingMinutes(blocks),
        seoId,
      };
      const row = existing ? await tx.post.update({ where: { id }, data }) : await tx.post.create({ data: { ...data, authorId: user.id } });

      await tx.postTag.deleteMany({ where: { postId: row.id } });
      for (const name of tagNames) {
        const tagSlug = slugify(name);
        if (!tagSlug) continue;
        const tag = await tx.tag.upsert({ where: { slug: tagSlug }, update: {}, create: { name, slug: tagSlug } });
        await tx.postTag.create({ data: { postId: row.id, tagId: tag.id } });
      }
      if (existing && existing.status === "PUBLISHED" && existing.slug !== slug) await redirectOnSlugChange(tx, "/blog", existing.slug, slug);
      const changes = existing ? diffFields({ ...existing, content: JSON.stringify(existing.blocks) }, { ...data, content: JSON.stringify(blocks) }, ["title", "slug", "excerpt", "featuredMediaId", "categoryId", "status", "publishedAt", "content"]) : null;
      return { id: row.id, changes };
    });

    await audit(user.id, id ? "post.update" : "post.create", "post", saved.id, parsed.data.title, { before: saved.changes?.before, after: saved.changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/posts/${saved.id}?msg=${encodeURIComponent("Post created")}`);
    return { ok: true, message: "Post saved." };
  });
}

export async function deletePost(fd: FormData): Promise<void> {
  await flashOnError("/admin/posts", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    const post = await db.post.findUnique({ where: { id } });
    if (!post) throw new AppError("That post no longer exists.");
    await db.$transaction(async (tx) => {
      await tx.post.delete({ where: { id } });
      if (post.seoId) await tx.seoMeta.delete({ where: { id: post.seoId } }).catch(() => {});
    });
    await audit(user.id, "post.delete", "post", id, post.title);
    revalidateSite();
    return `Deleted “${post.title}”`;
  });
}

export async function setPostStatus(fd: FormData): Promise<void> {
  await flashOnError("/admin/posts", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    const status = fd.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const post = await db.post.findUnique({ where: { id } });
    if (!post) throw new AppError("That post no longer exists.");
    await db.post.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? (post.publishedAt ?? new Date()) : post.publishedAt } });
    await audit(user.id, status === "PUBLISHED" ? "post.publish" : "post.unpublish", "post", id, post.title);
    revalidateSite();
    return status === "PUBLISHED" ? "Post published" : "Post unpublished";
  });
}

const categorySchema = z.object({ name: z.string().trim().min(1, "Name is required").max(100) });

export async function createPostCategory(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const parsed = categorySchema.safeParse({ name: fd.get("name") ?? "" });
    if (!parsed.success) throw new AppError("Enter a category name.", fieldErrorsFrom(parsed.error));
    const slug = slugify(parsed.data.name);
    if (!slug) throw new AppError("Enter a valid category name.");
    if (await db.postCategory.findUnique({ where: { slug } })) throw new AppError("That category already exists.");
    const c = await db.postCategory.create({ data: { name: parsed.data.name, slug } });
    await audit(user.id, "post-category.create", "post-category", c.id, c.name);
    revalidateSite();
    return { ok: true, message: `Category “${c.name}” added. Reload the page to select it.` };
  });
}
