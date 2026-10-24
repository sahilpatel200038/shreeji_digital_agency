import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { acquireLocks, canLock, heartbeatLocks, isValidLockKey, lockStatus, releaseLocks, requestAccess } from "@/lib/edit-lock";

export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Cookie is SameSite=Lax; this is defence in depth for state-changing calls (navigator.sendBeacon sends Origin too). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("host") ?? "");
  } catch {
    return false;
  }
}

type Body = { op?: unknown; keys?: unknown; token?: unknown };

/**
 * Edit-lock calls from the admin UI: acquire | heartbeat | release | status | request.
 * Body is read as text because navigator.sendBeacon (used on tab close) does not send JSON headers.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Forbidden" }, 403);
  const user = await getSession();
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: Body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  const keys = Array.isArray(body.keys) ? body.keys.slice(0, 12) : [];
  const token = typeof body.token === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.token) ? body.token : null;
  if (keys.length === 0 || !keys.every(isValidLockKey)) return json({ error: "Bad request" }, 400);
  if (!keys.every((k) => canLock(user, k))) return json({ error: "Forbidden" }, 403);
  const list = keys as string[];

  switch (body.op) {
    case "acquire": {
      if (!token) return json({ error: "Bad request" }, 400);
      const conflict = await acquireLocks(user, list, token, { claim: true }); // opening an editor takes over this user's own stale locks
      return conflict ? json({ ok: false, holder: conflict.holderName, sameUser: conflict.sameUser, key: conflict.key, message: conflict.message }) : json({ ok: true });
    }
    case "heartbeat": {
      if (!token) return json({ error: "Bad request" }, 400);
      const res = await heartbeatLocks(user, list, token);
      return res.ok
        ? json({ ok: true, requests: res.requests })
        : json({ ok: false, holder: res.conflict.holderName, sameUser: res.conflict.sameUser, key: res.conflict.key, message: res.conflict.message });
    }
    case "release": {
      if (!token) return json({ error: "Bad request" }, 400);
      await releaseLocks(user, list, token);
      return json({ ok: true });
    }
    case "status": {
      const conflict = await lockStatus(user, list, token);
      return json(conflict ? { free: false, holder: conflict.holderName, sameUser: conflict.sameUser, key: conflict.key, message: conflict.message } : { free: true });
    }
    case "request": {
      const res = await requestAccess(user, list[0]);
      return json(res);
    }
    default:
      return json({ error: "Bad request" }, 400);
  }
}
