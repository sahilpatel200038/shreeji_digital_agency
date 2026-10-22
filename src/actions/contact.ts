"use server";

import { db } from "@/lib/db";
import { AppError, fieldErrorsFrom, run, type ActionResult } from "@/lib/action";
import { leadSchema, looksLikeSpam } from "@/lib/validation/lead";
import { getClientMeta } from "@/lib/crypto";
import { hitRateLimit } from "@/lib/rate-limit";

const MIN_FILL_MS = 3_000;
const MAX_AGE_MS = 24 * 3600 * 1000;

export type ContactState = ActionResult | null;

export async function submitLead(_prev: ContactState, formData: FormData): Promise<ContactState> {
  return run(async () => {
    // Honeypot: real users never see or fill this field. Pretend success so bots learn nothing.
    if (String(formData.get("website") ?? "").length > 0) return { ok: true, message: "Thank you! We will be in touch soon." };

    const startedAt = Number(formData.get("t") ?? 0);
    const elapsed = Date.now() - startedAt;
    if (!startedAt || elapsed < MIN_FILL_MS || elapsed > MAX_AGE_MS) {
      throw new AppError("That was submitted too quickly. Please wait a moment and try again.");
    }

    const parsed = leadSchema.safeParse({
      firstName: formData.get("firstName") ?? "",
      lastName: formData.get("lastName") ?? "",
      email: formData.get("email") ?? "",
      phone: formData.get("phone") ?? "",
      company: formData.get("company") ?? "",
      service: formData.get("service") ?? "",
      message: formData.get("message") ?? "",
    });
    if (!parsed.success) throw new AppError("Please check the highlighted fields.", fieldErrorsFrom(parsed.error));
    if (looksLikeSpam(parsed.data.message)) throw new AppError("Your message contains too many links. Please remove some and try again.", { message: ["Too many links"] });

    const meta = await getClientMeta();
    const limit = await hitRateLimit(`contact:${meta.ipHash}`, 5, 3600);
    if (!limit.allowed) {
      throw new AppError(`Too many enquiries from your connection. Please try again in ${Math.ceil(limit.retryAfterSec / 60)} minute(s), or call us.`);
    }

    const source = String(formData.get("source") ?? "").slice(0, 255);
    await db.lead.create({
      data: { ...parsed.data, source: source.startsWith("/") ? source : "", ipHash: meta.ipHash, userAgent: meta.userAgent },
    });

    return { ok: true, message: "Thank you! Your enquiry has been received. We will get back to you shortly." };
  });
}
