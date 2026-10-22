import { ACTION_LABELS, ACTION_TYPES, type ActionType } from "@/lib/audit-format";
import { APP_TIMEZONE } from "@/lib/audit-query";
import { cn } from "@/lib/utils";

const TONE: Record<ActionType, string> = {
  CREATE: "bg-emerald-100 text-emerald-800",
  UPDATE: "bg-sky-100 text-sky-800",
  DELETE: "bg-red-100 text-red-800",
  PUBLISH: "bg-forest-100 text-forest-800",
  UNPUBLISH: "bg-amber-100 text-amber-800",
  LOGIN: "bg-zinc-100 text-zinc-800",
  LOGOUT: "bg-zinc-100 text-zinc-800",
  LOGIN_FAILED: "bg-red-100 text-red-800",
  EXPORT: "bg-violet-100 text-violet-800",
  OTHER: "bg-zinc-100 text-zinc-800",
};

export function ActionBadge({ type }: { type: string }) {
  const t = (ACTION_TYPES as readonly string[]).includes(type) ? (type as ActionType) : "OTHER";
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold", TONE[t])}>{ACTION_LABELS[t]}</span>;
}

export const WHEN = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: APP_TIMEZONE } as const;

