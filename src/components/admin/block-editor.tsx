"use client";

import { useState } from "react";
import { BLOCK_LABELS, emptyBlock, type Block, type BlockType } from "@/lib/blocks/schema";
import { MediaPicker } from "@/components/admin/media-picker";
import { Icon } from "@/components/ui/icons";
import { inputClass } from "@/components/admin/admin-form";

// Rich text is edited by the dedicated editor (blog posts), not added as a block here.
const TYPES = (Object.keys(BLOCK_LABELS) as BlockType[]).filter((t) => t !== "richtext");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}

export function BlockEditor({ name = "blocks", defaultBlocks }: { name?: string; defaultBlocks: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(defaultBlocks);
  const [adding, setAdding] = useState<BlockType>("paragraph");

  const update = (i: number, patch: Partial<Block>) => setBlocks((bs) => bs.map((b, idx) => (idx === i ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => setBlocks((bs) => bs.filter((_, idx) => idx !== i));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      <p className="mb-3 text-sm text-muted">
        Formatting inside text: <code>**bold**</code>, <code>*italic*</code>, <code>[link text](/internal-page)</code>.
      </p>
      {blocks.length === 0 && <p className="rounded-lg border border-dashed border-forest-900/25 p-6 text-center text-muted">No content yet. Add your first block below.</p>}

      <ol className="space-y-3">
        {blocks.map((b, i) => (
          <li key={i} className="rounded-[var(--radius-card)] border border-line bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line bg-forest-50 px-3 py-2">
              <span className="text-sm font-bold text-forest-800">
                {i + 1}. {BLOCK_LABELS[b.type]}
              </span>
              <span className="flex gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`} className="grid size-9 place-items-center rounded-md hover:bg-white disabled:opacity-30">
                  <Icon name="chevron-down" size={18} className="rotate-180" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Move block ${i + 1} down`} className="grid size-9 place-items-center rounded-md hover:bg-white disabled:opacity-30">
                  <Icon name="chevron-down" size={18} />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove block ${i + 1}`} className="grid size-9 place-items-center rounded-md text-danger hover:bg-[#fbeceb]">
                  <Icon name="trash" size={18} />
                </button>
              </span>
            </div>
            <div className="space-y-3 p-3">
              {b.type === "heading" && (
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <Row label="Level">
                    <select value={b.level} onChange={(e) => update(i, { level: Number(e.target.value) as 2 | 3 })} className={inputClass}>
                      <option value={2}>H2 (section)</option>
                      <option value={3}>H3 (sub-section)</option>
                    </select>
                  </Row>
                  <Row label="Text">
                    <input value={b.text} maxLength={200} onChange={(e) => update(i, { text: e.target.value })} className={inputClass} />
                  </Row>
                </div>
              )}
              {b.type === "paragraph" && (
                <Row label="Text">
                  <textarea value={b.text} rows={4} maxLength={5000} onChange={(e) => update(i, { text: e.target.value })} className={`${inputClass} resize-y`} />
                </Row>
              )}
              {b.type === "list" && (
                <>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" checked={b.ordered} onChange={(e) => update(i, { ordered: e.target.checked })} className="size-4 accent-forest-800" /> Numbered list
                  </label>
                  <Row label="Items (one per line)">
                    <textarea value={b.items.join("\n")} rows={5} onChange={(e) => update(i, { items: e.target.value.split("\n") })} className={`${inputClass} resize-y`} />
                  </Row>
                </>
              )}
              {b.type === "image" && (
                <>
                  <MediaPicker label="Image" defaultId={b.mediaId || null} onChange={(id) => update(i, { mediaId: id ?? 0 })} />
                  <Row label="Alt text (describe the image; required for accessibility and SEO)">
                    <input value={b.alt} maxLength={500} onChange={(e) => update(i, { alt: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="Caption (optional)">
                    <input value={b.caption} maxLength={300} onChange={(e) => update(i, { caption: e.target.value })} className={inputClass} />
                  </Row>
                </>
              )}
              {b.type === "quote" && (
                <>
                  <Row label="Quote">
                    <textarea value={b.text} rows={3} onChange={(e) => update(i, { text: e.target.value })} className={`${inputClass} resize-y`} />
                  </Row>
                  <Row label="Attribution (optional)">
                    <input value={b.cite} onChange={(e) => update(i, { cite: e.target.value })} className={inputClass} />
                  </Row>
                </>
              )}
              {b.type === "callout" && (
                <>
                  <Row label="Title (optional)">
                    <input value={b.title} onChange={(e) => update(i, { title: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="Text">
                    <textarea value={b.text} rows={3} onChange={(e) => update(i, { text: e.target.value })} className={`${inputClass} resize-y`} />
                  </Row>
                </>
              )}
              {b.type === "cta" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Row label="Title">
                    <input value={b.title} onChange={(e) => update(i, { title: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="Button label">
                    <input value={b.label} onChange={(e) => update(i, { label: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="Text (optional)">
                    <input value={b.text} onChange={(e) => update(i, { text: e.target.value })} className={inputClass} />
                  </Row>
                  <Row label="Button link (/path, https://, mailto:, tel:)">
                    <input value={b.href} onChange={(e) => update(i, { href: e.target.value })} className={inputClass} />
                  </Row>
                </div>
              )}
              {b.type === "faq" && (
                <>
                  <ul className="space-y-3">
                    {b.items.map((it, j) => (
                      <li key={j} className="grid gap-2 rounded-lg bg-paper p-3">
                        <Row label={`Question ${j + 1}`}>
                          <input value={it.question} onChange={(e) => update(i, { items: b.items.map((x, k) => (k === j ? { ...x, question: e.target.value } : x)) })} className={inputClass} />
                        </Row>
                        <Row label="Answer">
                          <textarea value={it.answer} rows={2} onChange={(e) => update(i, { items: b.items.map((x, k) => (k === j ? { ...x, answer: e.target.value } : x)) })} className={`${inputClass} resize-y`} />
                        </Row>
                        {b.items.length > 1 && (
                          <button type="button" onClick={() => update(i, { items: b.items.filter((_, k) => k !== j) })} className="justify-self-start text-sm font-semibold text-danger">
                            Remove question
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => update(i, { items: [...b.items, { question: "", answer: "" }] })} className="text-sm font-semibold text-bronze-700">
                    + Add question
                  </button>
                </>
              )}
              {b.type === "divider" && <p className="text-sm text-muted">A horizontal divider line.</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-muted">Add a block</span>
          <select value={adding} onChange={(e) => setAdding(e.target.value as BlockType)} className={inputClass}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {BLOCK_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setBlocks((bs) => [...bs, emptyBlock(adding)])} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] border-2 border-forest-900 px-5 font-semibold text-forest-900 hover:bg-forest-900 hover:text-white">
          <Icon name="plus" size={18} /> Add block
        </button>
      </div>
    </div>
  );
}
