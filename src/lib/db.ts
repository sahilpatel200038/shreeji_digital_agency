import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { assertServerEnv } from "@/lib/env-check";

function createClient() {
  assertServerEnv();
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    // Shared MySQL hosts cap how many connections a user may *open per hour* (Hostinger: 500), so connections are
    // opened lazily and kept: a small pool, at most one idle connection kept warm, and idle ones recycled slowly.
    // `next build` prerenders in separate workers (cpus: 2), each with its own pool, so keep each build pool tiny.
    connectionLimit: Number(process.env.DB_POOL_LIMIT ?? (process.env.NEXT_PHASE === "phase-production-build" ? 2 : 4)),
    minimumIdle: 1,
    idleTimeout: 600,
    connectTimeout: 8_000,
    acquireTimeout: 10_000,
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// One client (one pool) per process in every mode. Without this, each bundled copy of this module in production
// opened its own pool, multiplying connections and exhausting the host's hourly connection allowance.
export const db: PrismaClient = globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient());
