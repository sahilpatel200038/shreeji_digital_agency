import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/api";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { MediaError } from "@/lib/media/process";
import { MAX_VIDEO_BYTES, VIDEO_FOLDER, checkVideo } from "@/lib/media/video";
import { mediaUrl, saveVideoMedia } from "@/lib/media/store";
import { SETTING_SCHEMAS } from "@/lib/settings/schema";
import { uploadedVideoId } from "@/lib/video";
import { audit } from "@/lib/audit";
import { revalidateSite } from "@/lib/action";
import { hitRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("host") ?? "");
  } catch {
    return false;
  }
}

async function authorize(request: Request) {
  if (!sameOrigin(request)) return { error: json({ error: "Cross-site request blocked" }, 403) };
  const user = await getSession();
  if (!user) return { error: json({ error: "Unauthorized" }, 401) };
  if (!can(user.role, "settings:write")) return { error: json({ error: "Forbidden" }, 403) };
  return { user };
}

function slotOf(value: unknown): 0 | 1 | null {
  return value === "0" ? 0 : value === "1" ? 1 : null;
}

/** Sets one homepage video card's link. Only that card changes; the other card and all text are kept. */
async function setSlotUrl(slot: 0 | 1, url: string, userId: number) {
  const prev = await db.setting.findUnique({ where: { key: "home" } });
  const current = (prev?.value ?? {}) as { videos?: { title?: string; text?: string; url?: string }[] };
  const parsed = SETTING_SCHEMAS.home.parse(current);
  const previousUrl = parsed.videos[slot]?.url ?? "";
  const videos = [0, 1].map((i) => parsed.videos[i] ?? { title: "", text: "", url: "" });
  videos[slot] = { ...videos[slot], url };
  const next = SETTING_SCHEMAS.home.parse({ ...parsed, videos });
  await db.setting.upsert({
    where: { key: "home" },
    create: { key: "home", value: next as object, updatedById: userId },
    update: { value: next as object, updatedById: userId },
  });
  // Free the old upload, but only if it is one of ours and the other card does not use it.
  const oldId = uploadedVideoId(previousUrl);
  const stillUsed = next.videos.some((v) => uploadedVideoId(v.url) === oldId);
  if (oldId && !stillUsed) await db.media.deleteMany({ where: { id: oldId, folder: VIDEO_FOLDER } });
}

async function post_(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const { user } = auth;

  const limit = await hitRateLimit(`upload:${user.id}`, 60, 600);
  if (!limit.allowed) return json({ error: "Too many uploads. Please wait a few minutes." }, 429);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Invalid upload" }, 400);
  }
  const slot = slotOf(form.get("slot"));
  if (slot === null) return json({ error: "Unknown video card" }, 400);
  const files = form.getAll("file").filter((f): f is File => f instanceof File);
  if (files.length !== 1) return json({ error: "Upload exactly one video" }, 400);
  const file = files[0];
  if (file.size > MAX_VIDEO_BYTES) return json({ error: `Video is too large. Maximum size is ${MAX_VIDEO_BYTES / 1024 / 1024} MB.` }, 413);

  try {
    const media = await saveVideoMedia(checkVideo(Buffer.from(await file.arrayBuffer())), { fileName: file.name, uploadedById: user.id });
    await setSlotUrl(slot, mediaUrl(media)!, user.id);
    await audit(user.id, "media.upload", "media", media.id, `Homepage video ${slot + 1}: ${media.fileName}`);
    revalidateSite();
    return json({ ok: true, url: mediaUrl(media), name: media.fileName, sizeBytes: media.sizeBytes });
  } catch (err) {
    if (err instanceof MediaError) return json({ error: err.message }, 400);
    console.error(JSON.stringify({ level: "error", msg: "video_upload_failed", error: String(err) }));
    return json({ error: "Upload failed. Please try again." }, 500);
  }
}

/** Removes the uploaded video from one card (the card falls back to "coming soon"). */
async function delete_(request: Request) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const slot = slotOf(new URL(request.url).searchParams.get("slot"));
  if (slot === null) return json({ error: "Unknown video card" }, 400);
  try {
    await setSlotUrl(slot, "", auth.user.id);
    await audit(auth.user.id, "media.delete", "media", 0, `Homepage video ${slot + 1} removed`);
    revalidateSite();
    return json({ ok: true });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "video_remove_failed", error: String(err) }));
    return json({ error: "Could not remove the video. Please try again." }, 500);
  }
}

export const POST = withApiErrors("video_post", post_);

export const DELETE = withApiErrors("video_delete", delete_);
