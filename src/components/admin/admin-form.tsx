"use client";

import Link from "next/link";
import { createContext, startTransition, useActionState, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ActionResult } from "@/lib/action";
import { Icon } from "@/components/ui/icons";
import { useUnsavedGuard } from "@/components/admin/unsaved-changes";
import { useEditLock, type LockUi } from "@/components/admin/use-edit-lock";
import { cn } from "@/lib/utils";

const ErrorsCtx = createContext<Record<string, string[]>>({});

export const inputClass =
  "min-h-11 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40 aria-[invalid=true]:border-danger disabled:bg-forest-50";

type Action = (prev: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

/** A comparable string of everything the form would submit (files by name and size). */
function serialize(form: HTMLFormElement | null): string {
  if (!form) return "";
  const parts: string[] = [];
  for (const [k, v] of new FormData(form).entries()) parts.push(`${k}\u0001${typeof v === "string" ? v : `file:${v.name}:${v.size}`}`);
  return parts.join("\u0002");
}

function LockBanner({ ui, onRequest }: { ui: LockUi; onRequest: () => void }) {
  if (ui.status === "blocked") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-field)] border border-bronze-300 bg-bronze-100/60 p-4 text-forest-900">
        <Icon name="shield" size={20} className="shrink-0 text-bronze-700" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{ui.message}</p>
          <p className="mt-0.5 text-sm text-muted">The form is read-only. This page checks every few seconds and reloads for you as soon as the lock is released.</p>
        </div>
        {ui.requested ? (
          <span className="text-sm font-semibold text-forest-800">Request sent to {ui.holder}</span>
        ) : (
          <button type="button" onClick={onRequest} className="min-h-10 rounded-lg border-2 border-forest-900 px-4 text-sm font-semibold text-forest-900 hover:bg-forest-900 hover:text-white">
            Request access
          </button>
        )}
      </div>
    );
  }
  if (ui.status === "lost") {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-field)] border border-danger/40 bg-[#fbeceb] p-4 text-danger">
        <Icon name="alert" size={20} className="shrink-0" />
        <p className="min-w-0 flex-1 font-semibold">{ui.message} Saving is disabled so nobody&apos;s work is overwritten; copy anything you need, then reload.</p>
        <button type="button" onClick={() => window.location.reload()} className="min-h-10 rounded-lg border-2 border-danger px-4 text-sm font-semibold hover:bg-danger hover:text-white">
          Reload page
        </button>
      </div>
    );
  }
  if (ui.status === "held" && ui.offline) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[var(--radius-field)] border border-bronze-300 bg-bronze-100/60 p-3.5 text-sm font-medium text-forest-900">
        <Icon name="alert" size={18} className="text-bronze-700" /> Connection lost. We keep trying to hold your editing lock; save as soon as you are back online.
      </p>
    );
  }
  if (ui.status === "held" && ui.requests.length > 0) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[var(--radius-field)] border border-bronze-300 bg-bronze-100/60 p-3.5 text-sm font-medium text-forest-900">
        <Icon name="users" size={18} className="text-bronze-700" /> {ui.requests.join(", ")} {ui.requests.length === 1 ? "is" : "are"} waiting to edit this page. Please save and leave when you are done.
      </p>
    );
  }
  return null;
}

export function AdminForm({
  action,
  children,
  submitLabel = "Save changes",
  className,
  footer,
  lock,
  inline,
  cancelHref,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  footer?: React.ReactNode;
  /** Resource keys (see src/lib/edit-lock.ts) held exclusively while this form is open. The server re-checks them on save. */
  lock?: string[];
  /** Small utility forms (login, add note ...): no sticky bar and no unsaved-changes guard. */
  inline?: boolean;
  /** Adds a Cancel link back to a list. It goes through the unsaved-changes guard like every other link. */
  cancelHref?: string;
}) {
  // A network failure or crashed request must never unmount the form (that would throw the edits away): it becomes an ordinary "not saved" result.
  const safeAction = useCallback<Action>(
    async (prev, data) => {
      try {
        return await action(prev, data);
      } catch (err) {
        if (err && typeof err === "object" && "digest" in err) throw err; // Next's own redirect / not-found signals
        return { ok: false, error: "Could not reach the server, so nothing was saved. Your changes are still here; check your connection and try again." };
      }
    },
    [action],
  );
  const [state, dispatch, pending] = useActionState(safeAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const formRef = useRef<HTMLFormElement>(null);
  const guard = useUnsavedGuard();
  const guardId = useId();
  const lockApi = useEditLock(lock ?? []);
  const tracked = !inline && guard !== null;
  const [dirty, setDirty] = useState(false);
  const baseline = useRef<string | null>(null);
  const interacted = useRef(false);
  const waiter = useRef<((ok: boolean) => void) | null>(null);
  const submitting = useRef(false);

  const isDirty = useCallback(() => baseline.current !== null && serialize(formRef.current) !== baseline.current, []);
  const check = useCallback(() => {
    const d = isDirty();
    setDirty((prev) => (prev === d ? prev : d));
  }, [isDirty]);

  // Baseline = what the form holds once it has settled after hydration (unless the user already started typing).
  useEffect(() => {
    if (!tracked) return;
    const snap = () => {
      if (!interacted.current) baseline.current = serialize(formRef.current);
    };
    const t1 = setTimeout(snap, 0);
    const t2 = setTimeout(snap, 500);
    const poll = setInterval(check, 500); // also catches hidden inputs driven by React state (media picker, block editor ...)
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(poll);
    };
  }, [tracked, check]);

  useEffect(() => {
    const form = formRef.current;
    if (!tracked || !form) return;
    const onEdit = () => {
      interacted.current = true;
      check();
    };
    const onClick = () => setTimeout(check, 60);
    form.addEventListener("input", onEdit);
    form.addEventListener("change", onEdit);
    form.addEventListener("click", onClick);
    return () => {
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
      form.removeEventListener("click", onClick);
    };
  }, [tracked, check]);

  const locked = lockApi.locked;

  const save = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        const form = formRef.current;
        if (!form || locked) return resolve(false);
        if (!form.checkValidity()) {
          setTimeout(() => form.reportValidity(), 80);
          return resolve(false);
        }
        waiter.current = resolve;
        form.requestSubmit();
      }),
    [locked],
  );

  useEffect(() => {
    if (!tracked || !guard) return;
    return guard.register(guardId, { isDirty, save });
  }, [tracked, guard, guardId, isDirty, save]);

  useEffect(() => {
    if (tracked) guard?.notifyDirty(guardId, dirty);
  }, [tracked, guard, guardId, dirty]);

  // A finished save: success makes the saved values the new baseline; failure keeps the edits and shows what is wrong.
  useEffect(() => {
    if (!state) return;
    submitting.current = false;
    waiter.current?.(state.ok);
    waiter.current = null;
    if (state.ok) {
      const t = setTimeout(() => {
        baseline.current = serialize(formRef.current);
        setDirty(false);
      }, 0);
      return () => clearTimeout(t);
    }
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  const bar = (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 border-line",
        inline ? "border-t pt-5" : "sticky bottom-0 z-30 mt-8 rounded-[var(--radius-card)] border bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(15,41,31,0.35)] backdrop-blur supports-[backdrop-filter]:bg-white/85",
      )}
    >
      {!inline && (
        <p aria-live="polite" className="min-w-0 flex-1 basis-40 text-sm font-medium">
          {pending ? (
            <span className="text-muted">Saving…</span>
          ) : locked ? (
            <span className="text-bronze-700">Editing is locked</span>
          ) : state && !state.ok ? (
            <span className="text-danger">Not saved: {state.error}</span>
          ) : dirty ? (
            <span className="inline-flex items-center gap-2 text-bronze-700">
              <span className="size-2 rounded-full bg-bronze-500" aria-hidden="true" /> Unsaved changes
            </span>
          ) : state?.ok ? (
            <span className="inline-flex items-center gap-1.5 text-forest-800">
              <Icon name="check" size={16} /> {state.message ?? "Saved"}
            </span>
          ) : null}
        </p>
      )}
      <div className={cn("flex flex-wrap items-center gap-3", !inline && "ml-auto")}>
        {cancelHref && (
          <Link href={cancelHref} className="inline-flex min-h-11 items-center rounded-[var(--radius-field)] px-4 font-semibold text-forest-900 hover:bg-forest-50">
            Cancel
          </Link>
        )}
        {footer}
        <button
          type="submit"
          disabled={pending || locked}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] bg-forest-900 px-6 font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60"
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );

  const body = (
    <>
      <div aria-live="polite">
        {state?.ok && state.message && (
          <p role="status" className="flex items-center gap-2 rounded-[var(--radius-field)] bg-forest-50 p-3.5 font-medium text-forest-800">
            <Icon name="check" size={18} /> {state.message}
          </p>
        )}
        {state && !state.ok && (
          <div role="alert" className="rounded-[var(--radius-field)] bg-[#fbeceb] p-3.5 text-danger">
            <p className="flex items-center gap-2 font-semibold">
              <Icon name="alert" size={18} /> {state.error}
            </p>
            {Object.keys(errors).length > 0 && (
              <ul className="mt-1.5 list-disc pl-9 text-sm">
                {Object.entries(errors).map(([k, v]) => (
                  <li key={k}>
                    <span className="font-semibold">{k}:</span> {v.join(", ")}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {children}
      {bar}
    </>
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current || pending || locked) return; // no double submits, no saving behind someone else's lock
    submitting.current = true;
    const data = new FormData(e.currentTarget);
    if (lock?.length) data.set("_lockToken", lockApi.token);
    startTransition(() => dispatch(data));
  };

  return (
    <ErrorsCtx.Provider value={errors}>
      {lock?.length ? (
        <form ref={formRef} className="contents" onSubmit={onSubmit}>
          <div className={lockApi.ui.status === "held" && lockApi.ui.requests.length === 0 && !lockApi.ui.offline ? undefined : "mb-6"}>
            <LockBanner ui={lockApi.ui} onRequest={lockApi.requestAccess} />
          </div>
          <fieldset disabled={locked} className={cn(className ?? "space-y-6", "min-w-0")}>
            {body}
          </fieldset>
        </form>
      ) : (
        <form ref={formRef} className={className ?? "space-y-6"} onSubmit={onSubmit}>
          {body}
        </form>
      )}
    </ErrorsCtx.Provider>
  );
}

export function Field({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  required?: boolean;
  children: (p: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode;
  className?: string;
}) {
  const uid = useId();
  const id = `${uid}-${name}`;
  const err = useContext(ErrorsCtx)[name]?.[0];
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = err ? `${id}-err` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-forest-900">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children({ id, invalid: Boolean(err), describedBy: [hintId, errId].filter(Boolean).join(" ") || undefined })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {err && (
        <p id={errId} className="mt-1 text-sm font-medium text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

type TextProps = {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  hint?: string;
  required?: boolean;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  min?: number;
  max?: number;
};

export function TextInput({ label, name, defaultValue, hint, required, type = "text", maxLength, placeholder, className, readOnly, min, max }: TextProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <Field label={label} name={name} hint={hint} required={required} className={className}>
      {(p) => (
        <div className="relative">
          <input
            id={p.id}
            name={name}
            type={isPassword && visible ? "text" : type}
            defaultValue={defaultValue ?? ""}
            required={required}
            maxLength={maxLength}
            placeholder={placeholder}
            readOnly={readOnly}
            min={min}
            max={max}
            aria-invalid={p.invalid || undefined}
            aria-describedby={p.describedBy}
            className={isPassword ? `${inputClass} pr-12` : inputClass}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "Hide password" : "Show password"}
              aria-pressed={visible}
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-[var(--radius-field)] text-muted hover:text-forest-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-gold-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {visible ? (
                  <>
                    <path d="M3 3l18 18" />
                    <path d="M10.6 6.1A10.9 10.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 6.7A17 17 0 0 0 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </>
                ) : (
                  <>
                    <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          )}
        </div>
      )}
    </Field>
  );
}

export function TextArea({ label, name, defaultValue, hint, required, rows = 4, maxLength, className, placeholder }: Omit<TextProps, "type"> & { rows?: number }) {
  return (
    <Field label={label} name={name} hint={hint} required={required} className={className}>
      {(p) => (
        <textarea
          id={p.id}
          name={name}
          rows={rows}
          defaultValue={defaultValue ?? ""}
          required={required}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={p.invalid || undefined}
          aria-describedby={p.describedBy}
          className={`${inputClass} resize-y`}
        />
      )}
    </Field>
  );
}

export function SelectField({
  label,
  name,
  options,
  defaultValue,
  hint,
  className,
  required,
}: {
  label: string;
  name: string;
  options: { value: string | number; label: string }[];
  defaultValue?: string | number | null;
  hint?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <Field label={label} name={name} hint={hint} className={className} required={required}>
      {(p) => (
        <select id={p.id} name={name} defaultValue={defaultValue ?? ""} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-forest-900">
        <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} className="size-5 accent-forest-800" />
        {label}
      </label>
      {hint && <p className="ml-8 -mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Controlled counter-friendly input for SEO fields. */
export function CountedInput({ label, name, defaultValue, max, hint, rows, value, onValueChange }: { label: string; name: string; defaultValue?: string | null; max: number; hint?: string; rows?: number; value?: string; onValueChange?: (v: string) => void }) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const v = value ?? inner;
  const setV = (next: string) => {
    setInner(next);
    onValueChange?.(next);
  };
  const over = v.length > max;
  return (
    <Field label={label} name={name} hint={hint}>
      {(p) => {
        const common = {
          id: p.id,
          name,
          value: v,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(e.target.value),
          "aria-invalid": p.invalid || undefined,
          "aria-describedby": p.describedBy,
          className: inputClass,
        };
        return (
          <>
            {rows ? <textarea {...common} rows={rows} className={`${inputClass} resize-y`} /> : <input {...common} type="text" />}
            <p className={`mt-1 text-xs ${over ? "font-semibold text-danger" : "text-muted"}`}>
              {v.length} / {max} recommended
            </p>
          </>
        );
      }}
    </Field>
  );
}

export function FileField({ label, name, hint, accept, required }: { label: string; name: string; hint?: string; accept?: string; required?: boolean }) {
  return (
    <Field label={label} name={name} hint={hint} required={required}>
      {(p) => <input id={p.id} name={name} type="file" accept={accept} required={required} aria-invalid={p.invalid || undefined} aria-describedby={p.describedBy} className={inputClass} />}
    </Field>
  );
}

export function CheckboxGroup({
  label,
  name,
  options,
  defaultValues = [],
  hint,
}: {
  label: string;
  name: string;
  options: { value: number | string; label: string }[];
  defaultValues?: (number | string)[];
  hint?: string;
}) {
  const selected = new Set(defaultValues.map(String));
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-forest-900">{label}</legend>
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-[var(--radius-field)] border border-[#cbd5cc] p-2">
        {options.map((o) => (
          <li key={o.value}>
            <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-1 text-sm hover:bg-forest-50">
              <input type="checkbox" name={name} value={o.value} defaultChecked={selected.has(String(o.value))} className="size-4 accent-forest-800" />
              {o.label}
            </label>
          </li>
        ))}
      </ul>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}
