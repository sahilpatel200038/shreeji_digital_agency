import Link from "next/link";
import type { ReactNode } from "react";
import { isExternal, isSafeHref } from "@/lib/safe-url";

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;

/**
 * Renders the tiny inline syntax editors can use (**bold**, *italic*, [text](url)) as React
 * elements. No HTML is ever injected; links must pass isSafeHref or are rendered as plain text.
 */
export function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(TOKEN).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label, href] = link;
      if (!isSafeHref(href)) return <span key={i}>{label}</span>;
      if (isExternal(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return (
          <a key={i} href={href} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {label}
          </a>
        );
      }
      return (
        <Link key={i} href={href}>
          {label}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
