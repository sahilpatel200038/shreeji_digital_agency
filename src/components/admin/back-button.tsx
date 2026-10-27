"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUnsavedGuard } from "@/components/admin/unsaved-changes";
import { Icon } from "@/components/ui/icons";

/**
 * In-app navigation trail for this tab, so the Back button can tell "I got here from another admin page" (go back, which keeps
 * the list's filters and page) from "I opened this URL directly / reloaded" (no history to return to: go to the parent list).
 */
const trail: string[] = [];

export function AdminNavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (trail[trail.length - 1] === pathname) return;
    if (trail.length > 1 && trail[trail.length - 2] === pathname) trail.pop(); // moved back
    else trail.push(pathname);
  }, [pathname]);
  return null;
}

/** Consistent "Back" control for admin edit and detail pages. `fallbackHref` is the parent listing used when there is no in-app history. */
export function BackButton({ fallbackHref, label = "Back" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  const guard = useUnsavedGuard();

  function go() {
    // A dirty form arms the guard with an extra history entry for the same URL, so after "Discard" history.back() would only land on
    // that twin entry. Going to the parent list directly is correct in that case; otherwise return to where the user came from.
    const wasDirty = guard?.isDirty() ?? false;
    const proceed = () => (!wasDirty && trail.length > 1 ? router.back() : router.push(fallbackHref));
    if (guard) guard.confirmLeave(proceed);
    else proceed();
  }

  return (
    <button
      type="button"
      onClick={go}
      className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-field)] border border-line bg-white px-3.5 text-sm font-semibold text-forest-900 transition hover:bg-forest-50"
    >
      <Icon name="chevron-down" size={16} className="rotate-90" />
      {label}
    </button>
  );
}
