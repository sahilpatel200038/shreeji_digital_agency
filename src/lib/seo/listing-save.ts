import type { Prisma } from "@/generated/prisma/client";
import { diffFields } from "@/lib/audit-format";
import { saveSeo, type SeoData } from "@/lib/validation/seo";
import type { ListingKey } from "@/lib/seo/listing";

const SEO_AUDIT_FIELDS = ["title", "description", "canonicalUrl", "robotsIndex", "robotsFollow", "includeInSitemap", "ogTitle", "ogDescription", "ogMediaId"];

/**
 * Creates or updates the SeoMeta row of a built-in page and records it in the "seoPages" setting.
 * Runs inside the caller's transaction so SEO and page content are saved together or not at all.
 */
export async function upsertListingSeo(tx: Prisma.TransactionClient, key: ListingKey, data: SeoData, userId: number) {
  const row = await tx.setting.findUnique({ where: { key: "seoPages" } });
  const map = { ...((row?.value ?? {}) as Record<string, number>) };
  const before = map[key] ? await tx.seoMeta.findUnique({ where: { id: map[key] } }) : null;
  map[key] = await saveSeo(tx, map[key], data);
  await tx.setting.upsert({
    where: { key: "seoPages" },
    create: { key: "seoPages", value: map, updatedById: userId },
    update: { value: map, updatedById: userId },
  });
  return diffFields((before ?? {}) as Record<string, unknown>, data as Record<string, unknown>, SEO_AUDIT_FIELDS);
}
