import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/action";

/** Redirect back to a list with a flash message. */
export function flash(path: string, kind: "msg" | "err", text: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(text.slice(0, 180))}`);
}

/** Wrap a void admin action so failures become a flash message rather than an error page. */
export async function flashOnError(path: string, fn: () => Promise<string>): Promise<never> {
  let message: string;
  try {
    message = await fn();
  } catch (err) {
    if (err instanceof AppError) flash(path, "err", err.message);
    // Next's redirect/notFound throw special errors that must pass through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(JSON.stringify({ level: "error", msg: "admin_action_failed", error: String(err) }));
    flash(path, "err", "Something went wrong. Please try again.");
  }
  flash(path, "msg", message);
}

/**
 * When a published URL changes, keep old links working with a 301.
 * Also removes any redirect that would now point away from the live URL (prevents loops).
 */
export async function redirectOnSlugChange(tx: Prisma.TransactionClient, base: string, oldSlug: string, newSlug: string) {
  if (oldSlug === newSlug) return;
  const from = `${base}/${oldSlug}`.replace(/\/{2,}/g, "/");
  const to = `${base}/${newSlug}`.replace(/\/{2,}/g, "/");
  await tx.redirect.deleteMany({ where: { fromPath: to } });
  await tx.redirect.upsert({
    where: { fromPath: from },
    create: { fromPath: from, toPath: to, statusCode: 301 },
    update: { toPath: to, statusCode: 301, isActive: true },
  });
  // Re-point chains (A -> old) at the new URL so there are no multi-hop redirects.
  await tx.redirect.updateMany({ where: { toPath: from }, data: { toPath: to } });
}
