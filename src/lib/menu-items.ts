import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/action";
import { isSafeHref } from "@/lib/safe-url";

const itemSchema = z.object({
  key: z.string().max(40),
  parentKey: z.string().max(40).nullable(),
  label: z.string().trim().min(1, "Every item needs a label").max(100),
  href: z.string().trim().max(500).refine(isSafeHref, "Use /path, https://, mailto: or tel:"),
  openInNewTab: z.boolean(),
  isActive: z.boolean(),
});

export type MenuItemInput = z.infer<typeof itemSchema>;

/** Parses and validates the JSON a MenuItemsField submits. `label` names the menu in error messages. */
export function parseMenuItems(json: FormDataEntryValue | null, label = ""): MenuItemInput[] {
  const where = label ? `${label}: ` : "";
  let raw: unknown;
  try {
    raw = JSON.parse(String(json ?? "[]"));
  } catch {
    throw new AppError("The menu could not be read. Reload and try again.");
  }
  const parsed = z.array(itemSchema).max(40).safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const idx = typeof issue.path[0] === "number" ? issue.path[0] + 1 : null;
    throw new AppError(`${where}${idx ? `Item ${idx}: ` : ""}${issue.message}`);
  }
  const items = parsed.data;
  const keys = new Set(items.map((i) => i.key));
  for (const i of items) {
    if (i.parentKey && (!keys.has(i.parentKey) || i.parentKey === i.key)) throw new AppError(`${where}An item has an invalid parent.`);
    const parent = items.find((p) => p.key === i.parentKey);
    if (parent?.parentKey) throw new AppError(`${where}Menus support one level of sub-items only.`);
  }
  return items;
}

/** Replaces every item of a menu with `items` (parents are created first so children can point at them). */
export async function replaceMenuItems(tx: Prisma.TransactionClient, menuId: number, items: MenuItemInput[]) {
  await tx.menuItem.deleteMany({ where: { menuId } });
  const idByKey = new Map<string, number>();
  for (const pass of [true, false]) {
    for (const [order, i] of items.entries()) {
      if (Boolean(i.parentKey) === pass) continue;
      const row = await tx.menuItem.create({
        data: { menuId, label: i.label, href: i.href, sortOrder: order, openInNewTab: i.openInNewTab, isActive: i.isActive, parentId: i.parentKey ? (idByKey.get(i.parentKey) ?? null) : null },
      });
      idByKey.set(i.key, row.id);
    }
  }
}
