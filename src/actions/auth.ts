"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { releaseAllFor } from "@/lib/edit-lock";
import { db } from "@/lib/db";
import { AppError, run, type ActionResult } from "@/lib/action";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession } from "@/lib/auth/session";
import { clearRateLimit, hitRateLimit } from "@/lib/rate-limit";
import { getClientMeta, sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { safeAdminNext } from "@/lib/safe-url";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(190).pipe(z.email()),
  password: z.string().min(1).max(200),
});

export async function login(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
    if (!parsed.success) throw new AppError("Enter a valid email and password.");
    const { email, password } = parsed.data;

    const meta = await getClientMeta();
    const emailKey = `login:email:${sha256(email)}`;
    const [byIp, byEmail] = await Promise.all([
      hitRateLimit(`login:ip:${meta.ipHash}`, 20, 15 * 60),
      hitRateLimit(emailKey, 5, 15 * 60),
    ]);
    if (!byIp.allowed || !byEmail.allowed) {
      const wait = Math.ceil(Math.max(byIp.retryAfterSec, byEmail.retryAfterSec) / 60);
      throw new AppError(`Too many sign-in attempts. Please try again in ${wait} minute(s).`);
    }

    const user = await db.user.findUnique({ where: { email } });
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok || !user.isActive) {
      await audit(user?.id ?? null, "login.failed", "user", user?.id ?? "", `Failed sign-in for ${email.slice(0, 80)}`);
      throw new AppError("Invalid email or password.");
    }

    await clearRateLimit(emailKey);
    await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit(user.id, "login", "user", user.id, "Signed in");
    redirect(safeAdminNext(String(formData.get("next") ?? "")));
  });
}

export async function logout(): Promise<void> {
  const user = await getSession();
  await destroySession();
  if (user) {
    await releaseAllFor(user.id); // signing out ends any editing sessions
    await audit(user.id, "logout", "user", user.id, "Signed out");
  }
  redirect("/admin/login");
}
