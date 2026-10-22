import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getClientMeta } from "@/lib/crypto";
import { actionTypeFor, moduleFor, sanitizeValues } from "@/lib/audit-format";

export type AuditExtras = {
  /** Title or name of the affected record. Defaults to the summary. */
  entityName?: string;
  /** Changed fields only (see diffFields). Sensitive keys are redacted before saving. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

/**
 * Records an administrative action. Call it only after the change has succeeded, so a failed or rolled-back
 * change is never logged as done. Entries are append-only: nothing in the app updates or deletes them.
 */
export async function audit(
  userId: number | null,
  action: string,
  entityType = "",
  entityId: string | number = "",
  summary = "",
  extras: AuditExtras = {},
) {
  try {
    const [meta, requestId, user] = await Promise.all([
      getClientMeta().catch(() => ({ ipHash: null as string | null })),
      headers().then((h) => h.get("x-request-id") ?? "").catch(() => ""),
      userId ? db.user.findUnique({ where: { id: userId }, select: { name: true } }) : null,
    ]);
    const oldValues = sanitizeValues(extras.before) as Prisma.InputJsonObject | null;
    const newValues = sanitizeValues(extras.after) as Prisma.InputJsonObject | null;
    await db.auditLog.create({
      data: {
        userId,
        userName: (user?.name ?? "").slice(0, 120),
        action: action.slice(0, 80),
        actionType: actionTypeFor(action),
        module: moduleFor(entityType).slice(0, 60),
        entityType: entityType.slice(0, 60),
        entityId: String(entityId).slice(0, 60),
        entityName: (extras.entityName ?? summary).slice(0, 190),
        summary: summary.slice(0, 500),
        ipHash: meta.ipHash,
        requestId: requestId.slice(0, 64),
        ...(oldValues ? { oldValues } : {}),
        ...(newValues ? { newValues } : {}),
      },
    });
  } catch (err) {
    console.error(JSON.stringify({ level: "error", msg: "audit_failed", action, error: String(err) }));
  }
}
