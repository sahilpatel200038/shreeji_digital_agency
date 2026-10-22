"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { seoFromForm, saveSeo } from "@/lib/validation/seo";
import { fromDatetimeLocal, parseBlocksField, parseLines, parsePairs, resolveSlug } from "@/lib/content-helpers";
import { flashOnError, redirectOnSlugChange } from "@/lib/admin-actions";
import { servicePageOptionsFromForm } from "@/lib/service-page";

const serviceSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  categoryId: z.number().int().positive("Choose a category"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  summary: z.string().trim().min(1, "Summary is required").max(500),
  icon: z.string().trim().max(40),
  heroHeading: z.string().trim().max(255),
  intro: z.string().trim().max(5000),
  sortOrder: z.number().int().min(0).max(9999),
  featuredMediaId: z.number().int().positive().nullable(),
});

export async function saveService(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    const media = Number(fd.get("featuredMediaId"));
    const parsed = serviceSchema.safeParse({
      title: fd.get("title") ?? "",
      categoryId: Number(fd.get("categoryId")),
      status: fd.get("status") ?? "DRAFT",
      summary: fd.get("summary") ?? "",
      icon: fd.get("icon") ?? "sparkles",
      heroHeading: fd.get("heroHeading") ?? "",
      intro: fd.get("intro") ?? "",
      sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
      featuredMediaId: Number.isInteger(media) && media > 0 ? media : null,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    const options = servicePageOptionsFromForm(fd);
    if (!options.success) {
      const fe = fieldErrorsFrom(options.error);
      throw new AppError("Please fix the highlighted fields.", Object.fromEntries(Object.entries(fe).map(([k, v]) => [`po_${k}`, v])));
    }
    const faqs = parsePairs(String(fd.get("faqs") ?? ""), ["question", "answer"]).map((f) => ({ question: f.question.slice(0, 500), answer: f.answer }));
    const blocks = parseBlocksField(fd.get("blocks"));
    const benefits = parsePairs(String(fd.get("benefits") ?? ""), ["title", "text"]);
    const process = parsePairs(String(fd.get("process") ?? ""), ["title", "text"]);
    const included = parseLines(String(fd.get("included") ?? ""));
    const relatedIds = [...new Set(fd.getAll("related").map(Number).filter((n) => Number.isInteger(n) && n > 0 && n !== id))];
    const publishedAtInput = fromDatetimeLocal(fd.get("publishedAt"));

    const saved = await db.$transaction(async (tx) => {
      const existing = id ? await tx.service.findUnique({ where: { id } }) : null;
      if (id && !existing) throw new AppError("This service no longer exists.");
      if (!(await tx.serviceCategory.findUnique({ where: { id: parsed.data.categoryId } }))) throw new AppError("That category no longer exists.");
      const slug = await resolveSlug(tx, "service", String(fd.get("slug") ?? ""), parsed.data.title, id || undefined);
      const seoId = await saveSeo(tx, existing?.seoId, seo.data);
      const publishedAt = parsed.data.status === "PUBLISHED" ? (publishedAtInput ?? existing?.publishedAt ?? new Date()) : (publishedAtInput ?? existing?.publishedAt ?? null);
      const data = {
        title: parsed.data.title,
        slug,
        categoryId: parsed.data.categoryId,
        summary: parsed.data.summary,
        icon: parsed.data.icon || "sparkles",
        heroHeading: parsed.data.heroHeading || null,
        intro: parsed.data.intro || null,
        benefits,
        included,
        process,
        blocks,
        pageOptions: options.data,
        featuredMediaId: parsed.data.featuredMediaId,
        status: parsed.data.status,
        publishedAt,
        sortOrder: parsed.data.sortOrder,
        seoId,
      };
      const row = existing ? await tx.service.update({ where: { id }, data }) : await tx.service.create({ data });

      await tx.serviceRelation.deleteMany({ where: { serviceId: row.id } });
      const valid = await tx.service.findMany({ where: { id: { in: relatedIds } }, select: { id: true } });
      if (valid.length) await tx.serviceRelation.createMany({ data: valid.map((v) => ({ serviceId: row.id, relatedId: v.id })) });

      // This service's own FAQs (serviceId = row.id) are replaced as a set; site-wide FAQs (serviceId null) are never touched.
      const oldFaqs = (await tx.faq.findMany({ where: { serviceId: row.id }, orderBy: { sortOrder: "asc" } })).map((f) => ({ question: f.question, answer: f.answer }));
      await tx.faq.deleteMany({ where: { serviceId: row.id } });
      if (faqs.length) await tx.faq.createMany({ data: faqs.map((f, i) => ({ ...f, category: "Services", serviceId: row.id, sortOrder: i + 1, status: "PUBLISHED" as const })) });

      if (existing && existing.status === "PUBLISHED" && existing.slug !== slug) await redirectOnSlugChange(tx, "/services", existing.slug, slug);
      const changes = existing ? diffFields({ ...existing, content: JSON.stringify({ blocks: existing.blocks, benefits: existing.benefits, included: existing.included, process: existing.process, pageOptions: existing.pageOptions, faqs: oldFaqs }) }, { ...data, content: JSON.stringify({ blocks, benefits, included, process, pageOptions: options.data, faqs }) }, ["title", "slug", "categoryId", "summary", "icon", "heroHeading", "intro", "featuredMediaId", "status", "publishedAt", "sortOrder", "content"]) : null;
      return { id: row.id, changes };
    });

    await audit(user.id, id ? "service.update" : "service.create", "service", saved.id, parsed.data.title, { before: saved.changes?.before, after: saved.changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/services/${saved.id}?msg=${encodeURIComponent("Service created")}`);
    return { ok: true, message: "Service saved." };
  });
}

/** The list the action was started from (Services or Pages). Anything else falls back to Services. */
const returnTo = (fd: FormData) => (fd.get("returnTo") === "/admin/pages" ? "/admin/pages" : "/admin/services");

export async function deleteService(fd: FormData): Promise<void> {
  await flashOnError(returnTo(fd), async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    const s = await db.service.findUnique({ where: { id } });
    if (!s) throw new AppError("That service no longer exists.");
    await db.$transaction(async (tx) => {
      await tx.service.delete({ where: { id } });
      if (s.seoId) await tx.seoMeta.delete({ where: { id: s.seoId } }).catch(() => {});
    });
    await audit(user.id, "service.delete", "service", id, s.title);
    revalidateSite();
    return `Deleted “${s.title}”`;
  });
}

export async function moveService(fd: FormData): Promise<void> {
  await flashOnError("/admin/services", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    const dir = fd.get("dir") === "up" ? -1 : 1;
    await db.$transaction(async (tx) => {
      const all = await tx.service.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
      const i = all.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j], all[i]];
      for (const [idx, s] of all.entries()) await tx.service.update({ where: { id: s.id }, data: { sortOrder: idx + 1 } });
    });
    await audit(user.id, "service.reorder", "service", id, `Moved ${dir < 0 ? "up" : "down"}`);
    revalidateSite();
    return "Order updated";
  });
}

export async function setServiceStatus(fd: FormData): Promise<void> {
  await flashOnError(returnTo(fd), async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    const status = fd.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const s = await db.service.findUnique({ where: { id } });
    if (!s) throw new AppError("That service no longer exists.");
    await db.service.update({ where: { id }, data: { status, publishedAt: status === "PUBLISHED" ? (s.publishedAt ?? new Date()) : s.publishedAt } });
    await audit(user.id, status === "PUBLISHED" ? "service.publish" : "service.unpublish", "service", id, s.title);
    revalidateSite();
    return status === "PUBLISHED" ? "Service published" : "Service unpublished";
  });
}
