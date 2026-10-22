import { db } from "@/lib/db";

export type WindowState = { count: number; windowStart: Date } | null;

/** Pure window logic (unit-tested). */
export function evaluateWindow(state: WindowState, now: Date, limit: number, windowMs: number) {
  const expired = !state || now.getTime() - state.windowStart.getTime() >= windowMs;
  const count = expired ? 1 : state.count + 1;
  const windowStart = expired ? now : state.windowStart;
  const allowed = count <= limit;
  const retryAfterSec = allowed
    ? 0
    : Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed, count, windowStart, remaining: Math.max(0, limit - count), retryAfterSec };
}

/** Count one attempt against `key`. Persistent in MySQL so it survives restarts and multiple instances. */
export async function hitRateLimit(key: string, limit: number, windowSec: number) {
  const now = new Date();
  const safeKey = key.slice(0, 190);
  return db.$transaction(async (tx) => {
    const row = await tx.rateLimit.findUnique({ where: { key: safeKey } });
    const result = evaluateWindow(row, now, limit, windowSec * 1000);
    await tx.rateLimit.upsert({
      where: { key: safeKey },
      create: { key: safeKey, count: result.count, windowStart: result.windowStart },
      update: { count: result.count, windowStart: result.windowStart },
    });
    return result;
  });
}

export async function clearRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key: key.slice(0, 190) } });
}
