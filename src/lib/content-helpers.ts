import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/action";
import { isValidSlug, RESERVED_SLUGS, slugify } from "@/lib/slug";
import { blocksSchema, type Block } from "@/lib/blocks/schema";
import { fieldErrorsFrom } from "@/lib/action";
import { sanitizeRichText } from "@/lib/rich-text";

export type SlugModel = "page" | "post" | "service" | "project";

/** Normalise + validate a slug, enforcing uniqueness for the model. `currentId` excludes the row being edited. */
export async function resolveSlug(
  tx: Prisma.TransactionClient,
  model: SlugModel,
  raw: string,
  fallbackFrom: string,
  currentId?: number,
  opts: { checkReserved?: boolean } = {},
): Promise<string> {
  const slug = slugify(raw.trim() || fallbackFrom);
  if (!isValidSlug(slug)) throw new AppError("Please enter a valid URL slug.", { slug: ["Use lowercase letters, numbers and hyphens"] });
  if (opts.checkReserved && RESERVED_SLUGS.has(slug)) {
    throw new AppError("That slug is reserved by the system.", { slug: [`"${slug}" is reserved. Choose another.`] });
  }
  const where = { slug, ...(currentId ? { NOT: { id: currentId } } : {}) };
  const delegate = tx[model] as unknown as { count: (args: { where: unknown }) => Promise<number> };
  const clash = await delegate.count({ where });
  if (clash > 0) throw new AppError("That slug is already in use.", { slug: ["Another item already uses this slug. Choose a different one."] });
  return slug;
}

export function parseBlocksField(raw: FormDataEntryValue | null): Block[] {
  let json: unknown = [];
  try {
    json = JSON.parse(String(raw ?? "[]"));
  } catch {
    throw new AppError("The content could not be read. Please reload the page and try again.");
  }
  // Drop empty list lines the editor may leave behind before validating.
  if (Array.isArray(json)) {
    json = json.map((b) => (b && b.type === "list" && Array.isArray(b.items) ? { ...b, items: b.items.map((i: string) => String(i).trim()).filter(Boolean) } : b));
  }
  const parsed = blocksSchema.safeParse(json);
  if (!parsed.success) {
    const fe = fieldErrorsFrom(parsed.error);
    const first = parsed.error.issues[0];
    const idx = typeof first?.path[0] === "number" ? first.path[0] + 1 : null;
    throw new AppError(idx ? `Block ${idx} needs attention: ${first.message}` : "Some content blocks are incomplete.", { blocks: Object.values(fe).flat().slice(0, 3) });
  }
  // Rich text is sanitised on the way in as well as on render, so unsafe markup is never stored.
  return parsed.data.map((b) => (b.type === "richtext" ? { ...b, html: sanitizeRichText(b.html) } : b));
}

/** Parse "A | B" per-line repeaters used in service editors. */
export function parsePairs(raw: string, keys: [string, string]): Record<string, string>[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, ...rest] = line.split("|");
      return { [keys[0]]: a.trim(), [keys[1]]: rest.join("|").trim() };
    })
    .filter((o) => o[keys[0]] && o[keys[1]]);
}

export function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function dateFromInput(raw: FormDataEntryValue | null): Date | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDatetimeLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  // Rendered in IST so editors see the same clock as the audience.
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  return `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())}T${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`;
}

/** Inverse of toDatetimeLocal: interpret a datetime-local string as IST. */
export function fromDatetimeLocal(raw: FormDataEntryValue | null): Date | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}
