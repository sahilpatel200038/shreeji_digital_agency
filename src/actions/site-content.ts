"use server";

import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, lockKey } from "@/lib/edit-lock";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";
import { SETTING_SCHEMAS } from "@/lib/settings/schema";
import { coerceContactForm, coerceHomeForm } from "@/lib/settings/forms";
import { saveSeo, seoFromForm } from "@/lib/validation/seo";
import { upsertListingSeo } from "@/lib/seo/listing-save";

const stringsOf = (fd: FormData) => {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") raw[k] = v;
  return raw;
};

const mediaIdOf = (fd: FormData, key: string) => {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function assertImages(ids: (number | null)[]) {
  const wanted = [...new Set(ids.filter((v): v is number => v !== null))];
  if (wanted.length === 0) return;
  const found = await db.media.count({ where: { id: { in: wanted }, mimeType: { startsWith: "image/" } } });
  if (found !== wanted.length) throw new AppError("Choose images from the media library.", { image: ["Pick an image from the library"] });
}

/** Homepage: every text, button, section switch, the hero picture and the SEO, saved together. */
export async function saveHomePage(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("settings:write");
    await assertEditLocks(user, [lockKey.setting("home")], fd);
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    const heroId = mediaIdOf(fd, "heroMediaId");
    await assertImages([heroId, seo.data.ogMediaId]);

    const [prevHome, prevBanners] = await Promise.all([
      db.setting.findUnique({ where: { key: "home" } }),
      db.setting.findUnique({ where: { key: "banners" } }),
    ]);
    const raw = { ...((prevHome?.value ?? {}) as Record<string, unknown>), ...stringsOf(fd) };
    coerceHomeForm(fd, raw);
    const home = SETTING_SCHEMAS.home.safeParse(raw);
    if (!home.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(home.error));
    const banners = SETTING_SCHEMAS.banners.safeParse({ ...((prevBanners?.value ?? {}) as Record<string, unknown>), home: heroId });
    if (!banners.success) throw new AppError("Could not save the hero picture.", fieldErrorsFrom(banners.error));

    const seoChanges = await db.$transaction(async (tx) => {
      for (const [key, value] of [["home", home.data], ["banners", banners.data]] as const) {
        await tx.setting.upsert({
          where: { key },
          create: { key, value: value as object, updatedById: user.id },
          update: { value: value as object, updatedById: user.id },
        });
      }
      return upsertListingSeo(tx, "home", seo.data, user.id);
    });

    const changes = diffFields({ ...((prevHome?.value ?? {}) as Record<string, unknown>), heroMediaId: (prevBanners?.value as { home?: number | null } | undefined)?.home ?? null }, { ...home.data, heroMediaId: heroId });
    await audit(user.id, "site-page.update", "site-page", "home", "Updated the Homepage", {
      entityName: "Homepage",
      before: { ...changes?.before, ...seoChanges?.before },
      after: { ...changes?.after, ...seoChanges?.after },
    });
    revalidateSite();
    return { ok: true, message: "Homepage saved." };
  });
}

/** Contact page: banner text/picture (the Page record), contact details, section labels and SEO, saved together. */
export async function saveContactPage(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("settings:write");
    await assertEditLocks(user, [lockKey.setting("contact")], fd);
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    const title = String(fd.get("title") ?? "").trim();
    if (!title) throw new AppError("Please fix the highlighted fields.", { title: ["Title is required"] });
    if (title.length > 150) throw new AppError("Please fix the highlighted fields.", { title: ["Keep the title to 150 characters"] });
    const excerpt = String(fd.get("excerpt") ?? "").trim();
    if (excerpt.length > 500) throw new AppError("Please fix the highlighted fields.", { excerpt: ["Keep the intro to 500 characters"] });
    const bannerId = mediaIdOf(fd, "featuredMediaId");
    await assertImages([bannerId, seo.data.ogMediaId]);

    const prevContact = await db.setting.findUnique({ where: { key: "contact" } });
    const raw = { ...((prevContact?.value ?? {}) as Record<string, unknown>), ...stringsOf(fd) };
    coerceContactForm(fd, raw);
    const contact = SETTING_SCHEMAS.contact.safeParse(raw);
    if (!contact.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(contact.error));
    if (contact.data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.data.email)) {
      throw new AppError("Please fix the highlighted fields.", { email: ["Enter a valid email address"] });
    }

    const result = await db.$transaction(async (tx) => {
      const page = await tx.page.findFirst({ where: { template: "CONTACT" }, orderBy: [{ isSystem: "desc" }, { id: "asc" }] });
      if (!page) throw new AppError("The Contact page record is missing. Create a page with the Contact template first.");
      const seoId = await saveSeo(tx, page.seoId, seo.data);
      await tx.page.update({ where: { id: page.id }, data: { title, excerpt: excerpt || null, featuredMediaId: bannerId, seoId } });
      await tx.setting.upsert({
        where: { key: "contact" },
        create: { key: "contact", value: contact.data as object, updatedById: user.id },
        update: { value: contact.data as object, updatedById: user.id },
      });
      return page;
    });

    const changes = diffFields(
      { ...((prevContact?.value ?? {}) as Record<string, unknown>), title: result.title, excerpt: result.excerpt, featuredMediaId: result.featuredMediaId },
      { ...contact.data, title, excerpt: excerpt || null, featuredMediaId: bannerId },
    );
    await audit(user.id, "site-page.update", "site-page", "contact", "Updated the Contact page", { entityName: "Contact page", before: changes?.before, after: changes?.after });
    revalidateSite();
    return { ok: true, message: "Contact page saved." };
  });
}
