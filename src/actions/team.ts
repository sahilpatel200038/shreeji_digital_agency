"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
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
    const m = await db.teamMember.findUnique({ where: { id } });
    if (!m) throw new AppError("That team member no longer exists.");
    await db.teamMember.delete({ where: { id } });
    await audit(user.id, "team.delete", "team", id, `${m.name} (${m.role})`, { entityName: m.name });
    revalidateSite();
    return `Removed “${m.name}”`;
  });
}

export async function setTeamStatus(fd: FormData): Promise<void> {
  await flashOnError("/admin/team", async () => {
    const user = await requirePermission("content:write");
    const id = Number(fd.get("id"));
    const status = fd.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
    const m = await db.teamMember.findUnique({ where: { id } });
    if (!m) throw new AppError("That team member no longer exists.");
    await db.teamMember.update({ where: { id }, data: { status } });
    await audit(user.id, status === "PUBLISHED" ? "team.publish" : "team.unpublish", "team", id, `${m.name} (${m.role})`, { entityName: m.name, before: { status: m.status }, after: { status } });
    revalidateSite();
    return status === "PUBLISHED" ? "Team member shown on the site" : "Team member hidden";
  });
}
