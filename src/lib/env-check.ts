// Server-only. Fails fast, with a message that never contains a secret or a connection string, when the
// environment does not match the mode the app is running in. Runs once, at the first database connection.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "host.docker.internal"]);

let checked = false;

export function assertServerEnv(): void {
  if (checked) return;
  const mode = process.env.NODE_ENV;
  // Tests set their own DATABASE_URL; `next build` only collects page data and may lack runtime secrets.
  if (mode !== "development" && mode !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const problems: string[] = [];
  const dbUrl = process.env.DATABASE_URL;
  let dbHost = "";
  if (!dbUrl) problems.push("DATABASE_URL is not set");
  else {
    try {
      dbHost = new URL(dbUrl).hostname;
    } catch {
      problems.push("DATABASE_URL is not a valid mysql:// URL (special characters in the password must be URL-encoded)");
    }
  }

  if (mode === "development") {
    // Stops a pasted production DATABASE_URL from ever being used while developing.
    if (dbHost && !LOCAL_HOSTS.has(dbHost) && process.env.ALLOW_REMOTE_DEV_DB !== "true") {
      problems.push(
        `development mode refuses a non-local database host ("${dbHost}"). Use a local MySQL, or set ALLOW_REMOTE_DEV_DB=true if you really mean it`,
      );
    }
  } else {
    for (const name of ["AUTH_SECRET", "IP_HASH_SALT", "NEXT_PUBLIC_SITE_URL"]) {
      if (!process.env[name]) problems.push(`${name} is not set`);
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (site) {
      try {
        const u = new URL(site);
        if (u.protocol !== "https:" && !LOCAL_HOSTS.has(u.hostname)) problems.push("NEXT_PUBLIC_SITE_URL must use https:// in production");
      } catch {
        problems.push("NEXT_PUBLIC_SITE_URL is not a valid URL");
      }
    }
  }

  if (problems.length) {
    throw new Error(`Invalid ${mode} environment:\n - ${problems.join("\n - ")}`);
  }
  checked = true;
}
