"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { flashOnError } from "@/lib/admin-actions";
import { isSafeRedirectTarget, normalizePath } from "@/lib/safe-url";

const schema = z.object({
  fromPath: z.string().trim().min(1, "Required").max(500).refine((v) => v.startsWith("/") && !v.startsWith("//"), "Must be a path starting with /").refine((v) => !v.startsWith("/admin") && !v.startsWith("/api"), "Admin and API paths cannot be redirected"),
  toPath: z.string().trim().min(1, "Required").max(500).refine(isSafeRedirectTarget, "Use an internal /path or an https:// URL"),
  statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]),
});

export async function saveRedirect(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("redirects:write");
    const parsed = schema.safeParse({ fromPath: fd.get("fromPath") ?? "", toPath: fd.get("toPath") ?? "", statusCode: Number(fd.get("statusCode") ?? 301) });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const from = normalizePath(parsed.data.fromPath);
    const to = parsed.data.toPath.startsWith("/") ? normalizePath(parsed.data.toPath) : parsed.data.toPath;
    if (from === to) throw new AppError("A redirect cannot point to itself.", { toPath: ["Source and target are the same"] });

    // Loop detection: follow the chain from the target; if it ever reaches `from` it would loop.
    let cursor = to;
    for (let hops = 0; hops < 10 && cursor.startsWith("/"); hops++) {
      if (cursor === from) throw new AppError("That redirect would create a loop.", { toPath: ["Creates a redirect loop"] });
      const next = await db.redirect.findFirst({ where: { fromPath: cursor, isActive: true } });
      if (!next) break;
      cursor = next.toPath.startsWith("/") ? normalizePath(next.toPath) : next.toPath;
    }

    const row = await db.redirect.upsert({
      where: { fromPath: from },
      create: { fromPath: from, toPath: to, statusCode: parsed.data.statusCode },
      update: { toPath: to, statusCode: parsed.data.statusCode, isActive: true },
    });
    await audit(user.id, "redirect.save", "redirect", row.id, `${from} → ${to} (${row.statusCode})`);
    revalidatePath("/admin/seo");
    return { ok: true, message: "Redirect saved. It takes effect within about 30 seconds." };
  });
}

export async function deleteRedirect(fd: FormData): Promise<void> {
  await flashOnError("/admin/seo", async () => {
    const user = await requirePermission("redirects:write");
    const id = Number(fd.get("id"));
    const r = await db.redirect.findUnique({ where: { id } });
    if (!r) throw new AppError("That redirect no longer exists.");
    await db.redirect.delete({ where: { id } });
    await audit(user.id, "redirect.delete", "redirect", id, `${r.fromPath} → ${r.toPath}`);
    revalidateSite();
    return "Redirect deleted";
  });
}

export async function toggleRedirect(fd: FormData): Promise<void> {
  await flashOnError("/admin/seo", async () => {
    const user = await requirePermission("redirects:write");
    const id = Number(fd.get("id"));
    const r = await db.redirect.findUnique({ where: { id } });
    if (!r) throw new AppError("That redirect no longer exists.");
    await db.redirect.update({ where: { id }, data: { isActive: !r.isActive } });
    revalidateSite();
    await audit(user.id, "redirect.toggle", "redirect", id, `${r.fromPath} → ${r.isActive ? "disabled" : "enabled"}`);
    return r.isActive ? "Redirect disabled" : "Redirect enabled";
  });
}
