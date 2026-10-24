"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, assertNotLockedByOthers, lockKey } from "@/lib/edit-lock";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { flashOnError } from "@/lib/admin-actions";
import { slugify } from "@/lib/slug";

const mediaId = (fd: FormData, key = "mediaId") => {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

/* ---------------- Projects ---------------- */
const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  category: z.enum(["DIGITAL_MARKETING", "WEB_DEVELOPMENT", "WEB_APPLICATION"]),
  summary: z.string().trim().max(500),
  externalUrl: z.string().trim().max(500).refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Must start with https://"),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  sortOrder: z.number().int().min(0).max(9999),
});

export async function saveProject(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    if (id) await assertEditLocks(user, [lockKey.project(id)], fd);
    const parsed = projectSchema.safeParse({
      name: fd.get("name") ?? "",
      category: fd.get("category"),
      summary: fd.get("summary") ?? "",
      externalUrl: fd.get("externalUrl") ?? "",
      status: fd.get("status") ?? "PUBLISHED",
      sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const tags = String(fd.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
    const slug = slugify(parsed.data.name);
    if (!slug) throw new AppError("Enter a valid name.");
    const clash = await db.project.count({ where: { slug, ...(id ? { NOT: { id } } : {}) } });
    if (clash) throw new AppError("A project with this name already exists.", { name: ["Choose a different name"] });
    const data = { ...parsed.data, slug, tags, summary: parsed.data.summary || null, externalUrl: parsed.data.externalUrl || null, mediaId: mediaId(fd) };
    const before = id ? await db.project.findUnique({ where: { id } }) : null;
    const row = id ? await db.project.update({ where: { id }, data }) : await db.project.create({ data });
    const changes = before ? diffFields(before, row, ["name", "slug", "category", "summary", "externalUrl", "status", "sortOrder", "mediaId", "tags"]) : null;
    await audit(user.id, id ? "project.update" : "project.create", "project", row.id, row.name, { before: changes?.before, after: changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/projects/${row.id}?msg=${encodeURIComponent("Project created")}`);
    return { ok: true, message: "Project saved." };
  });
}

export async function deleteProject(fd: FormData): Promise<void> {
  await flashOnError("/admin/projects", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.project(id)]);
    const p = await db.project.findUnique({ where: { id } });
    if (!p) throw new AppError("That project no longer exists.");
    await db.project.delete({ where: { id } });
    await audit(user.id, "project.delete", "project", id, p.name);
    revalidateSite();
    return `Deleted “${p.name}”`;
  });
}

/* ---------------- Testimonials ---------------- */
const testimonialSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  location: z.string().trim().max(120),
  company: z.string().trim().max(160),
  quote: z.string().trim().min(10, "Quote is required").max(1500),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  sortOrder: z.number().int().min(0).max(9999),
});

export async function saveTestimonial(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    if (id) await assertEditLocks(user, [lockKey.testimonial(id)], fd);
    const parsed = testimonialSchema.safeParse({
      name: fd.get("name") ?? "",
      location: fd.get("location") ?? "",
      company: fd.get("company") ?? "",
      quote: fd.get("quote") ?? "",
      status: fd.get("status") ?? "DRAFT",
      sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const isVerified = fd.get("isVerified") === "on";
    const before = id ? await db.testimonial.findUnique({ where: { id } }) : null;
    const row = id
      ? await db.testimonial.update({ where: { id }, data: { ...parsed.data, isVerified } })
      : await db.testimonial.create({ data: { ...parsed.data, isVerified } });
    const changes = before ? diffFields(before, row, ["name", "location", "company", "quote", "isVerified", "status", "sortOrder"]) : null;
    await audit(user.id, id ? "testimonial.update" : "testimonial.create", "testimonial", row.id, `${row.name} (verified: ${isVerified})`, { entityName: row.name, before: changes?.before, after: changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/testimonials/${row.id}?msg=${encodeURIComponent("Testimonial created")}`);
    return { ok: true, message: "Testimonial saved." };
  });
}

export async function deleteTestimonial(fd: FormData): Promise<void> {
  await flashOnError("/admin/testimonials", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.testimonial(id)]);
    const t = await db.testimonial.findUnique({ where: { id } });
    if (!t) throw new AppError("That testimonial no longer exists.");
    await db.testimonial.delete({ where: { id } });
    await audit(user.id, "testimonial.delete", "testimonial", id, t.name);
    revalidateSite();
    return "Testimonial deleted";
  });
}

/* ---------------- FAQs ---------------- */
const faqSchema = z.object({
  question: z.string().trim().min(5, "Question is required").max(500),
  answer: z.string().trim().min(5, "Answer is required").max(3000),
  category: z.string().trim().min(1).max(60),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  sortOrder: z.number().int().min(0).max(9999),
});

export async function saveFaq(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    if (id) await assertEditLocks(user, [lockKey.faq(id)], fd);
    const parsed = faqSchema.safeParse({
      question: fd.get("question") ?? "",
      answer: fd.get("answer") ?? "",
      category: fd.get("category") || "General",
      status: fd.get("status") ?? "PUBLISHED",
      sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const showOnHome = fd.get("showOnHome") === "on";
    const before = id ? await db.faq.findUnique({ where: { id } }) : null;
    const row = id ? await db.faq.update({ where: { id }, data: { ...parsed.data, showOnHome } }) : await db.faq.create({ data: { ...parsed.data, showOnHome } });
    const changes = before ? diffFields(before, row, ["question", "answer", "category", "status", "sortOrder", "showOnHome"]) : null;
    await audit(user.id, id ? "faq.update" : "faq.create", "faq", row.id, row.question.slice(0, 100), { before: changes?.before, after: changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/faqs/${row.id}?msg=${encodeURIComponent("FAQ created")}`);
    return { ok: true, message: "FAQ saved." };
  });
}

export async function deleteFaq(fd: FormData): Promise<void> {
  await flashOnError("/admin/faqs", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.faq(id)]);
    const f = await db.faq.findUnique({ where: { id } });
    if (!f) throw new AppError("That FAQ no longer exists.");
    await db.faq.delete({ where: { id } });
    await audit(user.id, "faq.delete", "faq", id, f.question.slice(0, 100));
    revalidateSite();
    return "FAQ deleted";
  });
}

