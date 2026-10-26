import { describe, expect, it } from "vitest";
import { classifyDbError, scrub } from "@/lib/db-errors";

describe("classifyDbError", () => {
  it("recognises unreachable, access and schema failures, including nested causes", () => {
    expect(classifyDbError(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))?.kind).toBe("unreachable");
    expect(classifyDbError(new Error("outer", { cause: { code: "ER_ACCESS_DENIED_ERROR" } }))?.kind).toBe("access");
    expect(classifyDbError(Object.assign(new Error("x"), { code: "P2021" }))?.kind).toBe("schema");
    expect(classifyDbError(new Error("pool failed to retrieve a connection from pool (active=0 idle=0 limit=5)"))?.kind).toBe("unreachable");
  });
  it("leaves ordinary errors alone", () => {
    expect(classifyDbError(new Error("Cannot read properties of undefined"))).toBeNull();
  });
  it("scrubs connection strings and credentials from log text", () => {
    const out = scrub("failed mysql://user:pa55@host:3306/db password=hunter2");
    expect(out).not.toMatch(/pa55|hunter2|host:3306/);
  });
});

describe("classifyDbError: wrapped driver errors", () => {
  it("maps the adapter's pool failure (P2039) to unreachable, but credentials/schema text wins over the generic code", () => {
    expect(classifyDbError(Object.assign(new Error("Database error. Code: `45028`. Message: `pool failed to retrieve a connection from pool`"), { code: "P2039" }))?.kind).toBe("unreachable");
    expect(classifyDbError(Object.assign(new Error("Access denied for user 'x'@'localhost'"), { code: "P2039" }))?.kind).toBe("access");
    expect(classifyDbError(Object.assign(new Error("Table 'db.Media' doesn't exist"), { code: "P2039" }))?.kind).toBe("schema");
  });
});

describe("classifyDbError: hosting connection limits", () => {
  it("recognises the shared-host hourly connection cap, even when wrapped in another code", () => {
    const msg = "User 'u1' has exceeded the 'max_connections_per_hour' resource (current value: 500)";
    expect(classifyDbError(new Error(msg))?.kind).toBe("limit");
    expect(classifyDbError(Object.assign(new Error(msg), { code: "P2039" }))?.kind).toBe("limit");
    expect(classifyDbError(Object.assign(new Error("x"), { code: "ER_USER_LIMIT_REACHED" }))?.kind).toBe("limit");
  });
});
