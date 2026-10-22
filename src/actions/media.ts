"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { flashOnError } from "@/lib/admin-actions";
import { MediaError } from "@/lib/media/process";
import { replaceMediaFile } from "@/lib/media/store";
import { findMediaUsage } from "@/lib/media/usage";

const metaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(255),
  altText: z.string().trim().max(500),
  folder: z.string().trim().regex(/^[a-z0-9-_]*$/i, "Letters, numbers, - and _ only").max(80),
});

export async function updateMedia(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("media:write");
    const id = Number(fd.get("id"));
    const parsed = metaSchema.safeParse({ title: fd.get("title") ?? "", altText: fd.get("altText") ?? "", folder: fd.get("folder") ?? "general" });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    if (!(await db.media.findUnique({ where: { id }, select: { id: true } }))) throw new AppError("That file no longer exists.");
    await db.media.update({ where: { id }, data: { ...parsed.data, folder: parsed.data.folder || "general" } });
    await audit(user.id, "media.update", "media", id, parsed.data.title);
    revalidateSite();
    return { ok: true, message: "Details saved." };
  });
}

export async function replaceMedia(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("media:write");
    const id = Number(fd.get("id"));
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("Choose an image to upload.");
    if (!(await db.media.findUnique({ where: { id }, select: { id: true } }))) throw new AppError("That file no longer exists.");
    try {
      await replaceMediaFile(id, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
      if (err instanceof MediaError) throw new AppError(err.message, { file: [err.message] });
      throw err;
    }
    await audit(user.id, "media.replace", "media", id, file.name.slice(0, 100));
    revalidateSite();
    return { ok: true, message: "File replaced. Existing links now show the new image." };
  });
}

export async function deleteMedia(fd: FormData): Promise<void> {
  await flashOnError("/admin/media", async () => {
    const user = await requirePermission("media:delete");
    const id = Number(fd.get("id"));
    const m = await db.media.findUnique({ where: { id } });
    if (!m) throw new AppError("That file no longer exists.");
    const used = await findMediaUsage(id);
    if (used.length > 0) throw new AppError(`Cannot delete: in use by ${used.slice(0, 3).join("; ")}${used.length > 3 ? ` and ${used.length - 3} more` : ""}.`);
    await db.media.delete({ where: { id } });
    await audit(user.id, "media.delete", "media", id, m.fileName);
    revalidateSite();
    return "File deleted";
  });
}
