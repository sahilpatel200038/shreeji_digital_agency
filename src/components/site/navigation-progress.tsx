"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/** A navigation faster than this shows nothing at all (cached or static pages feel instant). */
const BAR_AFTER_MS = 120;
/** Still waiting after this long: dim the page and show the branded loader. */
const OVERLAY_AFTER_MS = 1200;
/** Never leave a loader up longer than this, whatever happens (failed fetch, error page, aborted navigation). */
const GIVE_UP_MS = 12_000;

type Phase = "idle" | "bar" | "overlay";

/** The pathname a click on this link would navigate to inside the app, or null if it is not an in-app route change. */
function targetPath(a: HTMLAnchorElement, e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url.pathname;
}

/**
 * Feedback for real navigations only. Header and footer stay mounted (they live in the layout), so the page itself
 * keeps showing until the next one is ready. We add: nothing for fast navigations, a slim top bar once one is
 * noticeably slow, and a branded overlay if it is slow enough that the visitor could think the site is stuck.
 * Ends when the pathname changes; a timeout guarantees it can never stick.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const current = useRef(pathname);

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const end = useCallback(() => {
    clear();
    setPhase("idle");
  }, [clear]);

  const begin = useCallback(() => {
    clear();
    timers.current = [
      setTimeout(() => setPhase("bar"), BAR_AFTER_MS),
      setTimeout(() => setPhase("overlay"), OVERLAY_AFTER_MS),
      setTimeout(end, GIVE_UP_MS),
    ];
  }, [clear, end]);

  // The destination rendered: finish.
  useEffect(() => {
    current.current = pathname;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    end();
  }, [pathname, end]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const path = targetPath(a, e);
      if (path !== null && path !== current.current) begin();
    };
    const onPop = () => {
      if (window.location.pathname !== current.current) begin();
    };
    // Capture phase: next/link calls preventDefault() in its own handler, which would otherwise hide the click from us.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      clear();
    };
  }, [begin, clear]);

  if (phase === "idle") return null;
  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-transparent" role="presentation">
        <div className="nav-progress-bar h-full w-full origin-left bg-gradient-to-r from-gold-300 to-bronze-500" />
      </div>
      {phase === "overlay" && (
        <div
          role="status"
          aria-live="polite"
          className="nav-overlay fixed inset-0 z-[65] grid place-items-center bg-forest-950/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-5 text-white">
            <Image src="/brand/logo-mark.png" alt="" width={64} height={58} className="h-14 w-auto" />
            <span className="size-8 animate-spin rounded-full border-[3px] border-white/25 border-t-gold-300 motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-wide text-white/80">Loading…</span>
          </div>
        </div>
      )}
    </>
  );
}
