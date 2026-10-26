import { isRetryableConnectError } from "@/lib/db-errors";

const MAX_RETRIES = 2; // 3 attempts in total
const BASE_MS = 150;
const CAP_MS = 800;

/**
 * Runs a database call, retrying only when opening a connection failed (nothing reached the server, so a retry is safe
 * for reads and writes alike). Bounded to two retries with exponential backoff and full jitter, so a struggling database
 * is never hammered. Authentication, schema, SQL, pool-saturation and mid-query errors are thrown immediately.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= MAX_RETRIES || !isRetryableConnectError(err)) throw err;
      await sleep(Math.random() * Math.min(CAP_MS, BASE_MS * 2 ** attempt));
    }
  }
}
