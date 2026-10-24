import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { getAuthSecret } from "@/lib/env";
import { getClientMeta } from "@/lib/crypto";
import { can, type Permission, type Role } from "@/lib/auth/permissions";
import { AppError } from "@/lib/action";

export const SESSION_COOKIE = "shreeji_session";
const SESSION_HOURS = 12;

export type SessionUser = { id: number; email: string; name: string; role: Role };

export async function createSession(user: SessionUser) {
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  const meta = await getClientMeta();
  const session = await db.session.create({
    data: { userId: user.id, expiresAt, ipHash: meta.ipHash, userAgent: meta.userAgent },
  });
  const token = await new SignJWT({ sid: session.id, uid: user.id, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getAuthSecret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/** Verifies the JWT *and* the server-side session row and user state on every call. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    if (!sid) return null;
    const session = await db.session.findUnique({
      where: { id: sid },
      include: { user: { select: { id: true, email: true, name: true, role: true, isActive: true } } },
    });
    if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
    const { isActive: _isActive, ...user } = session.user;
    void _isActive;
    return user;
  } catch {
    return null;
  }
});

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
      if (typeof payload.sid === "string") await db.session.deleteMany({ where: { id: payload.sid } });
    } catch {
      /* token invalid; just clear cookie */
    }
  }
  store.delete(SESSION_COOKIE);
}

/** For pages: redirect to login when unauthenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/admin/login");
  return user;
}

/** For pages/actions: must be signed in AND hold the permission. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) throw new AppError("You do not have permission to do that.");
  return user;
}

/** For pages: render a friendly redirect instead of throwing when lacking permission. */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/admin?denied=1");
  return user;
}

export async function revokeUserSessions(userId: number) {
  await db.session.deleteMany({ where: { userId } });
  // A user who is signed out (role change, deactivation) must not keep other administrators locked out.
  await db.editLock.deleteMany({ where: { userId } });
}
