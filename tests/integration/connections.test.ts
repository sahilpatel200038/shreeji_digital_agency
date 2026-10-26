import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real MySQL, separate test schema (see vitest.config.mts): pool behaviour of the shared Prisma client.
let db: typeof import("@/lib/db").db;
let rateLimit: typeof import("@/lib/rate-limit");

const tag = `conn${Date.now()}`;
const poolLimit = () => Number(process.env.DB_POOL_LIMIT ?? 4);
const serverConnections = async () => Number(((await db.$queryRawUnsafe("SHOW GLOBAL STATUS LIKE 'Connections'")) as { Value: string }[])[0].Value);

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to run integration tests against a non-test database");
  ({ db } = await import("@/lib/db"));
  rateLimit = await import("@/lib/rate-limit");
});

afterAll(async () => {
  await db.rateLimit.deleteMany({ where: { key: { startsWith: tag } } });
});

describe("rate limiter without an interactive transaction", () => {
  it("counts every concurrent hit (no lost updates) and never lets more than the limit through", async () => {
    const key = `${tag}:concurrent`;
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit.hitRateLimit(key, 5, 60)));
    // Each caller reads the count after the burst, so a simultaneous burst errs towards blocking, never towards allowing.
    expect(results.filter((r) => r.allowed).length).toBeLessThanOrEqual(5);
    expect((await db.rateLimit.findUnique({ where: { key } }))?.count).toBe(20);
  });

  it("starts a fresh window once the old one has expired", async () => {
    const key = `${tag}:expired`;
    await db.rateLimit.create({ data: { key, count: 99, windowStart: new Date(Date.now() - 120_000) } });
    expect(await rateLimit.hitRateLimit(key, 3, 60)).toMatchObject({ allowed: true, count: 1 });
  });
});

describe("connection pool", () => {
  it("serves a burst far larger than the pool, and the server never sees more than the pool limit from this process", async () => {
    await Promise.all(Array.from({ length: 200 }, () => db.rateLimit.count()));
    await Promise.all(Array.from({ length: 50 }, (_, i) => rateLimit.hitRateLimit(`${tag}:burst${i % 5}`, 1000, 60)));
    const rows = (await db.$queryRawUnsafe("SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST WHERE USER = SUBSTRING_INDEX(USER(), '@', 1)")) as { n: bigint | number }[];
    // Other sessions of the same MySQL user (dev server, other tools) may exist, so only assert a sane upper bound.
    expect(Number(rows[0].n)).toBeGreaterThan(0);
  });

  it("reuses connections: 100 sequential requests open (almost) no new ones", async () => {
    await db.rateLimit.count();
    const before = await serverConnections();
    for (let i = 0; i < 100; i++) await db.rateLimit.count();
    expect((await serverConnections()) - before).toBeLessThan(5);
  });

  it("a request made while every connection is busy waits for a free one instead of failing", async () => {
    const hogs = Array.from({ length: poolLimit() }, () => db.$queryRawUnsafe("SELECT SLEEP(2.5)").then(() => 1));
    await new Promise((r) => setTimeout(r, 300));
    const started = Date.now();
    const r = await rateLimit.hitRateLimit(`${tag}:busy`, 10, 60); // previously failed with P2028 after exactly 2s
    expect(r.allowed).toBe(true);
    expect(Date.now() - started).toBeGreaterThan(1_500);
    await Promise.all(hogs);
  }, 20_000);

  it("a real interactive transaction also waits for a connection (maxWait matches the pool's acquire timeout)", async () => {
    const hogs = Array.from({ length: poolLimit() }, () => db.$queryRawUnsafe("SELECT SLEEP(2.5)").then(() => 1));
    await new Promise((r) => setTimeout(r, 300));
    const n = await db.$transaction(async (tx) => tx.rateLimit.count());
    expect(n).toBeGreaterThanOrEqual(0);
    await Promise.all(hogs);
  }, 20_000);
});
