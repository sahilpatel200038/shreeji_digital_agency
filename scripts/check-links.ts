/**
 * Crawls the sitemap and checks every internal link on each page.
 * Usage: BASE_URL=http://localhost:3100 npm run check:links
 */
const base = (process.env.BASE_URL ?? "http://localhost:3100").replace(/\/$/, "");

async function main() {
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const status = new Map<string, number>();
  const broken: string[] = [];
  let checked = 0;

  const check = async (path: string): Promise<number> => {
    if (!status.has(path)) {
      const res = await fetch(base + path, { redirect: "manual" });
      status.set(path, res.status);
    }
    return status.get(path)!;
  };

  for (const page of pages) {
    const html = await (await fetch(base + page)).text();
    const hrefs = new Set([...html.matchAll(/<a [^>]*href="([^"#]+)(?:#[^"]*)?"/g)].map((m) => m[1]));
    for (const href of hrefs) {
      if (href.startsWith("javascript:")) {
        broken.push(`${page}: javascript: link`);
        continue;
      }
      if (!href.startsWith("/") || href.startsWith("//")) continue; // external / mailto / tel
      checked++;
      const s = await check(href.split("?")[0]);
      if (s >= 400) broken.push(`${page} -> ${href} (${s})`);
    }
  }
  console.log(`Checked ${checked} internal links across ${pages.length} pages (${status.size} unique targets).`);
  if (broken.length) {
    console.error(`BROKEN (${broken.length}):\n${broken.join("\n")}`);
    process.exit(1);
  }
  console.log("No broken internal links.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
