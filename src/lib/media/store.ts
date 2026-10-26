import { db } from "@/lib/db";
import { processImage, type ProcessedImage } from "@/lib/media/process";
import { VIDEO_FOLDER, type CheckedVideo } from "@/lib/media/video";

export type NewMediaInput = {
  fileName: string;
  title?: string;
  altText?: string;
  folder?: string;
  uploadedById?: number | null;
};

/** Storage driver boundary: today bytes live in MySQL (persistent on any host). */
export async function saveMedia(input: Buffer, meta: NewMediaInput, processed?: ProcessedImage) {
  const img = processed ?? (await processImage(input));
  const baseName = meta.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "image";
  return db.$transaction(async (tx) => {
    const media = await tx.media.create({
      data: {
        fileName: baseName,
        title: (meta.title ?? baseName.replace(/\.[^.]+$/, "")).slice(0, 255),
        altText: (meta.altText ?? "").slice(0, 500),
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        width: img.width,
        height: img.height,
        folder: (meta.folder ?? "general").slice(0, 80),
        checksum: img.checksum,
        uploadedById: meta.uploadedById ?? null,
      },
    });
    await tx.mediaBlob.create({ data: { mediaId: media.id, data: new Uint8Array(img.data) } });
    return media;
  });
}

/** Stores an already-validated video (see checkVideo). */
export async function saveVideoMedia(video: CheckedVideo, meta: { fileName: string; title?: string; uploadedById?: number | null }) {
  const baseName = meta.fileName.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "video";
  return db.$transaction(async (tx) => {
    const media = await tx.media.create({
      data: {
        fileName: baseName,
        title: (meta.title ?? baseName.replace(/\.[^.]+$/, "")).slice(0, 255),
        altText: "",
        mimeType: video.mimeType,
        sizeBytes: video.sizeBytes,
        folder: VIDEO_FOLDER,
        checksum: video.checksum,
        uploadedById: meta.uploadedById ?? null,
      },
    });
    await tx.mediaBlob.create({ data: { mediaId: media.id, data: new Uint8Array(video.data) } });
    return media;
  });
}

export async function replaceMediaFile(id: number, input: Buffer) {
  const img = await processImage(input);
  return db.$transaction(async (tx) => {
    const media = await tx.media.update({
      where: { id },
      data: { mimeType: img.mimeType, sizeBytes: img.sizeBytes, width: img.width, height: img.height, checksum: img.checksum },
    });
    await tx.mediaBlob.upsert({
      where: { mediaId: id },
      create: { mediaId: id, data: new Uint8Array(img.data) },
      update: { data: new Uint8Array(img.data) },
    });
    return media;
  });
}

export function mediaUrl(media: { id: number; checksum?: string | null } | null | undefined): string | null {
  if (!media) return null;
  return `/media/${media.id}${media.checksum ? `?v=${media.checksum.slice(0, 8)}` : ""}`;
}
