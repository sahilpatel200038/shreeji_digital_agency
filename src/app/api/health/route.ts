import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scrub } from "@/lib/db-errors";
import { refineDbFailure } from "@/lib/db-health";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = Number(process.env.DB_HEALTH_TIMEOUT_MS) > 0 ? Number(process.env.DB_HEALTH_TIMEOUT_MS) : 3_000;
const CACHE_MS = 5_000; // monitors polling faster than this share one probe instead of each taking a connection

type Probe = { ok: boolean; at: number };
let last: Probe | null = null;
let inFlight: Promise<Probe> | null = null;

async function probe(): Promise<Probe> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error(`health check timed out after ${TIMEOUT_MS}ms`), { code: "HEALTH_TIMEOUT" })), TIMEOUT_MS);
      }),
    ]);
    return { ok: true, at: Date.now() };
  } catch (err) {
    const failure = await refineDbFailure(err);
    console.error(
      JSON.stringify({
        level: "error",
        msg: "health_check_failed",
        dbKind: failure?.kind ?? "timeout_or_unknown",
        dbCode: failure?.code,
        errorCode: (err as { code?: unknown } | null)?.code,
        ms: Date.now() - started,
        error: scrub(err instanceof Error ? err.message : String(err)),
      }),
    );
    return { ok: false, at: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

/** Liveness of the database for uptime monitors. Public response carries no detail; the cause is in the server log. */
export async function GET() {
  if (!last || Date.now() - last.at >= CACHE_MS) {
    inFlight ??= probe().finally(() => {
      inFlight = null;
    });
    last = await inFlight;
  }
  return NextResponse.json({ status: last.ok ? "ok" : "unavailable" }, { status: last.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
