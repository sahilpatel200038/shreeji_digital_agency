import { NextResponse } from "next/server";
import { dbFailureMessage, scrub } from "@/lib/db-errors";
import { refineDbFailure } from "@/lib/db-health";

/** Wraps an API route handler: an unexpected failure becomes a JSON error (503 for database trouble) and is logged with its cause. */
export function withApiErrors<A extends unknown[]>(name: string, handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      const failure = await refineDbFailure(err);
      console.error(
        JSON.stringify({ level: "error", msg: `${name}_failed`, ...(failure ? { dbKind: failure.kind, dbCode: failure.code } : {}), errorName: err instanceof Error ? err.name : typeof err, error: scrub(String(err)) }),
      );
      return NextResponse.json(
        { error: failure ? dbFailureMessage(failure.kind) : "Something went wrong on our side. Please try again." },
        { status: failure ? 503 : 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  };
}
