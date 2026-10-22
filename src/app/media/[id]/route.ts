import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId) || mediaId <= 0) return new Response("Not found", { status: 404 });

  try {
    const media = await db.media.findUnique({
      where: { id: mediaId },
      select: { mimeType: true, checksum: true, blob: { select: { data: true } } },
    });
    if (!media?.blob) return new Response("Not found", { status: 404 });

    const etag = `"${media.checksum}"`;
    const headers = {
      "Content-Type": media.mimeType,
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      // URLs carry ?v=<checksum>, so versioned URLs are safely immutable; bare URLs revalidate.
      "Cache-Control": new URL(request.url).searchParams.has("v")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300, must-revalidate",
    };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(media.blob.data), { headers });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "media_serve_failed", error: String(err) }));
    return new Response("Service unavailable", { status: 503 });
  }
}
