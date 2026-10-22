/** Digits-only international number for wa.me, or "" when the input is not a plausible number (8 to 15 digits). */
export function whatsappDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

/** https://wa.me/<number>?text=<message>, or null when no valid number is configured. */
export function whatsappUrl(number: string, message = ""): string | null {
  const digits = whatsappDigits(number);
  if (!digits) return null;
  const text = message.trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
