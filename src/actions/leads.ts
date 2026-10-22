"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, run, type ActionResult } from "@/lib/action";
import { requirePermission } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { flashOnError } from "@/lib/admin-actions";

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"] as const;

export async function updateLeadStatus(fd: FormData): Promise<void> {
  const id = Number(fd.get("id"));
  await flashOnError(`/admin/leads/${id}`, async () => {
    const user = await requirePermission("leads:read");
    const status = z.enum(STATUSES).safeParse(fd.get("status"));
    if (!status.success) throw new AppError("Invalid status.");
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) throw new AppError("That lead no longer exists.");
    await db.lead.update({ where: { id }, data: { status: status.data } });
    await audit(user.id, "lead.status", "lead", id, `${lead.status} → ${status.data}`);
    return "Status updated";
  });
}

export async function addLeadNote(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return run(async () => {
    const user = await requirePermission("leads:read");
    const id = Number(fd.get("leadId"));
    const parsed = z.object({ body: z.string().trim().min(1, "Write a note first").max(2000) }).safeParse({ body: fd.get("body") ?? "" });
    if (!parsed.success) throw new AppError("Write a note first.", fieldErrorsFrom(parsed.error));
    if (!(await db.lead.findUnique({ where: { id }, select: { id: true } }))) throw new AppError("That lead no longer exists.");
    await db.leadNote.create({ data: { leadId: id, authorId: user.id, body: parsed.data.body } });
    await audit(user.id, "lead.note", "lead", id, "Added a note");
    revalidatePath(`/admin/leads/${id}`);
    return { ok: true, message: "Note added." };
  });
}

export async function deleteLead(fd: FormData): Promise<void> {
  await flashOnError("/admin/leads", async () => {
    const user = await requirePermission("leads:delete");
    const id = Number(fd.get("id"));
    const lead = await db.lead.findUnique({ where: { id } });
    if (!lead) throw new AppError("That lead no longer exists.");
    await db.lead.delete({ where: { id } });
    await audit(user.id, "lead.delete", "lead", id, "Lead deleted");
    return "Lead deleted";
  });
}
