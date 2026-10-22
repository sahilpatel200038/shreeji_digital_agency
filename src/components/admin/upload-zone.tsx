"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";

type Result = { name: string; ok: boolean; id?: number; error?: string };

/** Drag-and-drop / click upload with real progress (XHR). */
export function UploadZone({ folder = "general", onUploaded, compact }: { folder?: string; onUploaded?: (ids: number[]) => void; compact?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const fd = new FormData();
    fd.set("folder", folder);
    for (const f of list) fd.append("files", f);
    setError(null);
    setResults([]);
    setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      try {
        const data = JSON.parse(xhr.responseText);
        if (data.error) setError(data.error);
        const res: Result[] = data.results ?? [];
        setResults(res);
        const ids = res.filter((r) => r.ok && r.id).map((r) => r.id!);
        if (ids.length) {
          onUploaded?.(ids);
          router.refresh();
        }
      } catch {
        setError("Upload failed. Please try again.");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error. Please check your connection and try again.");
    };
    xhr.send(fd);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
        className={`rounded-[var(--radius-card)] border-2 border-dashed text-center transition ${compact ? "p-4" : "p-8"} ${over ? "border-bronze-500 bg-bronze-100/50" : "border-forest-900/25 bg-white"}`}
      >
        <Icon name="image" size={compact ? 24 : 32} className="mx-auto text-bronze-600" />
        <p className="mt-2 font-semibold text-forest-900">Drag images here or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="mt-2 min-h-11 rounded-[var(--radius-field)] bg-forest-900 px-5 font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
        >
          Choose files
        </button>
        <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="sr-only" aria-label="Choose image files" onChange={(e) => e.target.files && upload(e.target.files)} />
        <p className="mt-2 text-xs text-muted">JPG, PNG, WebP, AVIF or GIF. Up to 5 MB each.</p>
        {progress !== null && (
          <div className="mt-4" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
            <div className="h-2 overflow-hidden rounded-full bg-forest-100">
              <div className="h-full bg-gradient-to-r from-gold-300 to-bronze-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-sm text-muted">{progress}%</p>
          </div>
        )}
      </div>
      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 text-sm font-medium text-danger">{error}</p>}
        {results.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {results.map((r, i) => (
              <li key={i} className={r.ok ? "text-forest-800" : "text-danger"}>
                {r.ok ? "✓" : "✕"} {r.name}
                {r.error && ` — ${r.error}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
