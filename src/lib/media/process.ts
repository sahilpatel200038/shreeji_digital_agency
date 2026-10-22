import { createHash } from "node:crypto";
import sharp, { type Metadata as SharpMetadata } from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FORMATS = ["jpeg", "png", "webp", "avif", "gif"] as const;

export class MediaError extends Error {}

export type ProcessedImage = {
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  checksum: string;
};

/**
 * Verifies the bytes really are an allowed image (magic-byte detection by sharp, ignoring any
 * client-declared MIME type or extension), strips metadata, downsizes and re-encodes.
 * SVG and every other format is rejected.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0) throw new MediaError("The file is empty.");
  if (input.length > MAX_UPLOAD_BYTES) throw new MediaError("File is too large. Maximum size is 5 MB.");

  let meta: SharpMetadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new MediaError("This file is not a valid image.");
  }
  if (!meta.format || !(ALLOWED_FORMATS as readonly string[]).includes(meta.format)) {
    throw new MediaError("Unsupported file type. Use JPG, PNG, WebP, AVIF or GIF.");
  }

  const isGif = meta.format === "gif";
  const pipeline = sharp(input, { animated: isGif }).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const data = isGif ? await pipeline.gif().toBuffer() : await pipeline.webp({ quality: 85 }).toBuffer();
  const out = await sharp(data).metadata();

  return {
    data,
    mimeType: isGif ? "image/gif" : "image/webp",
    width: out.width ?? meta.width ?? 0,
    height: (isGif ? out.pageHeight : out.height) ?? meta.height ?? 0,
    sizeBytes: data.length,
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}
