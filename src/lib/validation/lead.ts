import { z } from "zod";

const clean = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);

export const leadSchema = z.object({
  firstName: clean(100).min(1, "Please enter your first name"),
  lastName: clean(100).default(""),
  email: z.string().trim().toLowerCase().max(190).pipe(z.email("Please enter a valid email address")),
  phone: clean(40)
    .default("")
    .refine((v) => v === "" || /^[+\d][\d\s().-]{6,}$/.test(v), "Please enter a valid phone number"),
  company: clean(160).default(""),
  service: clean(160).default(""),
  message: clean(3000).min(10, "Please tell us a little more (at least 10 characters)"),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Link-stuffed messages are almost always spam. */
export function looksLikeSpam(message: string): boolean {
  const links = message.match(/https?:\/\/|www\./gi)?.length ?? 0;
  return links > 2;
}
