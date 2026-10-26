"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/admin/admin-form";
import { Icon } from "@/components/ui/icons";
import { parseVideoUrl } from "@/lib/video";

const MAX_BYTES = 20 * 1024 * 1024;
const TYPES = ["video/mp4", "video/webm"];

/**
 * One homepage video card: a link field plus a single-file upload. An upload is saved straight away (so it survives a
 * refresh) and fills the link field with the stored video's address; Remove clears the card, leaving the other card alone.
 */
export function VideoCardField({ slot, label, defaultUrl }: { slot: 0 | 1; label: string; defaultUrl: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultUrl);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = progress !== null;
  const source = parseVideoUrl(url);

  useEffect(
    () => () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    [localPreview],
  );

  function pick(file: File | undefined) {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    const okType = TYPES.includes(file.type) || /\.(mp4|webm)$/i.test(file.name);
    if (!okType) return setMessage({ ok: false, text: "Unsupported file type. Use an MP4 or WebM video." });
    if (file.size === 0) return setMessage({ ok: false, text: "The file is empty." });
    if (file.size > MAX_BYTES) return setMessage({ ok: false, text: `Video is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_BYTES / 1024 / 1024} MB.` });

    setLocalPreview(URL.createObjectURL(file));
    setMessage(null);
    setProgress(0);
    const fd = new FormData();
    fd.set("slot", String(slot));
    fd.set("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/video");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let data: { ok?: boolean; url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON error page: fall through to the generic message.
      }
      setLocalPreview(null);
      if (xhr.status === 200 && data.ok && data.url) {
        setUrl(data.url);
        setMessage({ ok: true, text: "Video uploaded and saved." });
      } else {
        setMessage({ ok: false, text: data.error ?? "Upload failed. Please try again." });
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setLocalPreview(null);
      setMessage({ ok: false, text: "Network error. Please check your connection and try again." });
    };
    xhr.send(fd);
  }

  async function remove() {
    if (!window.confirm(`Remove the video from card ${slot + 1}?`)) return;
    setProgress(0);
    try {
      const res = await fetch(`/api/admin/video?slot=${slot}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not remove the video.");
      setUrl("");
      setMessage({ ok: true, text: "Video removed." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not remove the video." });
    } finally {
      setProgress(null);
    }
  }

  const previewSrc = localPreview ?? (source?.kind === "file" ? source.src : null);
  const hasVideo = url.trim() !== "";

  return (
    <div className="md:col-span-3">
      <label htmlFor={`video-url-${slot}`} className="mb-1.5 block text-sm font-semibold text-forest-900">
        {label} link or upload
      </label>
      <div className="grid gap-3 md:grid-cols-[1fr_280px]">
        <div>
          <input
            id={`video-url-${slot}`}
            name={`video_url_${slot}`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={500}
            placeholder="https://www.youtube.com/watch?v=… or upload a video"
            className={inputClass}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] bg-forest-900 px-4 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
            >
              <Icon name="image" size={16} />
              {hasVideo ? "Replace video" : "Upload video"}
            </button>
            {hasVideo && (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="min-h-11 rounded-[var(--radius-field)] border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-60"
              >
                Remove
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm"
              className="sr-only"
              aria-label={`${label}: choose a video file`}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </div>
          <p className="mt-2 text-xs text-muted">One video per card. MP4 or WebM, up to 20 MB. Uploads are saved immediately.</p>
          {busy && (
            <div className="mt-2" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} upload progress`}>
              <div className="h-2 overflow-hidden rounded-full bg-forest-100">
                <div className="h-full bg-gradient-to-r from-gold-300 to-bronze-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-sm text-muted">{progress}%</p>
            </div>
          )}
          <div aria-live="polite">
            {message && (
              <p role={message.ok ? "status" : "alert"} className={`mt-2 text-sm font-medium ${message.ok ? "text-forest-800" : "text-danger"}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
        <div className="aspect-video overflow-hidden rounded-[var(--radius-card)] border border-line bg-forest-900">
          {previewSrc ? (
            <video key={previewSrc} src={previewSrc} controls muted playsInline preload="metadata" className="size-full bg-black object-contain" aria-label={`${label} preview`} />
          ) : source?.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube poster in the admin preview
            <img src={source.thumbnail} alt={`${label} thumbnail`} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center px-3 text-center text-sm text-white/70">{source ? "Video link set (preview on the site)" : "No video yet"}</div>
          )}
        </div>
      </div>
    </div>
  );
}
