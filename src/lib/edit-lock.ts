import { db } from "@/lib/db";
import { conflictMessage } from "@/lib/lock-keys";

export { canLock, isValidLockKey, lockKey } from "@/lib/lock-keys";
import { AppError } from "@/lib/action";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Exclusive editing leases for admin pages and modules.
 *
 * A lock is one EditLock row per resource key ("service:5", "setting:home" ...). The primary key makes "at most one
 * holder" a database guarantee; expiry (a lease that must be renewed by a heartbeat) makes sure that a closed
 * browser, a lost connection or an expired session can never block other administrators for long.
 *
 * Every save/delete Server Action calls assertEditLocks(), so the lock is enforced on the server and cannot be
 * bypassed by calling the action directly.
 */

/** A lease lasts this long without a heartbeat. The editor page renews it every 20 s. */
export const LOCK_TTL_MS = 90_000;

export type LockConflict = { key: string; holderName: string; sameUser: boolean; message: string };

export class EditLockError extends AppError {
  constructor(public conflict: LockConflict) {
    super(conflict.message);
  }
}

const expiry = (now: Date) => new Date(now.getTime() + LOCK_TTL_MS);

/**
 * Takes (or renews) one lock. Race-free: the conditional UPDATE and the INSERT are single statements, and the
 * primary key rejects a second INSERT, so two administrators can never both succeed.
 *
 * `token` identifies the browser tab. Without one (a direct call) any lock the same user already holds is accepted.
 * `claim` is for opening an editor: a lock the same user holds from another tab (often a closed or crashed one) is
 * taken over, so nobody is locked out by their own stale session. The older tab then fails its next heartbeat and
 * cannot save, because saving and renewing (claim = false) require the tab's own token.
 */
async function acquireOne(user: SessionUser, key: string, token: string | null, claim: boolean): Promise<LockConflict | null> {
  const now = new Date();
  const mine = token && !claim ? { userId: user.id, token } : { userId: user.id };
  const fresh = { userId: user.id, userName: user.name, heartbeatAt: now, expiresAt: expiry(now), ...(token ? { token } : {}) };
  const renewOrTakeOver = () => db.editLock.updateMany({ where: { resourceKey: key, OR: [mine, { expiresAt: { lt: now } }] }, data: fresh });

  // 1. Renew my own lock, or take over a lease that has run out.
  if ((await renewOrTakeOver()).count === 1) {
    await clearRequestsFrom(user.id, key);
    return null;
  }

  // 2. Nobody has it yet.
  try {
    await db.editLock.create({ data: { resourceKey: key, token: token ?? crypto.randomUUID(), acquiredAt: now, ...fresh } });
    await clearRequestsFrom(user.id, key);
    return null;
  } catch (err) {
    // Somebody inserted at the same moment: look again once, then report who has it.
    if ((await renewOrTakeOver()).count === 1) {
      await clearRequestsFrom(user.id, key);
      return null;
    }
    const row = await db.editLock.findUnique({ where: { resourceKey: key } });
    if (!row) throw err; // not a duplicate-key race: surface the real error
    const sameUser = row.userId === user.id;
    return { key, holderName: row.userName, sameUser, message: conflictMessage(key, row.userName, sameUser) };
  }
}

async function clearRequestsFrom(userId: number, key: string) {
  await db.editLockRequest.deleteMany({ where: { resourceKey: key, requesterId: userId } });
}

/** Acquires every key or none. Keys are taken in sorted order and released again if one is refused. */
export async function acquireLocks(user: SessionUser, keys: string[], token: string | null, opts: { claim?: boolean } = {}): Promise<LockConflict | null> {
  const sorted = [...new Set(keys)].sort();
  const got: string[] = [];
  for (const key of sorted) {
    const conflict = await acquireOne(user, key, token, opts.claim === true);
    if (conflict) {
      // All or none: a form that cannot hold every lock it needs is not editing, so give back the ones taken.
      if (token) await releaseLocks(user, got, token);
      return conflict;
    }
    got.push(key);
  }
  void db.editLock.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 3600_000) } } }).catch(() => {});
  return null;
}

/** Renews the leases; reports who asked for access, or the conflict if a lock is no longer mine. */
export async function heartbeatLocks(user: SessionUser, keys: string[], token: string) {
  const conflict = await acquireLocks(user, keys, token);
  if (conflict) return { ok: false as const, conflict };
  const requests = await db.editLockRequest.findMany({ where: { resourceKey: { in: keys } }, orderBy: { createdAt: "asc" } });
  return { ok: true as const, requests: requests.map((r) => ({ key: r.resourceKey, name: r.requesterName })) };
}

export async function releaseLocks(user: SessionUser, keys: string[], token: string) {
  if (keys.length === 0) return;
  await db.editLock.deleteMany({ where: { resourceKey: { in: keys }, userId: user.id, token } });
  await db.editLockRequest.deleteMany({ where: { resourceKey: { in: keys } } });
}

/** Read-only: who holds these keys right now (expired leases do not count). */
export async function lockStatus(user: SessionUser, keys: string[], token: string | null): Promise<LockConflict | null> {
  const now = new Date();
  const rows = await db.editLock.findMany({ where: { resourceKey: { in: keys }, expiresAt: { gte: now } } });
  for (const row of rows) {
    const sameUser = row.userId === user.id;
    if (sameUser && (!token || row.token === token)) continue;
    return { key: row.resourceKey, holderName: row.userName, sameUser, message: conflictMessage(row.resourceKey, row.userName, sameUser) };
  }
  return null;
}

/** "Please let me know when you are done": leaves a note the current holder sees on their next heartbeat. */
export async function requestAccess(user: SessionUser, key: string) {
  const holder = await db.editLock.findUnique({ where: { resourceKey: key } });
  if (!holder || holder.expiresAt < new Date()) return { ok: false as const, reason: "free" as const };
  if (holder.userId === user.id) return { ok: false as const, reason: "self" as const };
  await db.editLockRequest.upsert({
    where: { resourceKey_requesterId: { resourceKey: key, requesterId: user.id } },
    create: { resourceKey: key, requesterId: user.id, requesterName: user.name },
    update: { createdAt: new Date(), requesterName: user.name },
  });
  return { ok: true as const, holderName: holder.userName };
}

/** Drops every lock a user holds (sign-out, account deactivation). */
export async function releaseAllFor(userId: number) {
  await db.editLock.deleteMany({ where: { userId } });
  await db.editLockRequest.deleteMany({ where: { requesterId: userId } });
}

/**
 * Server-side gate for every save/delete action. Takes the lock if it is free (so a direct call cannot skip the
 * lock), renews it if it is the caller's own, and refuses with a clear message if somebody else holds it.
 * The tab token comes from the form (`_lockToken`); it is optional.
 */
export async function assertEditLocks(user: SessionUser, keys: string[], fd?: FormData | null) {
  const raw = fd?.get("_lockToken");
  const token = typeof raw === "string" && /^[A-Za-z0-9-]{8,64}$/.test(raw) ? raw : null;
  const conflict = await acquireLocks(user, keys, token);
  if (conflict) throw new EditLockError(conflict);
}

/** Like assertEditLocks but never takes a lock: for quick actions (delete, show/hide) that are not edit sessions. */
export async function assertNotLockedByOthers(user: SessionUser, keys: string[]) {
  const conflict = await lockStatus(user, keys, null);
  if (conflict && !conflict.sameUser) throw new EditLockError(conflict);
}
