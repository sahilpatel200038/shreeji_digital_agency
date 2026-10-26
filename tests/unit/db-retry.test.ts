import { describe, expect, it } from "vitest";
import { withDbRetry } from "@/lib/db-retry";

const refused = () => Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:3306"), { code: "ECONNREFUSED" });
const noSleep = async () => {};

describe("withDbRetry", () => {
  it("returns immediately on success without sleeping", async () => {
    let slept = 0;
    expect(await withDbRetry(async () => 7, async () => void slept++)).toBe(7);
    expect(slept).toBe(0);
  });
  it("recovers when a connect failure clears within the retry budget", async () => {
    let calls = 0;
    const out = await withDbRetry(async () => {
      if (++calls < 3) throw refused();
      return "ok";
    }, noSleep);
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });
  it("gives up after 3 attempts and rethrows the original error", async () => {
    let calls = 0;
    await expect(withDbRetry(async () => { calls++; throw refused(); }, noSleep)).rejects.toMatchObject({ code: "ECONNREFUSED" });
    expect(calls).toBe(3);
  });
  it("backs off with bounded jitter", async () => {
    const waits: number[] = [];
    await expect(withDbRetry(async () => { throw refused(); }, async (ms) => void waits.push(ms))).rejects.toThrow();
    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeLessThanOrEqual(150);
    expect(waits[1]).toBeLessThanOrEqual(300);
  });
  it("never retries auth, schema, saturation or unknown errors", async () => {
    for (const err of [
      Object.assign(new Error("Access denied for user"), { code: "ER_ACCESS_DENIED_ERROR" }),
      Object.assign(new Error("Table doesn't exist"), { code: "ER_NO_SUCH_TABLE" }),
      new Error("pool timeout: failed to retrieve a connection from pool (pool connections: active=4 idle=0 limit=4)"),
      new Error("bug"),
    ]) {
      let calls = 0;
      await expect(withDbRetry(async () => { calls++; throw err; }, noSleep)).rejects.toBe(err);
      expect(calls).toBe(1);
    }
  });
});
