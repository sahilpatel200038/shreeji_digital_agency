import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <section className={cn("rounded-[var(--radius-card)] border border-line bg-white p-5 md:p-6", className)}>
      {title && <h2 className="mb-4 text-lg font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Flash({ params }: { params: { msg?: string; err?: string } }) {
  if (!params.msg && !params.err) return null;
  const ok = Boolean(params.msg);
  return (
    <p
      role={ok ? "status" : "alert"}
      className={cn("mb-5 flex items-center gap-2 rounded-[var(--radius-field)] p-3.5 font-medium", ok ? "bg-forest-50 text-forest-800" : "bg-[#fbeceb] text-danger")}
    >
      <Icon name={ok ? "check" : "alert"} size={18} /> {(params.msg ?? params.err ?? "").slice(0, 200)}
    </p>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "bg-forest-100 text-forest-800",
    DRAFT: "bg-bronze-100 text-bronze-700",
    NEW: "bg-gold-200 text-forest-950",
    CONTACTED: "bg-forest-50 text-forest-800",
    QUALIFIED: "bg-forest-100 text-forest-800",
    WON: "bg-forest-800 text-white",
    LOST: "bg-line text-muted",
    SPAM: "bg-[#fbeceb] text-danger",
  };
  return <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold", map[status] ?? "bg-line text-muted")}>{status[0] + status.slice(1).toLowerCase()}</span>;
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-white">{children}</div>;
}

export const th = "whitespace-nowrap bg-forest-50 px-4 py-3 text-left text-xs font-bold tracking-wider text-forest-800 uppercase";
export const td = "px-4 py-3 align-middle text-[15px]";

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "outline" }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-field)] px-5 font-semibold transition",
        variant === "primary" ? "bg-forest-900 text-white hover:bg-forest-800" : "border-2 border-forest-900 text-forest-900 hover:bg-forest-900 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-muted">{children}</p>;
}

export function Pager({ page, pages, base }: { page: number; pages: number; base: URLSearchParams }) {
  if (pages <= 1) return null;
  const href = (n: number) => {
    const p = new URLSearchParams(base);
    p.set("page", String(n));
    return `?${p.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-between text-sm">
      <span className="text-muted">
        Page {page} of {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-lg border border-line bg-white px-4 py-2 font-semibold hover:border-bronze-300">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-lg border border-line bg-white px-4 py-2 font-semibold hover:border-bronze-300">
            Next
          </Link>
        )}
      </span>
    </nav>
  );
}

/** Search + filter bar. Updates the list as you type or choose (debounced); a plain GET form without JS. */
export function FilterBar({
  q,
  placeholder = "Search…",
  filters,
}: {
  q?: string;
  placeholder?: string;
  filters?: { name: string; label: string; value?: string; options: { value: string; label: string }[] }[];
}) {
  const field = "min-h-11 rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white px-3.5 text-[15px] focus:border-forest-700 focus:outline-none focus:ring-4 focus:ring-gold-300/40";
  return (
    <AutoFilterForm className="mb-5 flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="admin-q">
        Search
      </label>
      <input id="admin-q" name="q" defaultValue={q} placeholder={placeholder} className={cn(field, "min-w-0 flex-1 basis-56")} />
      {filters?.map((f) => (
        <label key={f.name} className="contents">
          <span className="sr-only">{f.label}</span>
          <select name={f.name} defaultValue={f.value ?? ""} className={field}>
            <option value="">{f.label}</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </AutoFilterForm>
  );
}
