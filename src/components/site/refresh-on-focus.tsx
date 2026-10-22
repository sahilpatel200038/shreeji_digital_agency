"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Pages are cached on the server (and every admin save invalidates them), but a tab that stays open keeps what it
 * already rendered, and in-app navigation reuses the layout (header, footer, enquiry section) without re-fetching it.
 * So content edited in the admin panel would only show after a manual reload. This re-fetches the current route:
 *  - when the tab comes back into view after being away for a while, and
 *  - when the visitor navigates and the last fetch is older than `maxAgeMs`.
 */
export function RefreshOnFocus({ minAwayMs = 10_000, maxAgeMs = 30_000 }: { minAwayMs?: number; maxAgeMs?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const hiddenAt = useRef<number | null>(null);
  const fetchedAt = useRef(0);
  const lastPath = useRef(pathname);

  useEffect(() => {
    fetchedAt.current = Date.now();
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        const away = Date.now() - hiddenAt.current;
        hiddenAt.current = null;
        if (away >= minAwayMs) {
          fetchedAt.current = Date.now();
          router.refresh();
        }
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router, minAwayMs]);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;
    if (Date.now() - fetchedAt.current > maxAgeMs) {
      fetchedAt.current = Date.now();
      router.refresh();
    }
  }, [pathname, router, maxAgeMs]);

  return null;
}
