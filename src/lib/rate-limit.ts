import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";

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

/**
 * Count one attempt against `key`. Persistent in MySQL so it survives restarts and multiple instances.
 * One atomic upsert (no interactive transaction): the old read-then-write transaction needed a second connection
 * handshake plus BEGIN/COMMIT on every login, and failed outright (P2028) whenever the pool was briefly busy. The
 * statement also fixes a race where concurrent attempts could each read the same count and under-count.
 */
export async function hitRateLimit(key: string, limit: number, windowSec: number) {
  const now = new Date();
  const safeKey = key.slice(0, 190);
  const windowMs = windowSec * 1000;
  const expiredBefore = new Date(now.getTime() - windowMs);
  await withDbRetry(() => db.$executeRaw`
    INSERT INTO RateLimit (\`key\`, count, windowStart) VALUES (${safeKey}, 1, ${now})
    ON DUPLICATE KEY UPDATE
      count = IF(windowStart <= ${expiredBefore}, 1, count + 1),
      windowStart = IF(windowStart <= ${expiredBefore}, ${now}, windowStart)`);
  const row = await db.rateLimit.findUnique({ where: { key: safeKey } });
  const count = row?.count ?? 1;
  const windowStart = row?.windowStart ?? now;
  const allowed = count <= limit;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now.getTime()) / 1000));
  return { allowed, count, windowStart, remaining: Math.max(0, limit - count), retryAfterSec };
}

export async function clearRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key: key.slice(0, 190) } });
}
