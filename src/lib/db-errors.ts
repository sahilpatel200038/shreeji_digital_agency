/**
 * Tells "the database could not be reached / is misconfigured" apart from an ordinary bug, so callers can show a
 * safe, specific message and log the real cause (never the connection string or password).
 */
export type DbFailure = "unreachable" | "busy" | "access" | "schema" | "limit";

const CODES: Record<string, DbFailure> = {
  ECONNREFUSED: "unreachable",
  ETIMEDOUT: "unreachable",
  ENOTFOUND: "unreachable",
  EAI_AGAIN: "unreachable",
  ECONNRESET: "unreachable",
  PROTOCOL_CONNECTION_LOST: "unreachable",
  ER_CON_COUNT_ERROR: "busy", // server-wide max_connections reached: up, but full
  ER_CONNECTION_TIMEOUT: "unreachable", // mariadb connector: connectTimeout elapsed
  P1001: "unreachable",
  P1002: "unreachable",
  P1008: "unreachable",
  P1017: "unreachable",
  P2024: "busy", // Prisma: timed out fetching a connection from the pool (every connection in use)
  P2039: "unreachable", // adapter: "pool failed to retrieve a connection" (server down, wrong host or port); pool saturation is split out below
  // P2028 (transaction API error) is deliberately NOT mapped here: it also means "transaction timed out / already closed",
  // which is a slow query, not a connectivity problem. It is classified from its message below.
  ER_USER_LIMIT_REACHED: "limit",
  ER_ACCESS_DENIED_ERROR: "access",
  ER_DBACCESS_DENIED_ERROR: "access",
  ER_BAD_DB_ERROR: "access",
  P1000: "access",
  P1003: "access",
  ER_NO_SUCH_TABLE: "schema",
  ER_BAD_FIELD_ERROR: "schema",
  P2021: "schema",
  P2022: "schema",
};

function codesOf(err: unknown, depth = 0): string[] {
  if (!err || typeof err !== "object" || depth > 4) return [];
  const e = err as { code?: unknown; errorCode?: unknown; cause?: unknown };
  const own = [e.code, e.errorCode].filter((c): c is string => typeof c === "string");
  return [...own, ...codesOf(e.cause, depth + 1)];
}

export function classifyDbError(err: unknown): { kind: DbFailure; code: string } | null {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  // Shared hosts cap connections opened per hour (e.g. MySQL "max_connections_per_hour"): a distinct, self-healing failure.
  if (/max_(connections|user_connections|questions|updates)_per_hour|exceeded the .* resource/i.test(text)) return { kind: "limit", code: "USER_LIMIT" };
  // Wrapped driver errors (P2039 and friends) carry the real reason only in the text, so check it before the codes.
  if (/Access denied for user|Unknown database/i.test(text)) return { kind: "access", code: "AUTH" };
  if (/doesn't exist|Unknown column/i.test(text)) return { kind: "schema", code: "SCHEMA" };
  // Pool saturation: every connection is checked out, so the server is up but this process is waiting its turn.
  // An empty pool (active=0) that still cannot hand out a connection means connecting itself fails, which is "unreachable".
  const pool = /pool timeout|failed to retrieve (a )?connection/i.test(text) ? /active=(\d+)/i.exec(text) : null;
  if (pool && Number(pool[1]) > 0) return { kind: "busy", code: "POOL_BUSY" };
  if (/Unable to start a transaction in the given time/i.test(text)) return { kind: "busy", code: "TX_START_TIMEOUT" };
  // A transaction that ran too long or was already closed is a slow/failed query, not an outage.
  if (/expired transaction|timeout for this transaction|Transaction already closed/i.test(text)) return null;
  for (const code of codesOf(err)) if (CODES[code]) return { kind: CODES[code], code };
  if (/pool timeout|failed to retrieve (a )?connection|retrieve (a )?connection from pool|connect ETIMEDOUT|ECONNREFUSED|getaddrinfo|Can't reach database/i.test(text)) return { kind: "unreachable", code: "CONNECT" };
  return null;
}

/** Message safe to show an admin: says what kind of problem it is without any host, user or credential detail. */
export function dbFailureMessage(kind: DbFailure): string {
  if (kind === "limit") return "The site has used up its hourly database connection allowance. It resets within the hour; please try again later.";
  if (kind === "schema") return "The database is missing tables this version needs. The site administrator must run the database migrations.";
  if (kind === "access") return "The site could not sign in to its database. The site administrator must check the database settings.";
  if (kind === "busy") return "The database is busy right now. Please try again in a moment.";
  return "The site cannot reach its database right now. Please try again in a few minutes.";
}

/** Strips anything that looks like a connection string or credential before an error message is logged. */
export function scrub(text: string): string {
  return text.replace(/[a-z]+:\/\/[^\s'"]+/gi, "[url]").replace(/(password|pwd|secret|token)=\S+/gi, "$1=[redacted]").slice(0, 500);
}

/**
 * True only when the failure happened while *opening* a connection, i.e. before any SQL reached the server. Those are
 * safe to retry for any statement. Deliberately excludes resets/lost connections mid-query (the statement may have run),
 * pool saturation and hourly limits (retrying would add load to a database that is already struggling), and every
 * credential, schema or SQL error (retrying cannot help).
 */
export function isRetryableConnectError(err: unknown): boolean {
  const failure = classifyDbError(err);
  if (!failure || failure.kind !== "unreachable") return false;
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (/ECONNRESET|PROTOCOL_CONNECTION_LOST|server has gone away|Connection lost/i.test(text)) return false;
  const codes = codesOf(err);
  return (
    codes.some((c) => ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "P1001", "P1002"].includes(c)) ||
    /connect ETIMEDOUT|ECONNREFUSED|getaddrinfo|Can't reach database/i.test(text)
  );
}
