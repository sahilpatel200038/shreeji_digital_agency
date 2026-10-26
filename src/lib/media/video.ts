import { createHash } from "node:crypto";
import { MediaError } from "@/lib/media/process";

/** Videos are stored like images (bytes in MySQL), so the cap stays well under typical `max_allowed_packet` values. */
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
export const VIDEO_FOLDER = "videos";

export type CheckedVideo = { data: Buffer; mimeType: "video/mp4" | "video/webm"; sizeBytes: number; checksum: string };

/** Verifies by magic bytes (never the client-declared type) that the upload is an MP4 or WebM file. */
export function checkVideo(input: Buffer): CheckedVideo {
  if (input.length === 0) throw new MediaError("The file is empty.");
  if (input.length > MAX_VIDEO_BYTES) throw new MediaError(`Video is too large. Maximum size is ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
  const isMp4 = input.length > 12 && input.subarray(4, 8).toString("latin1") === "ftyp";
  const isWebm = input.length > 4 && input[0] === 0x1a && input[1] === 0x45 && input[2] === 0xdf && input[3] === 0xa3;
  if (!isMp4 && !isWebm) throw new MediaError("Unsupported video type. Use MP4 or WebM.");
  return { data: input, mimeType: isMp4 ? "video/mp4" : "video/webm", sizeBytes: input.length, checksum: createHash("sha256").update(input).digest("hex") };
}
