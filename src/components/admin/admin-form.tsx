"use client";

import { createContext, startTransition, useActionState, useContext, useId, useState } from "react";
import type { ActionResult } from "@/lib/action";
import { Icon } from "@/components/ui/icons";

const ErrorsCtx = createContext<Record<string, string[]>>({});

export const inputClass =
  "min-h-11 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-muted/60 focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40 aria-[invalid=true]:border-danger disabled:bg-forest-50";

type Action = (prev: ActionResult<unknown> | null, formData: FormData) => Promise<ActionResult<unknown>>;

export function AdminForm({
  action,
  children,
  submitLabel = "Save changes",
  className,
  footer,
}: {
  action: Action;
  children: React.ReactNode;
  submitLabel?: string;
  className?: string;
  footer?: React.ReactNode;
}) {
  const [state, dispatch, pending] = useActionState(action, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return (
    <ErrorsCtx.Provider value={errors}>
      <form
        className={className ?? "space-y-6"}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => dispatch(data));
        }}
      >
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
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] bg-forest-900 px-6 font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60"
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            {pending ? "Saving…" : submitLabel}
          </button>
          {footer}
        </div>
      </form>
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
