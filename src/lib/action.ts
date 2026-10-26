import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { classifyDbError, dbFailureMessage, scrub } from "@/lib/db-errors";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export class AppError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function fieldErrorsFrom(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Runs an action body, converting known errors into typed results and hiding internals. */
export async function run<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) return { ok: false, error: err.message, fieldErrors: err.fieldErrors };
    const db = classifyDbError(err);
    console.error(
      JSON.stringify({
        level: "error",
        msg: db ? "action_failed_database" : "action_failed",
        ...(db ? { dbKind: db.kind, dbCode: db.code } : {}),
        errorName: err instanceof Error ? err.name : typeof err,
        errorCode: (err as { code?: unknown } | null)?.code,
        error: scrub(err instanceof Error ? err.message : String(err)),
      }),
    );
    if (db) return { ok: false, error: dbFailureMessage(db.kind) };
    return { ok: false, error: "Something went wrong on our side. Please try again." };
  }
}

/** Invalidate every cached public page after a content change. */
export function revalidateSite() {
  revalidatePath("/", "layout");
}
