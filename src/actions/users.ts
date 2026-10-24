"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, run, type ActionResult } from "@/lib/action";
import { assertEditLocks, lockKey } from "@/lib/edit-lock";
import { requirePermission, revokeUserSessions } from "@/lib/auth/session";
import { hashPassword, passwordProblems } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { diffFields } from "@/lib/audit-format";

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR"]);

async function assertNotLastSuperAdmin(userId: number) {
  const target = await db.user.findUnique({ where: { id: userId } });
  if (target?.role === "SUPER_ADMIN" && target.isActive) {
    const others = await db.user.count({ where: { role: "SUPER_ADMIN", isActive: true, NOT: { id: userId } } });
    if (others === 0) throw new AppError("There must always be at least one active Super Admin.");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().max(190).pipe(z.email("Enter a valid email")),
  role: roleSchema,
});

export async function createUser(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("users:manage");
    const parsed = createSchema.safeParse({ name: fd.get("name") ?? "", email: fd.get("email") ?? "", role: fd.get("role") });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const password = String(fd.get("password") ?? "");
    const problem = passwordProblems(password);
    if (problem) throw new AppError(problem, { password: [problem] });
    if (await db.user.findUnique({ where: { email: parsed.data.email } })) throw new AppError("A user with this email already exists.", { email: ["Already registered"] });
    const u = await db.user.create({ data: { ...parsed.data, passwordHash: await hashPassword(password) } });
    await audit(actor.id, "user.create", "user", u.id, `${u.email} (${u.role})`, { entityName: u.email, after: { name: u.name, email: u.email, role: u.role } });
    redirect(`/admin/users?msg=${encodeURIComponent(`User ${u.email} created`)}`);
  });
}

const updateSchema = z.object({ name: z.string().trim().min(1, "Name is required").max(120), role: roleSchema });

export async function updateUser(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("users:manage");
    const id = Number(fd.get("id"));
    await assertEditLocks(actor, [lockKey.user(id)], fd);
    const parsed = updateSchema.safeParse({ name: fd.get("name") ?? "", role: fd.get("role") });
    if (!parsed.success) throw new AppError("Please fix the highlighted fields.", fieldErrorsFrom(parsed.error));
    const isActive = fd.get("isActive") === "on";
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new AppError("That user no longer exists.");
    if (id === actor.id && !isActive) throw new AppError("You cannot deactivate your own account.");
    if (target.role === "SUPER_ADMIN" && (parsed.data.role !== "SUPER_ADMIN" || !isActive)) await assertNotLastSuperAdmin(id);
    await db.user.update({ where: { id }, data: { ...parsed.data, isActive } });
    // Role or access changes take effect immediately by ending existing sessions.
    if (parsed.data.role !== target.role || !isActive) await revokeUserSessions(id === actor.id ? -1 : id);
    const changes = diffFields({ name: target.name, role: target.role, isActive: target.isActive }, { name: parsed.data.name, role: parsed.data.role, isActive });
    await audit(actor.id, "user.update", "user", id, `${target.email}: role ${target.role} → ${parsed.data.role}, active ${isActive}`, { entityName: target.email, before: changes?.before, after: changes?.after });
    return { ok: true, message: "User updated." };
  });
}

export async function resetUserPassword(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const actor = await requirePermission("users:manage");
    const id = Number(fd.get("id"));
    const password = String(fd.get("password") ?? "");
    const problem = passwordProblems(password);
    if (problem) throw new AppError(problem, { password: [problem] });
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new AppError("That user no longer exists.");
    await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
    await revokeUserSessions(id);
    await audit(actor.id, "user.password-reset", "user", id, target.email);
    return { ok: true, message: "Password updated. The user has been signed out everywhere." };
  });
}
