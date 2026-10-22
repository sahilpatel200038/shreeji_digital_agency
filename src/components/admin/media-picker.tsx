"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadZone } from "@/components/admin/upload-zone";
import { Icon } from "@/components/ui/icons";

type Item = { id: number; title: string; altText: string; checksum: string };

/** Selects a media-library image and exposes its id via a hidden input named `name`. */
export function MediaPicker({
  name,
  label,
  defaultId,
  onChange,
  hint,
}: {
  name?: string;
  label: string;
  defaultId?: number | null;
  onChange?: (id: number | null) => void;
  hint?: string;
}) {
  const [id, setId] = useState<number | null>(defaultId ?? null);
  const [items, setItems] = useState<Item[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const load = useCallback(async (p: number, query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media?page=${p}&q=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items);
      setPages(data.pages);
    } catch {
      setError("Could not load the media library. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (dialogRef.current?.open) void load(page, q);
    }, 200);
    return () => clearTimeout(t);
  }, [page, q, load]);

  function choose(next: number | null) {
    setId(next);
    onChange?.(next);
    dialogRef.current?.close();
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-forest-900">{label}</p>
      {name && <input type="hidden" name={name} value={id ?? ""} />}
      <div className="flex items-center gap-4">
        <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-forest-50">
          {id ? <Image src={`/media/${id}`} alt="" fill sizes="96px" className="object-contain p-1" unoptimized /> : <Icon name="image" className="text-muted" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.showModal();
              void load(1, q);
            }}
            className="min-h-10 rounded-lg border-2 border-forest-900 px-4 text-sm font-semibold text-forest-900 hover:bg-forest-900 hover:text-white"
          >
            {id ? "Change image" : "Choose image"}
          </button>
          {id && (
            <button type="button" onClick={() => choose(null)} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-[#fbeceb]">
              Remove
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}

      <dialog ref={dialogRef} aria-label="Media library" className="m-auto h-[min(88vh,720px)] w-[min(96vw,900px)] rounded-[var(--radius-card)] p-0 backdrop:bg-forest-950/50">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line p-4">
            <h2 className="text-lg font-bold">Media library</h2>
            <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close" className="grid size-10 place-items-center rounded-lg hover:bg-forest-50">
              <Icon name="x" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <UploadZone compact onUploaded={(ids) => { void load(1, q).then(() => ids[0] && choose(ids[0])); }} />
            <div className="my-4">
              <label htmlFor="media-q" className="sr-only">
                Search media
              </label>
              <input id="media-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search media" className="min-h-11 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] px-3.5" />
            </div>
            {error && <p role="alert" className="text-danger">{error}</p>}
            {loading && <p className="text-muted">Loading…</p>}
            {!loading && items.length === 0 && !error && <p className="text-muted">No images found. Upload one above.</p>}
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => choose(it.id)} className={`block w-full overflow-hidden rounded-lg border-2 text-left transition hover:border-bronze-500 ${it.id === id ? "border-forest-800" : "border-line"}`}>
                    <span className="relative block aspect-square bg-forest-50">
                      <Image src={`/media/${it.id}?v=${it.checksum.slice(0, 8)}`} alt={it.altText} fill sizes="200px" className="object-contain p-1" unoptimized />
                    </span>
                    <span className="block truncate px-2 py-1.5 text-xs font-medium">{it.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <div className="mt-4 flex justify-between text-sm">
                <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line px-4 py-2 font-semibold disabled:opacity-40">Previous</button>
                <span className="self-center text-muted">Page {page} of {pages}</span>
                <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-4 py-2 font-semibold disabled:opacity-40">Next</button>
              </div>
            )}
          </div>
        </div>
      </dialog>
    </div>
  );
}
