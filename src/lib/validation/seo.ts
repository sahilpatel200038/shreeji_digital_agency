import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === "" ? null : v));

export const seoSchema = z.object({
  title: optional(255),
  description: optional(500),
  canonicalUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/.test(v), "Canonical URL must start with https://")
    .transform((v) => (v === "" ? null : v)),
  robotsIndex: z.boolean(),
  robotsFollow: z.boolean(),
  includeInSitemap: z.boolean(),
  focusKeyword: optional(120),
  secondaryKeywords: z.array(z.string().trim().min(1).max(80)).max(10),
  ogTitle: optional(255),
  ogDescription: optional(500),
  ogMediaId: z.number().int().positive().nullable(),
  structuredData: z.enum(["AUTO", "NONE"]),
});

export type SeoData = z.infer<typeof seoSchema>;

const flag = (fd: FormData, k: string) => fd.get(k) === "on";

export function seoFromForm(fd: FormData) {
  const og = Number(fd.get("ogMediaId"));
  return seoSchema.safeParse({
    title: String(fd.get("seoTitle") ?? ""),
    description: String(fd.get("seoDescription") ?? ""),
    canonicalUrl: String(fd.get("canonicalUrl") ?? ""),
    robotsIndex: flag(fd, "robotsIndex"),
    robotsFollow: flag(fd, "robotsFollow"),
    includeInSitemap: flag(fd, "includeInSitemap"),
    focusKeyword: String(fd.get("focusKeyword") ?? ""),
    secondaryKeywords: String(fd.get("secondaryKeywords") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    ogTitle: String(fd.get("ogTitle") ?? ""),
    ogDescription: String(fd.get("ogDescription") ?? ""),
    ogMediaId: Number.isInteger(og) && og > 0 ? og : null,
    structuredData: String(fd.get("structuredData") ?? "AUTO"),
  });
}

/** Create or update the SeoMeta row for an entity inside a transaction; returns its id. */
export async function saveSeo(tx: Prisma.TransactionClient, seoId: number | null | undefined, data: SeoData): Promise<number> {
  const payload = { ...data, secondaryKeywords: data.secondaryKeywords };
  if (seoId) {
    await tx.seoMeta.update({ where: { id: seoId }, data: payload });
    return seoId;
  }
  return (await tx.seoMeta.create({ data: payload })).id;
}
