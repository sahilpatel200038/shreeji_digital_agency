"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { submitLead, type ContactState } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

function Field({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const id = `f-${name}`;
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-forest-900">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children({ id, describedBy: error ? errId : undefined, invalid: Boolean(error) })}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const input =
  "min-h-12 w-full rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40 aria-[invalid=true]:border-danger";

/** The one site-wide enquiry form. The page it is on is recorded as the lead source, and a service page preselects its service. */
export function ContactForm({ services }: { services: { slug: string; title: string }[] }) {
  const pathname = usePathname();
  const source = pathname || "/";
  const defaultService = services.find((s) => pathname === `/services/${s.slug}`)?.title ?? "";
  const [state, action, pending] = useActionState<ContactState, FormData>(submitLead, null);
  const [startedAt, setStartedAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartedAt(Date.now());
  }, []);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStartedAt(Date.now());
    }
  }, [state]);

  const fe = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const first = (k: string) => fe[k]?.[0];

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        // Dispatch manually so React does not reset the fields when validation fails.
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate className="space-y-5" aria-describedby="contact-status">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="firstName" required error={first("firstName")}>
          {(p) => <input {...fieldProps(p)} name="firstName" type="text" autoComplete="given-name" required className={input} />}
        </Field>
        <Field label="Last name" name="lastName" error={first("lastName")}>
          {(p) => <input {...fieldProps(p)} name="lastName" type="text" autoComplete="family-name" className={input} />}
        </Field>
        <Field label="Email address" name="email" required error={first("email")}>
          {(p) => <input {...fieldProps(p)} name="email" type="email" autoComplete="email" required className={input} />}
        </Field>
        <Field label="Phone number" name="phone" error={first("phone")}>
          {(p) => <input {...fieldProps(p)} name="phone" type="tel" autoComplete="tel" className={input} />}
        </Field>
        <Field label="Company" name="company" error={first("company")}>
          {(p) => <input {...fieldProps(p)} name="company" type="text" autoComplete="organization" className={input} />}
        </Field>
        <Field label="Service you are interested in" name="service" error={first("service")}>
          {(p) => (
            <select key={defaultService} {...fieldProps(p)} name="service" defaultValue={defaultService} className={input}>
              <option value="">Not sure yet</option>
              {services.map((s) => (
                <option key={s.slug} value={s.title}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="How can we help?" name="message" required error={first("message")}>
        {(p) => <textarea {...fieldProps(p)} name="message" rows={5} required className={`${input} resize-y`} />}
      </Field>

      {/* Honeypot + timing + source (hidden from users and assistive tech) */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="f-website">Leave this field empty</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <input type="hidden" name="t" value={startedAt} />
      <input type="hidden" name="source" value={source} />

      <div id="contact-status" aria-live="polite">
        {state?.ok && (
          <p className="flex items-start gap-2 rounded-[var(--radius-field)] bg-forest-50 p-4 font-medium text-forest-800">
            <Icon name="check" className="mt-0.5 shrink-0" />
            {state.message}
          </p>
        )}
        {state && !state.ok && (
          <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-field)] bg-[#fbeceb] p-4 font-medium text-danger">
            <Icon name="alert" className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}
      </div>

      <Button type="submit" variant="primary" size="lg" loading={pending} arrow className="w-full sm:w-auto">
        {pending ? "Sending…" : "Send enquiry"}
      </Button>
      <p className="text-sm text-muted">We use your details only to respond to your enquiry. See our <Link href="/privacy-policy" className="font-semibold text-bronze-700 underline">Privacy Policy</Link>.</p>
    </form>
  );
}

function fieldProps(p: { id: string; describedBy?: string; invalid: boolean }) {
  return { id: p.id, "aria-describedby": p.describedBy, "aria-invalid": p.invalid || undefined };
}
