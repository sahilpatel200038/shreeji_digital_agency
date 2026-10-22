import "dotenv/config";
import mariadb from "mariadb";

// Raw SQL access for assertions and cleanup. The generated Prisma client is ESM-only,
// which Playwright's CommonJS TypeScript loader cannot import, so tests use the driver directly.
const url = new URL(process.env.DATABASE_URL ?? "");
const newPool = () =>
  mariadb.createPool({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 2,
  });
// Spec files in one worker share this module; a file that closes the pool must not break the next one.
let pool: ReturnType<typeof newPool> | null = null;

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  pool ??= newPool();
  const rows = await pool.query(sql, params);
  return JSON.parse(JSON.stringify(rows, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
}

export async function closeDb() {
  const p = pool;
  pool = null;
  await p?.end();
}
