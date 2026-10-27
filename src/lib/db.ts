import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { assertServerEnv } from "@/lib/env-check";
import { connectionFromEnv, intEnv } from "@/lib/db-config";
import { withDbRetry } from "@/lib/db-retry";

function createClient() {
  assertServerEnv();
  const adapter = new PrismaMariaDb({
    ...connectionFromEnv(),
    // Shared MySQL hosts cap how many connections a user may *open per hour* (Hostinger: 500), so connections are
    // opened lazily and kept: a small pool, at most one idle connection kept warm, and idle ones recycled slowly.
    // `next build` prerenders in separate workers (cpus: 2), each with its own pool, so keep each build pool tiny.
    connectionLimit: intEnv("DB_POOL_LIMIT", process.env.NEXT_PHASE === "phase-production-build" ? 2 : 4),
    minimumIdle: 1,
    idleTimeout: 600,
    connectTimeout: intEnv("DB_CONNECT_TIMEOUT_MS", 8_000),
    acquireTimeout: intEnv("DB_ACQUIRE_TIMEOUT_MS", 10_000),
    allowPublicKeyRetrieval: true,
  });
  // Prisma's interactive-transaction defaults (maxWait 2s, timeout 5s) are far shorter than the pool's own 10s wait, so a
  // briefly busy pool or a slow first connection made transactions fail with P2028 while ordinary queries succeeded.
  // maxWait now matches the pool's acquire timeout; the transaction itself gets 15s.
  return new PrismaClient({
    adapter,
    // Opt-in diagnostics: DB_LOG_QUERIES=true prints every SQL statement (with parameters) to the server log. Leave off in production.
    ...(process.env.DB_LOG_QUERIES === "true" ? { log: [{ emit: "stdout" as const, level: "query" as const }] } : {}),
    transactionOptions: { maxWait: intEnv("DB_ACQUIRE_TIMEOUT_MS", 10_000), timeout: intEnv("DB_TRANSACTION_TIMEOUT_MS", 15_000) },
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One client (one pool) per process in every mode. Without this, each bundled copy of this module in production
// opened its own pool, multiplying connections and exhausting the host's hourly connection allowance.
export const db: PrismaClient =
  globalForPrisma.prisma ??
  (globalForPrisma.prisma = createClient().$extends({
    query: {
      // Every query, on every page and action, gets the same bounded retry for failures to *open* a connection (nothing reached
      // the server, so repeating is safe for reads and writes). Everything else, including auth, schema, SQL and pool-saturation
      // errors, is thrown at once (see isRetryableConnectError).
      $allOperations: ({ args, query }) => withDbRetry(() => query(args)),
    },
  }) as unknown as PrismaClient);

// Close the pool when the process is asked to stop, so the server is not left holding half-open connections that count
// against the host's per-user limit until they time out. Next installs its own handler that ends the process; only
// exit here when nothing else is listening.
const g = globalThis as unknown as { dbShutdownHooked?: boolean };
if (!g.dbShutdownHooked && typeof process !== "undefined" && typeof process.once === "function" && process.env.NEXT_RUNTIME !== "edge") {
  g.dbShutdownHooked = true;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      const othersListening = process.listenerCount(signal) > 0;
      const done = () => {
        if (!othersListening) process.exit(0);
      };
      void Promise.race([db.$disconnect(), new Promise((r) => setTimeout(r, 3_000).unref())]).then(done, done);
    });
  }
}
