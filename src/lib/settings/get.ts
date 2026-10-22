import { cache } from "react";
import { db } from "@/lib/db";
import { SETTING_SCHEMAS, type SiteSettings, type SettingGroup } from "@/lib/settings/schema";

function parseGroup<G extends SettingGroup>(group: G, value: unknown): SiteSettings[G] {
  const parsed = SETTING_SCHEMAS[group].safeParse(value ?? {});
  // Fall back to defaults if stored JSON is invalid.
  return (parsed.success ? parsed.data : SETTING_SCHEMAS[group].parse({})) as SiteSettings[G];
}

/** Settings merged with defaults. Per-request memoised. Never throws: DB failure -> defaults. */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  let rows: { key: string; value: unknown }[] = [];
  try {
    rows = await db.setting.findMany();
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "settings_load_failed", error: String(err) }));
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    general: parseGroup("general", map.get("general")),
    contact: parseGroup("contact", map.get("contact")),
    social: parseGroup("social", map.get("social")),
    home: parseGroup("home", map.get("home")),
    banners: parseGroup("banners", map.get("banners")),
    analytics: parseGroup("analytics", map.get("analytics")),
    seo: parseGroup("seo", map.get("seo")),
  };
});
