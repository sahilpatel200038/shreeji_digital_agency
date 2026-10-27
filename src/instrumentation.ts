import type { Instrumentation } from "next";
import { classifyDbError, scrub } from "@/lib/db-errors";

/**
 * Logs every server error Next captures (page renders, route handlers, server actions) as one structured line.
 * The error screen shows visitors only a "Reference" (Next's error digest); searching the server log for that same digest
 * finds the real cause here. Nothing secret is logged: the message is scrubbed of URLs and credentials, and the query string is dropped.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as { digest?: unknown; name?: unknown; code?: unknown; message?: unknown } | null;
  const failure = classifyDbError(err);
  console.error(
    JSON.stringify({
      level: "error",
      msg: "request_error",
      digest: typeof e?.digest === "string" ? e.digest : undefined,
      path: request.path.split("?")[0],
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: context.renderSource,
      revalidateReason: context.revalidateReason,
      dbKind: failure?.kind,
      dbCode: failure?.code,
      errorName: typeof e?.name === "string" ? e.name : undefined,
      errorCode: typeof e?.code === "string" ? e.code : undefined,
      error: scrub(typeof e?.message === "string" ? e.message : String(err)),
    }),
  );
};
