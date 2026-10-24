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

const teamSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.string().trim().min(1, "Role is required").max(120),
  title: z.string().trim().max(160),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  sortOrder: z.number().int().min(0).max(9999),
});

export async function saveTeamMember(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id")) || 0;
    if (id) await assertEditLocks(user, [lockKey.team(id)], fd);
    const parsed = teamSchema.safeParse({
      name: fd.get("name") ?? "",
      role: fd.get("role") ?? "",
      title: fd.get("title") ?? "",
      status: fd.get("status") ?? "PUBLISHED",
      sortOrder: Number(fd.get("sortOrder") ?? 0) || 0,
    });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const photoRaw = Number(fd.get("photoId"));
    const photoId = Number.isInteger(photoRaw) && photoRaw > 0 ? photoRaw : null;
    if (photoId && !(await db.media.count({ where: { id: photoId, mimeType: { startsWith: "image/" } } }))) {
      throw new AppError("Choose a photo from the media library.", { photoId: ["Pick an image from the library"] });
    }

    const before = id ? await db.teamMember.findUnique({ where: { id } }) : null;
    if (id && !before) throw new AppError("This team member no longer exists.");
    const data = { ...parsed.data, photoId };
    const row = id ? await db.teamMember.update({ where: { id }, data }) : await db.teamMember.create({ data });
    const changes = before ? diffFields(before, row, ["name", "role", "title", "photoId", "status", "sortOrder"]) : null;
    await audit(user.id, id ? "team.update" : "team.create", "team", row.id, `${row.name} (${row.role})`, { entityName: row.name, before: changes?.before, after: changes?.after });
    revalidateSite();
    if (!id) redirect(`/admin/team/${row.id}?msg=${encodeURIComponent("Team member added")}`);
    return { ok: true, message: "Team member saved." };
  });
}

export async function deleteTeamMember(fd: FormData): Promise<void> {
  await flashOnError("/admin/team", async () => {
    const user = await requirePermission("content:delete");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.team(id)]);
    const m = await db.teamMember.findUnique({ where: { id } });
    if (!m) throw new AppError("That team member no longer exists.");
    await db.teamMember.delete({ where: { id } });
    await audit(user.id, "team.delete", "team", id, `${m.name} (${m.role})`, { entityName: m.name });
    revalidateSite();
    return `Removed “${m.name}”`;
  });
}

/** Moves a member one place up or down. Order numbers are renumbered 1..n so duplicates can never make "up" a no-op. */
export async function moveTeamMember(fd: FormData): Promise<void> {
  await flashOnError("/admin/team", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    const dir = fd.get("dir") === "up" ? -1 : 1;
    await assertNotLockedByOthers(user, [lockKey.team(id)]);
    await db.$transaction(async (tx) => {
      const all = await tx.teamMember.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
      const i = all.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j], all[i]];
      for (const [idx, m] of all.entries()) await tx.teamMember.update({ where: { id: m.id }, data: { sortOrder: idx + 1 } });
    });
    await audit(user.id, "team.reorder", "team", id, `Moved ${dir < 0 ? "up" : "down"}`);
    revalidateSite();
    return "Order updated";
  });
}

const sectionSchema = z.object({
  teamEyebrow: z.string().trim().max(60),
  teamTitle: z.string().trim().min(1, "A heading is required").max(120),
});

/** The label and heading above the team on the About page (stored with the page banner settings). */
export async function saveTeamSection(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("settings:write");
    await assertEditLocks(user, [lockKey.setting("banners")], fd);
    const parsed = sectionSchema.safeParse({ teamEyebrow: fd.get("teamEyebrow") ?? "", teamTitle: fd.get("teamTitle") ?? "" });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const prev = await db.setting.findUnique({ where: { key: "banners" } });
    const before = (prev?.value ?? {}) as Record<string, unknown>;
    const value = { ...before, ...parsed.data };
    await db.setting.upsert({ where: { key: "banners" }, create: { key: "banners", value, updatedById: user.id }, update: { value, updatedById: user.id } });
    const changes = diffFields(before, value, ["teamEyebrow", "teamTitle"]);
    await audit(user.id, "team.update", "team", "section", "Updated the team section heading", { entityName: "Team section", before: changes?.before, after: changes?.after });
    revalidateSite();
    return { ok: true, message: "Team section heading saved." };
  });
}

export async function setTeamStatus(fd: FormData): Promise<void> {
  await flashOnError("/admin/team", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    await assertNotLockedByOthers(user, [lockKey.team(id)]);
    const status = fd.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const m = await db.teamMember.findUnique({ where: { id } });
    if (!m) throw new AppError("That team member no longer exists.");
    await db.teamMember.update({ where: { id }, data: { status } });
    await audit(user.id, status === "PUBLISHED" ? "team.publish" : "team.unpublish", "team", id, `${m.name} (${m.role})`, { entityName: m.name, before: { status: m.status }, after: { status } });
    revalidateSite();
    return status === "PUBLISHED" ? "Team member shown on the site" : "Team member hidden";
  });
}
