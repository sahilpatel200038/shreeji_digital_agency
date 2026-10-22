"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { isSafeHref } from "@/lib/safe-url";

const itemSchema = z.object({
  key: z.string().max(40),
  parentKey: z.string().max(40).nullable(),
  label: z.string().trim().min(1, "Every item needs a label").max(100),
  href: z.string().trim().max(500).refine(isSafeHref, "Use /path, https://, mailto: or tel:"),
  openInNewTab: z.boolean(),
  isActive: z.boolean(),
});

export async function saveMenu(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("menus:write");
    const menuId = Number(fd.get("menuId"));
    const menu = await db.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new AppError("That menu no longer exists.");

    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("items") ?? "[]"));
    } catch {
      throw new AppError("The menu could not be read. Reload and try again.");
    }
    const parsed = z.array(itemSchema).max(40).safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const idx = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null;
      throw new AppError(`${idx ? `Item ${idx}: ` : ""}${issue.message}`);
    }
    const items = parsed.data;
    const keys = new Set(items.map((i) => i.key));
    for (const i of items) {
      if (i.parentKey && (!keys.has(i.parentKey) || i.parentKey === i.key)) throw new AppError("An item has an invalid parent.");
      const parent = items.find((p) => p.key === i.parentKey);
      if (parent?.parentKey) throw new AppError("Menus support one level of sub-items only.");
    }

    await db.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({ where: { menuId } });
      const idByKey = new Map<string, number>();
      // Create parents first so children can reference them.
      for (const pass of [true, false]) {
        for (const [order, i] of items.entries()) {
          if (Boolean(i.parentKey) === pass) continue;
          const row = await tx.menuItem.create({
            data: { menuId, label: i.label, href: i.href, sortOrder: order, openInNewTab: i.openInNewTab, isActive: i.isActive, parentId: i.parentKey ? (idByKey.get(i.parentKey) ?? null) : null },
          });
          idByKey.set(i.key, row.id);
        }
      }
    });
    await audit(user.id, "menu.update", "menu", menuId, `${menu.name}: ${items.length} item(s)`);
    revalidateSite();
    return { ok: true, message: "Menu saved." };
  });
}
