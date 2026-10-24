"use server";

import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { assertEditLocks, lockKey } from "@/lib/edit-lock";
import { parseMenuItems, replaceMenuItems } from "@/lib/menu-items";
import { SETTING_SCHEMAS, type SettingGroup } from "@/lib/settings/schema";

/** Header and footer management: the settings, link lists, contact details and social links in one save each. */

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** The posted values for the listed fields only (never the whole form), merged over what is stored. */
function pick(prev: unknown, fd: FormData, fields: readonly string[], flags: readonly string[] = [], numbers: readonly string[] = []) {
  const raw: Record<string, unknown> = { ...((prev ?? {}) as Record<string, unknown>) };
  for (const k of fields) if (fd.has(k)) raw[k] = str(fd, k);
  for (const k of flags) raw[k] = fd.get(k) === "on";
  for (const k of numbers) if (fd.has(k)) raw[k] = Number(str(fd, k));
  return raw;
}

async function logoIdOf(fd: FormData): Promise<number | null> {
  const n = Number(fd.get("logoMediaId"));
  const id = Number.isInteger(n) && n > 0 ? n : null;
  if (id && (await db.media.count({ where: { id, mimeType: { startsWith: "image/" } } })) === 0) {
    throw new AppError("Choose a logo from the media library.", { logoMediaId: ["Pick an image from the library"] });
  }
  return id;
}

type Parsed = { key: SettingGroup; data: Record<string, unknown>; prev: Record<string, unknown> };

/** Validates every group before anything is written, so one bad field never leaves a half-saved header or footer. */
function validate(groups: { key: SettingGroup; prev: unknown; raw: Record<string, unknown> }[]): Parsed[] {
  const errors: Record<string, string[]> = {};
  const out: Parsed[] = [];
  for (const g of groups) {
    const res = SETTING_SCHEMAS[g.key].safeParse(g.raw);
    if (res.success) out.push({ key: g.key, data: res.data as Record<string, unknown>, prev: (g.prev ?? {}) as Record<string, unknown> });
    else Object.assign(errors, fieldErrorsFrom(res.error as z.ZodError));
  }
  if (Object.keys(errors).length > 0) throw new AppError("Please fix the highlighted fields.", errors);
  return out;
}

export async function saveHeader(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("settings:write");
    await requirePermission("menus:write");
    await assertEditLocks(user, [lockKey.chrome("header"), lockKey.setting("header"), lockKey.menu("header")], fd);

    const menu = await db.menu.findUnique({ where: { key: "header" } });
    if (!menu) throw new AppError("The header menu is missing. Run the seed script to create it.");
    const items = parseMenuItems(fd.get("menuItems"), "Navigation");
    const logoMediaId = await logoIdOf(fd);

    const prev = await db.setting.findUnique({ where: { key: "header" } });
    const raw = { ...pick(prev?.value, fd, ["brandName", "brandTagline", "ctaLabel", "ctaHref"], ["showCta", "ctaNewTab"]), logoMediaId };
    const [header] = validate([{ key: "header", prev: prev?.value, raw }]);
    if (header.data.showCta && (!header.data.ctaLabel || !header.data.ctaHref)) {
      const errors: Record<string, string[]> = {};
      if (!header.data.ctaLabel) errors.ctaLabel = ["Enter the button text, or switch the button off"];
      if (!header.data.ctaHref) errors.ctaHref = ["Enter where the button leads"];
      throw new AppError("Please fix the highlighted fields.", errors);
    }

    await db.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "header" },
        create: { key: "header", value: header.data as object, updatedById: user.id },
        update: { value: header.data as object, updatedById: user.id },
      });
      await replaceMenuItems(tx, menu.id, items);
    });
    const changes = diffFields(header.prev, header.data);
    await audit(user.id, "header.update", "header", "main", "Updated the site header", { entityName: "Header", before: changes?.before, after: changes?.after });
    revalidateSite();
    return { ok: true, message: "Header saved." };
  });
}

export async function saveFooter(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("settings:write");
    await requirePermission("menus:write");
    await assertEditLocks(
      user,
      [lockKey.chrome("footer"), lockKey.setting("footer"), lockKey.setting("general"), lockKey.setting("contact"), lockKey.setting("social"), lockKey.menu("footer-company"), lockKey.menu("footer-legal")],
      fd,
    );

    const menus = await db.menu.findMany({ where: { key: { in: ["footer-company", "footer-legal"] } } });
    const company = menus.find((m) => m.key === "footer-company");
    const legal = menus.find((m) => m.key === "footer-legal");
    if (!company || !legal) throw new AppError("The footer menus are missing. Run the seed script to create them.");
    const companyItems = parseMenuItems(fd.get("companyItems"), "Company links");
    const legalItems = parseMenuItems(fd.get("legalItems"), "Legal links");
    const logoMediaId = await logoIdOf(fd);

    const rows = await db.setting.findMany({ where: { key: { in: ["footer", "general", "contact", "social"] } } });
    const stored = (k: string) => rows.find((r) => r.key === k)?.value;
    const parsed = validate([
      {
        key: "footer",
        prev: stored("footer"),
        raw: { ...pick(stored("footer"), fd, ["brandName", "brandTagline", "servicesHeading", "companyHeading", "contactHeading", "bottomLine"], ["showServices", "showContact", "showSocial"], ["servicesLimit"]), logoMediaId },
      },
      { key: "general", prev: stored("general"), raw: pick(stored("general"), fd, ["footerBlurb", "tagline", "copyright"]) },
      { key: "contact", prev: stored("contact"), raw: pick(stored("contact"), fd, ["phone", "email", "address"]) },
      { key: "social", prev: stored("social"), raw: pick(stored("social"), fd, ["instagram", "facebook", "linkedin", "youtube", "x"]) },
    ]);
    const contact = parsed.find((p) => p.key === "contact")!.data as { email: string };
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new AppError("Please fix the highlighted fields.", { email: ["Enter a valid email address"] });

    await db.$transaction(async (tx) => {
      for (const p of parsed) {
        await tx.setting.upsert({
          where: { key: p.key },
          create: { key: p.key, value: p.data as object, updatedById: user.id },
          update: { value: p.data as object, updatedById: user.id },
        });
      }
      await replaceMenuItems(tx, company.id, companyItems);
      await replaceMenuItems(tx, legal.id, legalItems);
    });
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const p of parsed) {
      const d = diffFields(p.prev, p.data);
      if (d?.before) for (const [k, v] of Object.entries(d.before)) before[`${p.key}.${k}`] = v;
      if (d?.after) for (const [k, v] of Object.entries(d.after)) after[`${p.key}.${k}`] = v;
    }
    await audit(user.id, "footer.update", "footer", "main", "Updated the site footer", { entityName: "Footer", before, after });
    revalidateSite();
    return { ok: true, message: "Footer saved." };
  });
}
