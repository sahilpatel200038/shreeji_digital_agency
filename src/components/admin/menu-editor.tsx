"use client";

import { useState } from "react";
import { AdminForm, inputClass } from "@/components/admin/admin-form";
import { saveMenu } from "@/actions/menus";
import { Icon } from "@/components/ui/icons";

type Item = { key: string; parentKey: string | null; label: string; href: string; openInNewTab: boolean; isActive: boolean };

let counter = 0;
const newKey = () => `n${Date.now().toString(36)}${counter++}`;

export function MenuEditor({ menuId, initial }: { menuId: number; initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);
  const set = (i: number, patch: Partial<Item>) => setItems((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const j = i + d;
      if (j < 0 || j >= xs.length) return xs;
      const next = [...xs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) =>
    setItems((xs) => {
      const gone = xs[i].key;
      // Children of a removed item become top-level items.
      return xs.filter((_, idx) => idx !== i).map((x) => (x.parentKey === gone ? { ...x, parentKey: null } : x));
    });
  const parents = items.filter((x) => !x.parentKey);

  return (
    <AdminForm action={saveMenu} submitLabel="Save menu">
      <input type="hidden" name="menuId" value={menuId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {items.length === 0 && <p className="rounded-lg border border-dashed border-forest-900/25 p-6 text-center text-muted">This menu is empty.</p>}
      <ol className="space-y-3">
        {items.map((it, i) => (
          <li key={it.key} className={`rounded-[var(--radius-card)] border border-line bg-white p-3 ${it.parentKey ? "ml-6 border-l-4 border-l-bronze-300" : ""}`}>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">Label</span>
                <input value={it.label} onChange={(e) => set(i, { label: e.target.value })} maxLength={100} className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted">Link (/path, https://, mailto:, tel:)</span>
                <input value={it.href} onChange={(e) => set(i, { href: e.target.value })} maxLength={500} className={inputClass} />
              </label>
              <div className="flex items-end gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${it.label || "item"} up`} className="grid size-11 place-items-center rounded-lg hover:bg-forest-50 disabled:opacity-30">
                  <Icon name="chevron-down" size={18} className="rotate-180" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Move ${it.label || "item"} down`} className="grid size-11 place-items-center rounded-lg hover:bg-forest-50 disabled:opacity-30">
                  <Icon name="chevron-down" size={18} />
                </button>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${it.label || "item"}`} className="grid size-11 place-items-center rounded-lg text-danger hover:bg-[#fbeceb]">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={it.isActive} onChange={(e) => set(i, { isActive: e.target.checked })} className="size-4 accent-forest-800" /> Visible</label>
              <label className="flex min-h-9 items-center gap-2"><input type="checkbox" checked={it.openInNewTab} onChange={(e) => set(i, { openInNewTab: e.target.checked })} className="size-4 accent-forest-800" /> Open in new tab</label>
              <label className="flex min-h-9 items-center gap-2">
                Parent:
                <select value={it.parentKey ?? ""} onChange={(e) => set(i, { parentKey: e.target.value || null })} className="rounded-md border border-[#cbd5cc] bg-white px-2 py-1">
                  <option value="">None (top level)</option>
                  {parents.filter((p) => p.key !== it.key && !items.some((c) => c.parentKey === it.key)).map((p) => (
                    <option key={p.key} value={p.key}>{p.label || "(untitled)"}</option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setItems((xs) => [...xs, { key: newKey(), parentKey: null, label: "", href: "/", openInNewTab: false, isActive: true }])} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] border-2 border-forest-900 px-5 font-semibold text-forest-900 hover:bg-forest-900 hover:text-white">
        <Icon name="plus" size={18} /> Add item
      </button>
    </AdminForm>
  );
}
