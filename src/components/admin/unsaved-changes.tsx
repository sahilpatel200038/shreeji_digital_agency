"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";

/** What a form registers so the guard can ask "is it dirty?" and "save it now". */
export type GuardedForm = {
  isDirty: () => boolean;
  /** Submits the form and resolves true only when the server accepted the save. */
  save: () => Promise<boolean>;
};

type GuardApi = {
  register: (id: string, form: GuardedForm) => () => void;
  /** A form tells the guard it just became dirty/clean (used to arm the Back-button guard). */
  notifyDirty: (id: string, dirty: boolean) => void;
  /** Runs `proceed` now if nothing is unsaved, otherwise asks first. For buttons that navigate (sign out ...). */
  confirmLeave: (proceed: () => void) => void;
  /** True while any registered form holds unsaved edits. */
  isDirty: () => boolean;
};

const GuardCtx = createContext<GuardApi | null>(null);

export const useUnsavedGuard = () => useContext(GuardCtx);

type Pending = { go: () => void; onStay?: () => void };

/**
 * One reusable guard for the whole admin: wraps the panel, and every AdminForm registers itself.
 * It covers sidebar/menu/tab/breadcrumb links (click capture), the browser Back button (history sentinel),
 * programmatic leaves (confirmLeave) and closing/reloading the tab (beforeunload).
 */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const forms = useRef(new Map<string, GuardedForm>());
  const bypass = useRef(false);
  const sentinel = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pendingRef = useRef<Pending | null>(null);

  const anyDirty = useCallback(() => {
    if (bypass.current) return false;
    for (const f of forms.current.values()) if (f.isDirty()) return true;
    return false;
  }, []);

  /** Opens the dialog. A second request while one is open is ignored, so dialogs never stack. */
  const ask = useCallback((p: Pending) => {
    if (pendingRef.current) return;
    pendingRef.current = p;
    setPending(p);
  }, []);

  const api = useMemo<GuardApi>(
    () => ({
      register(id, form) {
        forms.current.set(id, form);
        return () => void forms.current.delete(id);
      },
      notifyDirty(_id, dirty) {
        // Arm the Back button once: one extra history entry for the same URL, so Back lands on this page first.
        if (dirty && !sentinel.current && typeof window !== "undefined") {
          sentinel.current = true;
          window.history.pushState(window.history.state, "", window.location.href);
        }
      },
      isDirty: anyDirty,
      confirmLeave(proceed) {
        if (!anyDirty()) proceed();
        else ask({ go: proceed });
      },
    }),
    [anyDirty, ask],
  );

  // A finished navigation: fresh page, fresh guard.
  useEffect(() => {
    bypass.current = false;
    sentinel.current = false;
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // a real page load: beforeunload handles it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same page or #anchor
      if (!anyDirty()) return;
      e.preventDefault();
      e.stopPropagation();
      ask({ go: () => router.push(`${url.pathname}${url.search}${url.hash}`) });
    };
    const onPopState = () => {
      if (!anyDirty()) return;
      // Back landed on this page's twin entry. Staying re-arms the sentinel; leaving goes back once more.
      ask({
        go: () => {
          bypass.current = true;
          window.history.back();
          window.setTimeout(() => (bypass.current = false), 1500);
        },
        onStay: () => window.history.pushState(window.history.state, "", window.location.href),
      });
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!anyDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [anyDirty, ask, router]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);

  function stay() {
    const p = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    p?.onStay?.();
  }

  function discard() {
    const p = pendingRef.current;
    if (!p) return;
    bypass.current = true;
    window.setTimeout(() => (bypass.current = false), 1500);
    pendingRef.current = null;
    setPending(null);
    p.go();
  }

  async function saveAndContinue() {
    const p = pendingRef.current;
    if (!p) return;
    setBusy(true);
    let ok = true;
    for (const f of [...forms.current.values()]) {
      if (!f.isDirty()) continue;
      if (!(await f.save())) {
        ok = false;
        break;
      }
    }
    setBusy(false);
    if (!ok) return stay(); // a failed or invalid save never loses the edits: stay, the form shows what is wrong
    bypass.current = true;
    window.setTimeout(() => (bypass.current = false), 1500);
    pendingRef.current = null;
    setPending(null);
    p.go();
  }

  return (
    <GuardCtx.Provider value={api}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="unsaved-title"
        aria-describedby="unsaved-desc"
        onCancel={(e) => {
          e.preventDefault();
          if (!busy) stay();
        }}
        className="m-auto w-[min(92vw,460px)] rounded-[var(--radius-card)] p-0 shadow-[var(--shadow-lift)] backdrop:bg-forest-950/50"
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-bronze-100 text-bronze-700">
              <Icon name="alert" size={18} />
            </span>
            <div>
              <h2 id="unsaved-title" className="text-xl font-bold">
                Leave without saving?
              </h2>
              <p id="unsaved-desc" className="mt-2 text-muted">
                You have unsaved changes on this page. If you leave now, those changes may be lost.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={discard} disabled={busy} className="min-h-11 rounded-lg px-4 font-semibold text-danger hover:bg-[#fbeceb] disabled:opacity-60">
              Discard changes
            </button>
            <button type="button" onClick={stay} disabled={busy} autoFocus className="min-h-11 rounded-lg border-2 border-forest-900 px-4 font-semibold text-forest-900 hover:bg-forest-50 disabled:opacity-60">
              Stay on page
            </button>
            <button type="button" onClick={saveAndContinue} disabled={busy} aria-busy={busy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-forest-900 px-5 font-semibold text-white hover:bg-forest-800 disabled:opacity-60">
              {busy && <span className="spinner" aria-hidden="true" />}
              {busy ? "Saving…" : "Save & continue"}
            </button>
          </div>
        </div>
      </dialog>
    </GuardCtx.Provider>
  );
}
