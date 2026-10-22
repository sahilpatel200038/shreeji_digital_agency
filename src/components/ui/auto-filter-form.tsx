"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * GET search/filter form that updates the URL (and so the server-rendered results) as the user types or
 * picks a value. Text is debounced; selects apply immediately. The page param is dropped so results
 * restart at page 1. Without JS it still submits as a normal GET form.
 */
export function AutoFilterForm({ children, className, label = "Search", debounceMs = 350 }: { children: ReactNode; className?: string; label?: string; debounceMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const apply = () => {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      const val = typeof v === "string" ? v.trim() : "";
      if (val) params.set(k, val);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <form
      ref={ref}
      method="get"
      role="search"
      aria-label={label}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        apply();
      }}
      onChange={(e) => {
        clearTimeout(timer.current);
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement && t.type !== "checkbox") timer.current = setTimeout(apply, debounceMs);
        else apply();
      }}
    >
      {children}
      <noscript>
        <button type="submit">Apply</button>
      </noscript>
    </form>
  );
}
