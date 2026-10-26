import { cache } from "react";
import { db } from "@/lib/db";
import { classifyDbError, scrub } from "@/lib/db-errors";
import { SETTING_SCHEMAS, type SiteSettings, type SettingGroup } from "@/lib/settings/schema";

function parseGroup<G extends SettingGroup>(group: G, value: unknown): SiteSettings[G] {
  const parsed = SETTING_SCHEMAS[group].safeParse(value ?? {});
  // Fall back to defaults if stored JSON is invalid.
  return (parsed.success ? parsed.data : SETTING_SCHEMAS[group].parse({})) as SiteSettings[G];
}

/**
 * Settings merged with defaults (for groups never saved or holding invalid JSON). Per-request memoised.
 * A database failure is logged and rethrown: falling back to defaults would let a prerender or revalidation cache the
 * default site content for the whole revalidate window, and Next keeps serving the last good page when a render throws.
 */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  let rows: { key: string; value: unknown }[];
  try {
    rows = await db.setting.findMany({ select: { key: true, value: true } });
  } catch (err) {
    const db_ = classifyDbError(err);
    console.error(
      JSON.stringify({
        level: "error",
        msg: "settings_load_failed",
        dbKind: db_?.kind,
        dbCode: db_?.code,
        errorName: err instanceof Error ? err.name : undefined,
        errorCode: (err as { code?: string } | null)?.code,
        error: scrub(String(err)),
      }),
    );
    throw err;
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    general: parseGroup("general", map.get("general")),
    contact: parseGroup("contact", map.get("contact")),
    social: parseGroup("social", map.get("social")),
    home: parseGroup("home", map.get("home")),
    banners: parseGroup("banners", map.get("banners")),
    header: parseGroup("header", map.get("header")),
    footer: parseGroup("footer", map.get("footer")),
    analytics: parseGroup("analytics", map.get("analytics")),
    seo: parseGroup("seo", map.get("seo")),
  };
});
