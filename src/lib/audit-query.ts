import type { Prisma } from "@/generated/prisma/client";
import { ACTION_TYPES, type ActionType } from "@/lib/audit-format";

export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Kolkata";
export const LOG_PAGE_SIZE = 25;

export type LogFilters = {
  q?: string;
  actionType?: string;
  module?: string;
  userId?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
};

/** Offset of `tz` from UTC at the given instant, in ms (positive east of UTC). */
function tzOffsetMs(at: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - Math.floor(at / 1000) * 1000;
}

/** Start of a YYYY-MM-DD calendar day in the app timezone, as a UTC Date. Null for anything that is not a real date. */
export function zonedDayStart(day: string | undefined, tz = APP_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const guess = Date.UTC(y, mo - 1, d);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(guess - tzOffsetMs(guess, tz));
}

export function parseLogFilters(sp: LogFilters) {
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const actionType = (ACTION_TYPES as readonly string[]).includes(sp.actionType ?? "") ? (sp.actionType as ActionType) : undefined;
  const moduleName = sp.module?.trim().slice(0, 60) || undefined;
  const userId = Number.isInteger(Number(sp.userId)) && Number(sp.userId) > 0 ? Number(sp.userId) : undefined;
  const from = zonedDayStart(sp.from);
  const toStart = zonedDayStart(sp.to);
  // "to" is inclusive: everything before the start of the next day.
  const to = toStart ? new Date(toStart.getTime() + 24 * 3600 * 1000) : null;
  const sort: "asc" | "desc" = sp.sort === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  const and: Prisma.AuditLogWhereInput[] = [];
  if (q) {
    and.push({
      OR: [
        { userName: { contains: q } },
        { action: { contains: q } },
        { module: { contains: q } },
        { summary: { contains: q } },
        { entityName: { contains: q } },
        { entityId: q },
        { requestId: q },
      ],
    });
  }
  if (actionType) and.push({ actionType });
  if (moduleName) and.push({ module: moduleName });
  if (userId) and.push({ userId });
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } });

  return {
    where: (and.length ? { AND: and } : {}) as Prisma.AuditLogWhereInput,
    orderBy: [{ createdAt: sort }, { id: sort }] as Prisma.AuditLogOrderByWithRelationInput[],
    sort,
    page,
    clean: { q, actionType, module: moduleName, userId: userId ? String(userId) : undefined, from: from ? sp.from : undefined, to: to ? sp.to : undefined, sort: sort === "asc" ? "asc" : undefined },
  };
}
