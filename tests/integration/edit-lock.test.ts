import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real MySQL, separate test schema (see vitest.config.mts): the actual lock semantics, not mocks.
let db: typeof import("@/lib/db").db;
let locks: typeof import("@/lib/edit-lock");

const tag = `lk${Date.now()}`;
const key = (n: string) => `team:${tag}${n}`;
const user = (id: number, name: string) => ({ id, name, email: `${name}@test.local`, role: "ADMIN" as const });
const alice = user(9001, "Alice");
const bob = user(9002, "Bob");

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to run integration tests against a non-test database");
  ({ db } = await import("@/lib/db"));
  locks = await import("@/lib/edit-lock");
});

afterAll(async () => {
  await db.editLock.deleteMany({ where: { resourceKey: { startsWith: `team:${tag}` } } });
  await db.editLockRequest.deleteMany({ where: { resourceKey: { startsWith: `team:${tag}` } } });
  await db.$disconnect();
});

describe("edit locks (database)", () => {
  it("when two administrators try at the same instant, exactly one gets the lock (many rounds)", async () => {
    for (let round = 0; round < 25; round++) {
      const k = key(`race${round}`);
      const [a, b] = await Promise.all([locks.acquireLocks(alice, [k], `alice-round-${round}-aa`, { claim: true }), locks.acquireLocks(bob, [k], `bob-round-${round}-bbbb`, { claim: true })]);
      expect([a, b].filter((r) => r === null), `round ${round}`).toHaveLength(1);
      const loser = (a ?? b)!;
      const row = (await db.editLock.findUnique({ where: { resourceKey: k } }))!;
      expect(loser.holderName).toBe(row.userName);
      expect(loser.message).toContain(`currently being edited by ${row.userName}`);
      expect(await db.editLock.count({ where: { resourceKey: k } })).toBe(1);
    }
  });

  it("the holder renews; opening the page again from another tab takes over and the old tab loses it", async () => {
    const k = key("renew");
    expect(await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa", { claim: true })).toBeNull();
    expect(await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa")).toBeNull(); // heartbeat
    expect(await locks.acquireLocks(alice, [k], "alice-tab-2-bbbb", { claim: true }), "a new tab is never locked out by the user's own stale lock").toBeNull();
    const old = await locks.heartbeatLocks(alice, [k], "alice-tab-1-aaaa");
    expect(old.ok).toBe(false);
    expect(!old.ok && old.conflict.sameUser).toBe(true);
    expect(!old.ok && old.conflict.message).toContain("another browser tab");
    expect((await locks.acquireLocks(bob, [k], "bob-tab-1-cccccc", { claim: true }))?.holderName).toBe("Alice");
  });

  it("an expired lease can be taken over, and the old holder is then refused", async () => {
    const k = key("expire");
    await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa");
    await db.editLock.update({ where: { resourceKey: k }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await locks.acquireLocks(bob, [k], "bob-tab-1-cccccc")).toBeNull();
    expect((await db.editLock.findUnique({ where: { resourceKey: k } }))?.userId).toBe(bob.id);
    expect((await locks.heartbeatLocks(alice, [k], "alice-tab-1-aaaa")).ok).toBe(false);
  });

  it("the lease is extended by every heartbeat", async () => {
    const k = key("beat");
    await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa");
    await db.editLock.update({ where: { resourceKey: k }, data: { expiresAt: new Date(Date.now() + 2000) } });
    const res = await locks.heartbeatLocks(alice, [k], "alice-tab-1-aaaa");
    expect(res.ok).toBe(true);
    const row = (await db.editLock.findUnique({ where: { resourceKey: k } }))!;
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + locks.LOCK_TTL_MS - 5000);
  });

  it("release only works for the holder's own tab; a release clears access requests", async () => {
    const k = key("release");
    await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa");
    await locks.requestAccess(bob, k);
    await locks.releaseLocks(bob, [k], "bob-tab-1-cccccc");
    expect(await db.editLock.count({ where: { resourceKey: k } })).toBe(1);
    await locks.releaseLocks(alice, [k], "alice-tab-1-aaaa");
    expect(await db.editLock.count({ where: { resourceKey: k } })).toBe(0);
    expect(await db.editLockRequest.count({ where: { resourceKey: k } })).toBe(0);
  });

  it("access requests reach the holder on the next heartbeat; a free or own lock cannot be requested", async () => {
    const k = key("ask");
    expect(await locks.requestAccess(bob, k)).toMatchObject({ ok: false, reason: "free" });
    await locks.acquireLocks(alice, [k], "alice-tab-1-aaaa");
    expect(await locks.requestAccess(alice, k)).toMatchObject({ ok: false, reason: "self" });
    expect(await locks.requestAccess(bob, k)).toMatchObject({ ok: true, holderName: "Alice" });
    const beat = await locks.heartbeatLocks(alice, [k], "alice-tab-1-aaaa");
    expect(beat.ok && beat.requests).toEqual([{ key: k, name: "Bob" }]);
  });

  it("several keys are taken all-or-nothing", async () => {
    const [a, b] = [key("multi-a"), key("multi-b")];
    await locks.acquireLocks(bob, [b], "bob-tab-1-cccccc");
    const conflict = await locks.acquireLocks(alice, [a, b], "alice-tab-1-aaaa");
    expect(conflict?.key).toBe(b);
    expect(await db.editLock.count({ where: { resourceKey: a } }), "the free key was given back").toBe(0);
  });

  it("assertEditLocks (used by every save action) takes a free lock, accepts the holder, refuses everyone else", async () => {
    const k = key("assert");
    const fd = (token?: string) => {
      const f = new FormData();
      if (token) f.set("_lockToken", token);
      return f;
    };
    await expect(locks.assertEditLocks(alice, [k], fd())).resolves.toBeUndefined(); // direct call: lock taken implicitly
    await expect(locks.assertEditLocks(bob, [k], fd("bob-tab-1-cccccc"))).rejects.toThrow(/currently being edited by Alice/);
    await expect(locks.assertEditLocks(alice, [k], fd())).resolves.toBeUndefined(); // same user, no token
    await expect(locks.assertEditLocks(alice, [k], fd("some-other-tab-1"))).rejects.toThrow(/another browser tab/);
    await expect(locks.assertEditLocks(alice, [k], fd("some-other-tab-1"))).rejects.toThrow(/read-only/);
    await expect(locks.assertNotLockedByOthers(bob, [k])).rejects.toThrow(/Alice/);
    await expect(locks.assertNotLockedByOthers(alice, [k])).resolves.toBeUndefined();
  });

  it("releaseAllFor drops everything a user holds (sign-out, deactivation)", async () => {
    const [a, b] = [key("all-a"), key("all-b")];
    await locks.acquireLocks(alice, [a, b], "alice-tab-1-aaaa");
    await locks.releaseAllFor(alice.id);
    expect(await db.editLock.count({ where: { resourceKey: { in: [a, b] } } })).toBe(0);
  });
});
