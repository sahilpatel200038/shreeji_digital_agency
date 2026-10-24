"use server";

import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, revalidateSite, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, lockKey } from "@/lib/edit-lock";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { seoFromForm } from "@/lib/validation/seo";
import { upsertListingSeo } from "@/lib/seo/listing-save";
import { isListingKey, LISTING_PAGES } from "@/lib/seo/listing";

/** Saves the SEO of a built-in page (Homepage, Services, Blog, FAQ) in one transaction. */
export async function saveListingSeo(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("content:write");
    const key = String(fd.get("key"));
    if (!isListingKey(key)) throw new AppError("Unknown page.");
    await assertEditLocks(user, [lockKey.setting(key === "home" ? "home" : `seo-${key}`)], fd);
    const seo = seoFromForm(fd);
    if (!seo.success) throw new AppError("Please fix the SEO fields.", fieldErrorsFrom(seo.error));
    if (seo.data.ogMediaId && (await db.media.count({ where: { id: seo.data.ogMediaId, mimeType: { startsWith: "image/" } } })) === 0) {
      throw new AppError("Choose an image from the media library.", { ogMediaId: ["Pick an image from the library"] });
    }

    const changes = await db.$transaction((tx) => upsertListingSeo(tx, key, seo.data, user.id));

    await audit(user.id, "site-page.update", "site-page", key, `Updated SEO of ${LISTING_PAGES[key].label}`, { entityName: LISTING_PAGES[key].label, before: changes?.before, after: changes?.after });
    revalidateSite();
    return { ok: true, message: `${LISTING_PAGES[key].label} SEO saved.` };
  });
}
