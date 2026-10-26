// Runs `prisma migrate deploy` for the build. A host-side connection cap (or the database being briefly unreachable)
// must not fail the whole build: the app reports a missing schema clearly at runtime, and migrations can be re-run
// later with `npm run db:deploy`. Real migration failures (bad SQL, drift) still fail the build.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["prisma", "migrate", "deploy"], { encoding: "utf8", shell: true });
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
if (r.status === 0) process.exit(0);

const out = `${r.stdout}\n${r.stderr}`;
if (/max_(connections|user_connections)_per_hour|exceeded the .* resource|Can't reach database server|ECONNREFUSED|ETIMEDOUT|Timed out/i.test(out)) {
  console.warn("\n[migrate] WARNING: could not reach the database to apply migrations (connection limit or network).");
  console.warn("[migrate] Continuing the build. Once the database is reachable, run: npm run db:deploy");
  process.exit(0);
}
process.exit(r.status ?? 1);
