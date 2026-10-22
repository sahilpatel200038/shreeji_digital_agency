"use client";

import { useRef, useTransition } from "react";
import { Icon } from "@/components/ui/icons";

/** Opens a native <dialog> (focus trap + Esc built in) and runs `action` only after confirmation. */
export function ConfirmButton({
  action,
  fields,
  title,
  message,
  label,
  confirmLabel = "Delete",
  tone = "danger",
  icon = "trash",
  small,
}: {
  action: (formData: FormData) => Promise<void>;
  fields?: Record<string, string | number>;
  title: string;
  message: string;
  label: string;
  confirmLabel?: string;
  tone?: "danger" | "neutral";
  icon?: string;
  small?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition ${small ? "min-h-9 px-2.5 text-sm" : "min-h-11 px-4"} ${
          tone === "danger" ? "text-danger hover:bg-[#fbeceb]" : "text-forest-900 hover:bg-forest-50"
        }`}
      >
        <Icon name={icon} size={16} />
        {label}
      </button>
      <dialog ref={ref} aria-labelledby="confirm-title" className="m-auto w-[min(92vw,440px)] rounded-[var(--radius-card)] p-0 shadow-[var(--shadow-lift)] backdrop:bg-forest-950/50">
        <form
          method="dialog"
          onSubmit={(e) => {
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            if (submitter?.value !== "confirm") return;
            e.preventDefault();
            const fd = new FormData();
            for (const [k, v] of Object.entries(fields ?? {})) fd.set(k, String(v));
            start(async () => {
              await action(fd);
              ref.current?.close();
            });
          }}
          className="p-6"
        >
          <h2 id="confirm-title" className="text-xl font-bold">
            {title}
          </h2>
          <p className="mt-2 text-muted">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <button value="cancel" className="min-h-11 rounded-lg px-4 font-semibold hover:bg-forest-50">
              Cancel
            </button>
            <button
              value="confirm"
              disabled={pending}
              className={`min-h-11 rounded-lg px-5 font-semibold text-white disabled:opacity-60 ${tone === "danger" ? "bg-danger" : "bg-forest-900"}`}
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
