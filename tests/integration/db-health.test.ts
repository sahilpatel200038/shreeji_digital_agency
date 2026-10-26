import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real MySQL (test schema). Points the probe at a closed port / wrong password to prove the real reason is recovered
// from the opaque pool error, an outage is remembered briefly, and recovery is detected.
let health: typeof import("@/lib/db-health");
let original: string;

const withUrl = (mutate: (u: URL) => void) => {
  const u = new URL(original);
  u.hostname = "127.0.0.1";
  mutate(u);
  process.env.DATABASE_URL = u.href;
  health.resetProbeCache();
};

const poolError = Object.assign(
  new Error("Database error. Code: `45028`. Message: `pool failed to retrieve a connection from pool (pool connections: active=0 idle=0 limit=4)`"),
  { code: "P2039" },
);

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes("_test")) throw new Error("Refusing to run integration tests against a non-test database");
  original = process.env.DATABASE_URL;
  health = await import("@/lib/db-health");
});

afterAll(() => {
  process.env.DATABASE_URL = original;
  health.resetProbeCache();
});

describe("probe + refineDbFailure", () => {
  it("reports ok against a healthy database, and a pool failure then means 'busy', not 'down'", async () => {
    withUrl(() => {});
    expect(await health.probeDatabase()).toEqual({ ok: true });
    expect(await health.refineDbFailure(poolError)).toMatchObject({ kind: "busy" });
    expect(health.knownOutage()).toBeNull();
  });

  it("turns the opaque pool error into 'unreachable' when nothing is listening, and remembers the outage", async () => {
    withUrl((u) => (u.port = "33999"));
    expect(await health.refineDbFailure(poolError)).toMatchObject({ kind: "unreachable" });
    expect(health.knownOutage()).toMatchObject({ ok: false, kind: "unreachable" });
  });

  it("turns the opaque pool error into 'access' for wrong credentials", async () => {
    withUrl((u) => (u.password = "definitely-wrong"));
    expect(await health.refineDbFailure(poolError)).toMatchObject({ kind: "access" });
  });

  it("shares one probe between concurrent callers", async () => {
    withUrl((u) => (u.port = "33999"));
    const results = await Promise.all(Array.from({ length: 10 }, () => health.probeDatabase()));
    expect(new Set(results).size).toBe(1);
  });

  it("detects recovery once the cache window passes", async () => {
    withUrl(() => {});
    expect(await health.probeDatabase()).toEqual({ ok: true });
    expect(health.knownOutage()).toBeNull();
  });

  it("leaves non-pool errors alone (no probe)", async () => {
    withUrl((u) => (u.port = "33999"));
    expect(await health.refineDbFailure(Object.assign(new Error("Table 'x' doesn't exist"), { code: "P2021" }))).toMatchObject({ kind: "schema" });
    expect(health.knownOutage()).toBeNull();
  });
});
