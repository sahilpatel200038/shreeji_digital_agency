import mariadb, { type Connection } from "mariadb";
import { classifyDbError, type DbFailure } from "@/lib/db-errors";
import { connectionFromEnv, intEnv } from "@/lib/db-config";

/**
 * Why the pool could not get a connection.
 *
 * Through the connection pool, a wrong password, a refused connection, a full server and a host connection cap all
 * surface as the same opaque "pool failed to retrieve a connection" error after a long wait. To tell them apart (and to
 * confirm an outage is real before telling anyone the database is down), ONE direct, unpooled connection is opened and
 * its real error is read. Results are cached and concurrent callers share one probe, so an outage costs the host at
 * most one extra connection attempt per cache window instead of one per request.
 */
export type Probe = { ok: true } | { ok: false; kind: DbFailure; code: string };

const OK_MS = 5_000;
const FAIL_MS = 10_000; // also the circuit-breaker window: the longest a recovered database can still look down

// Next bundles route handlers and server actions separately, each with its own copy of this module, so the state lives
// on globalThis (as the Prisma client does) to be shared by the health check, the login action and error handling.
const state = ((globalThis as unknown as { dbProbeState?: { cached: { at: number; result: Probe } | null; inFlight: Promise<Probe> | null } }).dbProbeState ??= { cached: null, inFlight: null });

async function runProbe(): Promise<Probe> {
  let conn: Connection | undefined;
  try {
    conn = await mariadb.createConnection({
      ...connectionFromEnv(),
      connectTimeout: intEnv("DB_PROBE_TIMEOUT_MS", 4_000),
      allowPublicKeyRetrieval: true,
    });
    await conn.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    const c = classifyDbError(err);
    return { ok: false, kind: c?.kind ?? "unreachable", code: c?.code ?? (err as { code?: string } | null)?.code ?? "CONNECT" };
  } finally {
    await conn?.end().catch(() => conn?.destroy());
  }
}

export async function probeDatabase(): Promise<Probe> {
  if (state.cached && Date.now() - state.cached.at < (state.cached.result.ok ? OK_MS : FAIL_MS)) return state.cached.result;
  state.inFlight ??= runProbe()
    .then((result) => {
      state.cached = { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      state.inFlight = null;
    });
  return state.inFlight;
}

/** The failure confirmed by a probe in the last few seconds, if any. Lets callers fail fast instead of each waiting out the pool timeout. */
export function knownOutage(): Extract<Probe, { ok: false }> | null {
  const { cached } = state;
  return cached && !cached.result.ok && Date.now() - cached.at < FAIL_MS ? cached.result : null;
}

/**
 * Like classifyDbError, but resolves the opaque pool failure: asks the probe what is really wrong. If a direct connection
 * works, the pool failure was transient congestion, so it is reported as "busy", never as an outage.
 */
export async function refineDbFailure(err: unknown): Promise<{ kind: DbFailure; code: string } | null> {
  const base = classifyDbError(err);
  if (!base || base.kind !== "unreachable" || (base.code !== "P2039" && base.code !== "CONNECT")) return base;
  const probe = await probeDatabase();
  return probe.ok ? { kind: "busy", code: "POOL_TRANSIENT" } : { kind: probe.kind, code: probe.code };
}

/** Test hook. */
export function resetProbeCache() {
  state.cached = null;
  state.inFlight = null;
}
