import { describe, expect, it } from "vitest";
import { classifyDbError, dbFailureMessage, isRetryableConnectError } from "@/lib/db-errors";

describe("classifyDbError: busy vs unreachable", () => {
  it("treats a saturated pool as busy, not as an outage", () => {
    const busy = new Error("pool timeout: failed to retrieve a connection from pool after 10000ms (pool connections: active=4 idle=0 limit=4)");
    expect(classifyDbError(busy)?.kind).toBe("busy");
    expect(classifyDbError(Object.assign(busy, { code: "P2039" }))?.kind).toBe("busy");
    expect(classifyDbError(Object.assign(new Error("x"), { code: "P2024" }))?.kind).toBe("busy");
  });
  it("treats an empty pool that cannot connect as unreachable", () => {
    const down = new Error("pool timeout: failed to retrieve a connection from pool after 10000ms (pool connections: active=0 idle=0 limit=4)");
    expect(classifyDbError(down)?.kind).toBe("unreachable");
  });
  it("classifies P2028 by message: slow start is busy, an expired transaction is not a connectivity error", () => {
    expect(classifyDbError(Object.assign(new Error("Transaction API error: Unable to start a transaction in the given time."), { code: "P2028" }))?.kind).toBe("busy");
    expect(classifyDbError(Object.assign(new Error("Transaction API error: A query cannot be executed on an expired transaction. The timeout for this transaction was 5000 ms"), { code: "P2028" }))).toBeNull();
    expect(classifyDbError(Object.assign(new Error("Transaction API error"), { code: "P2028" }))).toBeNull();
  });
  it("has a distinct user message for busy", () => {
    expect(dbFailureMessage("busy")).not.toBe(dbFailureMessage("unreachable"));
  });
});

describe("isRetryableConnectError", () => {
  const e = (msg: string, code?: string) => Object.assign(new Error(msg), code ? { code } : {});
  it("retries failures to open a connection", () => {
    expect(isRetryableConnectError(e("connect ECONNREFUSED 127.0.0.1:3306", "ECONNREFUSED"))).toBe(true);
    expect(isRetryableConnectError(e("getaddrinfo EAI_AGAIN db", "EAI_AGAIN"))).toBe(true);
    expect(isRetryableConnectError(e("Can't reach database server", "P1001"))).toBe(true);
  });
  it("does not retry saturation, limits, auth, schema, resets or unknown errors", () => {
    expect(isRetryableConnectError(e("pool timeout: failed to retrieve a connection from pool (pool connections: active=4 idle=0 limit=4)"))).toBe(false);
    expect(isRetryableConnectError(e("User has exceeded the 'max_connections_per_hour' resource"))).toBe(false);
    expect(isRetryableConnectError(e("Access denied for user 'x'", "ER_ACCESS_DENIED_ERROR"))).toBe(false);
    expect(isRetryableConnectError(e("Table 'x' doesn't exist", "ER_NO_SUCH_TABLE"))).toBe(false);
    expect(isRetryableConnectError(e("read ECONNRESET", "ECONNRESET"))).toBe(false);
    expect(isRetryableConnectError(new Error("boom"))).toBe(false);
  });
});
