import { db } from "@/lib/db";
import { classifyDbError, scrub } from "@/lib/db-errors";

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
    const bytes = new Uint8Array(media.blob.data);
    // Video needs byte ranges so browsers (Safari especially) can start playback and seek.
    const range = media.mimeType.startsWith("video/") ? /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "") : null;
    if (range && (range[1] || range[2])) {
      const size = bytes.length;
      let start = range[1] ? Number(range[1]) : size - Number(range[2]);
      let end = range[1] && range[2] ? Number(range[2]) : size - 1;
      start = Math.max(0, start);
      end = Math.min(end, size - 1);
      if (start > end || start >= size) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
      return new Response(bytes.subarray(start, end + 1), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
      });
    }
    return new Response(bytes, { headers: media.mimeType.startsWith("video/") ? { ...headers, "Accept-Ranges": "bytes" } : headers });
  } catch (err) {
    const failure = classifyDbError(err);
    console.error(JSON.stringify({ level: "error", msg: "media_serve_failed", ...(failure ? { dbKind: failure.kind, dbCode: failure.code } : {}), error: scrub(String(err)) }));
    return new Response("Service unavailable", { status: 503 });
  }
}
