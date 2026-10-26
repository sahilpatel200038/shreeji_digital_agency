/**
 * Tells "the database could not be reached / is misconfigured" apart from an ordinary bug, so callers can show a
 * safe, specific message and log the real cause (never the connection string or password).
 */
export type DbFailure = "unreachable" | "access" | "schema" | "limit";

const CODES: Record<string, DbFailure> = {
  ECONNREFUSED: "unreachable",
  ETIMEDOUT: "unreachable",
  ENOTFOUND: "unreachable",
  EAI_AGAIN: "unreachable",
  ECONNRESET: "unreachable",
  PROTOCOL_CONNECTION_LOST: "unreachable",
  ER_CON_COUNT_ERROR: "unreachable",
  P1001: "unreachable",
  P1002: "unreachable",
  P1008: "unreachable",
  P1017: "unreachable",
  P2024: "unreachable",
  P2039: "unreachable", // adapter: "pool failed to retrieve a connection" (server down, wrong host or port, timeout)
  P2028: "unreachable", // the adapter reports an unreachable server as "unable to start a transaction in the given time"
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
  for (const code of codesOf(err)) if (CODES[code]) return { kind: CODES[code], code };
  if (/pool timeout|failed to retrieve (a )?connection|retrieve (a )?connection from pool|connect ETIMEDOUT|ECONNREFUSED|getaddrinfo|Can't reach database|Unable to start a transaction in the given time/i.test(text)) return { kind: "unreachable", code: "CONNECT" };
  return null;
}

/** Message safe to show an admin: says what kind of problem it is without any host, user or credential detail. */
export function dbFailureMessage(kind: DbFailure): string {
  if (kind === "limit") return "The site has used up its hourly database connection allowance. It resets within the hour; please try again later.";
  if (kind === "schema") return "The database is missing tables this version needs. The site administrator must run the database migrations.";
  if (kind === "access") return "The site could not sign in to its database. The site administrator must check the database settings.";
  return "The site cannot reach its database right now. Please try again in a few minutes.";
}

/** Strips anything that looks like a connection string or credential before an error message is logged. */
export function scrub(text: string): string {
  return text.replace(/[a-z]+:\/\/[^\s'"]+/gi, "[url]").replace(/(password|pwd|secret|token)=\S+/gi, "$1=[redacted]").slice(0, 500);
}
