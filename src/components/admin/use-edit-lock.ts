"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HEARTBEAT_MS = 20_000;
const WAIT_POLL_MS = 8_000;

export type LockUi =
  | { status: "off" }
  | { status: "acquiring" }
  | { status: "held"; requests: string[]; offline: boolean }
  | { status: "blocked"; holder: string; message: string; key: string; requested: boolean }
  | { status: "lost"; holder: string; message: string };

function makeToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`; // non-secure contexts (plain http on a LAN)
}

async function call(op: string, keys: string[], token: string) {
  const res = await fetch("/api/admin/locks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op, keys, token }),
    cache: "no-store",
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Holds the editing lock for `keys` while the component is mounted: acquires on mount, renews every 20 s
 * (the server lease is 90 s, so a closed tab or lost connection frees the page within a minute and a half),
 * and releases on unmount / tab close. When someone else holds it, the caller renders the form read-only.
 */
export function useEditLock(keys: string[]) {
  const keyStr = keys.join("|");
  const [token] = useState(makeToken);
  const [ui, setUi] = useState<LockUi>(keyStr ? { status: "acquiring" } : { status: "off" });
  const blockedKey = useRef("");

  useEffect(() => {
    if (!keyStr) return;
    const list = keyStr.split("|");
    let stopped = false;
    let holding = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (fn: () => void, ms: number) => {
      if (!stopped) timer = setTimeout(fn, ms);
    };

    const lose = (holder: string, message: string) => {
      holding = false;
      setUi({ status: "lost", holder, message });
    };

    async function waitForRelease() {
      try {
        const { body } = await call("status", list, token);
        if (stopped) return;
        // Free now: reload so the page shows what the previous editor saved, then lock it for this tab.
        if (body.free) return void window.location.reload();
      } catch {
        /* offline: keep waiting */
      }
      schedule(waitForRelease, WAIT_POLL_MS);
    }

    async function beat() {
      try {
        const { status, body } = await call("heartbeat", list, token);
        if (stopped) return;
        if (status === 401) return lose("", "Your session has expired. Copy any unsaved text, then sign in again.");
        if (body.ok) setUi({ status: "held", requests: [...new Set(((body.requests as { name: string }[]) ?? []).map((r) => r.name))], offline: false });
        else return lose(String(body.holder ?? "another administrator"), String(body.message ?? "Your editing lock was taken over."));
      } catch {
        setUi((u) => (u.status === "held" ? { ...u, offline: true } : u));
      }
      schedule(beat, HEARTBEAT_MS);
    }

    async function start() {
      try {
        const { status, body } = await call("acquire", list, token);
        if (stopped) return;
        if (status === 401) return lose("", "Your session has expired. Sign in again to keep editing.");
        if (body.ok) {
          holding = true;
          setUi({ status: "held", requests: [], offline: false });
          return schedule(beat, HEARTBEAT_MS);
        }
        if (status === 403) return lose("", "You do not have permission to edit this.");
        blockedKey.current = String(body.key ?? list[0]);
        setUi({ status: "blocked", holder: String(body.holder ?? "another administrator"), message: String(body.message ?? ""), key: blockedKey.current, requested: false });
        schedule(waitForRelease, WAIT_POLL_MS);
      } catch {
        // Could not reach the server: do not lock the editor out of their own form; retry shortly.
        schedule(start, 4000);
      }
    }

    const release = () => {
      if (!holding) return;
      holding = false;
      try {
        navigator.sendBeacon("/api/admin/locks", new Blob([JSON.stringify({ op: "release", keys: list, token })], { type: "text/plain" }));
      } catch {
        void fetch("/api/admin/locks", { method: "POST", keepalive: true, body: JSON.stringify({ op: "release", keys: list, token }) }).catch(() => {});
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !holding) return;
      clearTimeout(timer);
      void beat();
    };

    void start();
    window.addEventListener("pagehide", release);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", release);
      document.removeEventListener("visibilitychange", onVisible);
      release();
    };
  }, [keyStr, token]);

  const requestAccess = useCallback(async () => {
    try {
      await call("request", [blockedKey.current || keyStr.split("|")[0]], token);
      setUi((u) => (u.status === "blocked" ? { ...u, requested: true } : u));
    } catch {
      /* the button stays available to retry */
    }
  }, [keyStr, token]);

  return { ui, token, requestAccess, locked: ui.status === "blocked" || ui.status === "lost" };
}
