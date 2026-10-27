export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export type UploadResult = { ok: true; id: number } | { ok: false; error: string };

/** Uploads one image to the media library (same endpoint and server-side checks as the library's upload zone). Validates type and size first. */
export function uploadImage(file: File, folder = "general", onProgress?: (percent: number) => void): Promise<UploadResult> {
  if (!IMAGE_TYPES.includes(file.type)) return Promise.resolve({ ok: false, error: "Choose a JPG, PNG, WebP, AVIF or GIF image." });
  if (file.size > MAX_IMAGE_BYTES) return Promise.resolve({ ok: false, error: "That image is larger than 5 MB. Choose a smaller one." });
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.set("folder", folder);
    fd.append("files", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string; results?: { ok: boolean; id?: number; error?: string }[] };
        const r = data.results?.[0];
        if (r?.ok && r.id) return resolve({ ok: true, id: r.id });
        resolve({ ok: false, error: r?.error ?? data.error ?? (xhr.status === 401 ? "Your session has expired. Please sign in again." : "Upload failed. Please try again.") });
      } catch {
        resolve({ ok: false, error: "Upload failed. Please try again." });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: "Network error. Check your connection and try again." });
    xhr.ontimeout = () => resolve({ ok: false, error: "The upload timed out. Please try again." });
    xhr.timeout = 60_000;
    xhr.send(fd);
  });
}
