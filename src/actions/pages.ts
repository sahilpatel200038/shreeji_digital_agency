"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, assertNotLockedByOthers, lockKey } from "@/lib/edit-lock";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { seoFromForm, saveSeo } from "@/lib/validation/seo";
import { fromDatetimeLocal, parseBlocksField, resolveSlug } from "@/lib/content-helpers";
import { flashOnError, redirectOnSlugChange } from "@/lib/admin-actions";

const pageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  template: z.enum(["DEFAULT", "CONTACT"]),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  excerpt: z.string().trim().max(500),
  featuredMediaId: z.number().int().positive().nullable(),
});

export async function savePage(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    if (id) await assertEditLocks(user, [lockKey.page(id)], fd);

    const media = Number(fd.get("featuredMediaId"));
    const parsed = pageSchema.safeParse({
      title: fd.get("title") ?? "",
      template: fd.get("template") ?? "DEFAULT",
      status: fd.get("status") ?? "DRAFT",
      excerpt: fd.get("excerpt") ?? "",
      featuredMediaId: Number.isInteger(media) && media > 0 ? media : null,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    const blocks = parseBlocksField(fd.get("blocks"));
    const publishedAtInput = fromDatetimeLocal(fd.get("publishedAt"));

    const saved = await db.$transaction(async (tx) => {
      const existing = id ? await tx.page.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new AppError("This page no longer exists.");

      const rawSlug = String(fd.get("slug") ?? "");
      // System pages (about, contact, legal) keep their URL and template.
      const slug = existing?.isSystem
        ? existing.slug
        : await resolveSlug(tx, "page", rawSlug, parsed.data.title, id || undefined, { checkReserved: !existing || existing.slug !== slugOf(rawSlug, parsed.data.title) });
      const template = existing?.isSystem ? existing.template : parsed.data.template;

      const seoId = await saveSeo(tx, existing?.seoId, seo.data);
      const wasPublished = existing?.status === "PUBLISHED";
      const publishedAt = parsed.data.status === "PUBLISHED" ? (publishedAtInput ?? existing?.publishedAt ?? new Date()) : (publishedAtInput ?? existing?.publishedAt ?? null);

      const data = {
        title: parsed.data.title,
        slug,
        template,
        excerpt: parsed.data.excerpt || null,
        blocks,
        featuredMediaId: parsed.data.featuredMediaId,
        status: parsed.data.status,
        publishedAt,
        seoId,
      };
      const row = existing ? await tx.page.update({ where: { id }, data }) : await tx.page.create({ data });
      if (existing && wasPublished && existing.slug !== slug) await redirectOnSlugChange(tx, "", existing.slug, slug);
      const { blocks: oldBlocks, ...oldRest } = existing ?? ({} as Record<string, unknown>);
      const changes = existing
        ? diffFields({ ...oldRest, content: JSON.stringify(oldBlocks) }, { ...data, content: JSON.stringify(blocks) }, ["title", "slug", "template", "excerpt", "featuredMediaId", "status", "publishedAt", "content"])
        : null;
      return { id: row.id, changes };
    });

    await audit(user.id, id ? "page.update" : "page.create", "page", saved.id, String(parsed.data.title), { entityName: String(parsed.data.title), before: saved.changes?.before, after: saved.changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/pages/${saved.id}?msg=${encodeURIComponent("Page created")}`);
    return { ok: true, message: "Page saved." };
  });
}

function slugOf(raw: string, fallback: string) {
  return (raw.trim() || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function deletePage(fd: FormData): Promise<void> {
  await flashOnError("/admin/pages", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.page(id)]);
    const page = await db.page.findUnique({ where: { id } });
    if (!page) throw new AppError("That page no longer exists.");
    if (page.isSystem) await requirePermission("system-page:delete");
    await db.$transaction(async (tx) => {
      await tx.page.delete({ where: { id } });
      if (page.seoId) await tx.seoMeta.delete({ where: { id: page.seoId } }).catch(() => {});
    });
    await audit(user.id, "page.delete", "page", id, page.title);
    revalidateSite();
    return `Deleted “${page.title}”`;
  });
}

export async function setPageStatus(fd: FormData): Promise<void> {
  await flashOnError("/admin/pages", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.page(id)]);
    const status = fd.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const page = await db.page.findUnique({ where: { id } });
    if (!page) throw new AppError("That page no longer exists.");
    await db.page.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? (page.publishedAt ?? new Date()) : page.publishedAt } });
    await audit(user.id, status === "PUBLISHED" ? "page.publish" : "page.unpublish", "page", id, page.title);
    revalidateSite();
    return status === "PUBLISHED" ? "Page published" : "Page unpublished";
  });
}
