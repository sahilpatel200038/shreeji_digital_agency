"use server";

import { db } from "@/lib/db";
import { AppError, revalidateSite, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, lockKey } from "@/lib/edit-lock";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { parseMenuItems, replaceMenuItems } from "@/lib/menu-items";

export async function saveMenu(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("menus:write");
    const menuId = Number(fd.get("menuId"));
    const menu = await db.menu.findUnique({ where: { id: menuId } });
    if (!menu) throw new AppError("That menu no longer exists.");
    await assertEditLocks(user, [lockKey.menu(menu.key)], fd);

    const items = parseMenuItems(fd.get("items"));
    await db.$transaction((tx) => replaceMenuItems(tx, menuId, items));
    await audit(user.id, "menu.update", "menu", menuId, `${menu.name}: ${items.length} item(s)`);
    revalidateSite();
    return { ok: true, message: "Menu saved." };
  });
}
