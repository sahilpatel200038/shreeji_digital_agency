import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { MediaError, MAX_UPLOAD_BYTES } from "@/lib/media/process";
import { saveMedia } from "@/lib/media/store";
import { audit } from "@/lib/audit";
import { revalidateSite } from "@/lib/action";
import { hitRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Reject cross-site requests (cookie is SameSite=Lax; this is defence in depth for state-changing calls). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("host") ?? "");
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "media:write")) return json({ error: "Forbidden" }, 403);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = 24;
  const where = q ? { OR: [{ title: { contains: q } }, { fileName: { contains: q } }, { altText: { contains: q } }] } : {};
  const [items, total] = await Promise.all([
    db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: { id: true, title: true, altText: true, checksum: true, width: true, height: true } }),
    db.media.count({ where }),
  ]);
  return json({ items, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Cross-site request blocked" }, 403);
  const user = await getSession();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "media:write")) return json({ error: "Forbidden" }, 403);

  const limit = await hitRateLimit(`upload:${user.id}`, 60, 600);
  if (!limit.allowed) return json({ error: "Too many uploads. Please wait a few minutes." }, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid upload" }, 400);
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return json({ error: "No file selected" }, 400);
  if (files.length > 10) return json({ error: "Upload at most 10 files at a time" }, 400);
  const folder = String(form.get("folder") ?? "general").replace(/[^a-z0-9-_]/gi, "").slice(0, 80) || "general";

  const results: { name: string; ok: boolean; id?: number; error?: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      results.push({ name: file.name, ok: false, error: "File is too large. Maximum size is 5 MB." });
      continue;
    }
    try {
      const media = await saveMedia(Buffer.from(await file.arrayBuffer()), { fileName: file.name, folder, uploadedById: user.id });
      await audit(user.id, "media.upload", "media", media.id, media.fileName);
      results.push({ name: file.name, ok: true, id: media.id });
    } catch (err) {
      if (err instanceof MediaError) results.push({ name: file.name, ok: false, error: err.message });
      else {
        console.error(JSON.stringify({ level: "error", msg: "upload_failed", error: String(err) }));
        results.push({ name: file.name, ok: false, error: "Upload failed. Please try again." });
      }
    }
  }
  revalidateSite();
  return json({ results }, results.some((r) => r.ok) ? 200 : 400);
}
