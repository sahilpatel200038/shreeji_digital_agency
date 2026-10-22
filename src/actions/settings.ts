"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { SETTING_SCHEMAS, type SettingGroup } from "@/lib/settings/schema";
import { coerceContactForm, coerceHomeForm } from "@/lib/settings/forms";
import type { Permission } from "@/lib/auth/permissions";

const GROUPS = Object.keys(SETTING_SCHEMAS) as SettingGroup[];

function permissionFor(group: SettingGroup): Permission {
  return group === "analytics" ? "settings:scripts" : "settings:write";
}

export async function saveSettings(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const group = String(fd.get("group")) as SettingGroup;
    if (!GROUPS.includes(group)) throw new AppError("Unknown settings group.");
    const user = await requirePermission(permissionFor(group));

    const prev = await db.setting.findUnique({ where: { key: group } });
    // Start from what is stored, so a form that edits only part of a group (for example this Settings
    // page versus the dedicated Home / Contact screens) never resets the fields it does not show.
    const raw: Record<string, unknown> = { ...((prev?.value ?? {}) as Record<string, unknown>) };
    for (const [k, v] of fd.entries()) {
      if (k === "group" || typeof v !== "string") continue;
      raw[k] = v;
    }

    // Per-group coercions from form strings to typed values.
    if (group === "home") coerceHomeForm(fd, raw);
    if (group === "contact") coerceContactForm(fd, raw);
    if (group === "seo") {
      const m = Number(fd.get("ogMediaId"));
      raw.ogMediaId = Number.isInteger(m) && m > 0 ? m : null;
    }

    if (group === "banners") {
      for (const k of ["home", "services", "blog", "faq", "aboutProfile"]) {
        if (!fd.has(k)) continue;
        const m = Number(fd.get(k));
        raw[k] = Number.isInteger(m) && m > 0 ? m : null;
      }
      for (const k of ["servicesTitle", "blogTitle", "faqTitle"]) {
        if (!String(raw[k] ?? "").trim()) throw new AppError("Please fix the highlighted fields.", { [k]: ["A banner heading is required."] });
      }
      const ids = ["home", "services", "blog", "faq", "aboutProfile"].map((k) => raw[k]).filter((v): v is number => typeof v === "number");
      if (ids.length > 0) {
        const found = await db.media.count({ where: { id: { in: ids }, mimeType: { startsWith: "image/" } } });
        if (found !== new Set(ids).size) throw new AppError("Choose images from the media library.");
      }
    }

    const parsed = SETTING_SCHEMAS[group].safeParse(raw);
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error as z.ZodError));

    await db.setting.upsert({
      where: { key: group },
      create: { key: group, value: parsed.data as object, updatedById: user.id },
      update: { value: parsed.data as object, updatedById: user.id },
    });
    const changes = diffFields((prev?.value ?? {}) as Record<string, unknown>, parsed.data as Record<string, unknown>);
    await audit(user.id, "settings.update", "setting", group, `Updated ${group} settings`, { before: changes?.before, after: changes?.after });
    revalidateSite();
    return { ok: true, message: "Settings saved." };
  });
}
