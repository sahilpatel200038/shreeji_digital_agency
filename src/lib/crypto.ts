import { createHash } from "node:crypto";
import { headers } from "next/headers";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getIpSalt(): string {
  const salt = process.env.IP_HASH_SALT;
  if (salt) return salt;
  // A guessable salt makes the stored IP hashes reversible, so production must set a real one.
  if (process.env.NODE_ENV === "production") throw new Error("IP_HASH_SALT must be set in production");
  return "dev-salt";
}

export function hashIp(ip: string): string {
  return sha256(`${getIpSalt()}:${ip}`);
}

export async function getClientMeta(): Promise<{ ipHash: string; userAgent: string }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || h.get("x-real-ip") || "unknown";
  return { ipHash: hashIp(ip), userAgent: (h.get("user-agent") ?? "").slice(0, 255) };
}
