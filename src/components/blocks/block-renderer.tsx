import Image from "next/image";
import type { Block } from "@/lib/blocks/schema";
import { Inline } from "@/components/blocks/inline";
import { FaqAccordion } from "@/components/ui/faq-accordion";
import { ButtonLink } from "@/components/ui/button";

export function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose-brand space-y-5 text-[1.0625rem]">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} className="t-h2 !mt-12 first:!mt-0">
                {b.text}
              </h2>
            ) : (
              <h3 key={i} className="t-h3 !mt-8">
                {b.text}
              </h3>
            );
          case "paragraph":
            return (
              <p key={i}>
                <Inline text={b.text} />
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`space-y-2 pl-6 ${b.ordered ? "list-decimal" : "list-disc"} marker:text-bronze-500`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inline text={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "image":
            return (
              <figure key={i} className="!my-8">
                <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-forest-50">
                  <Image src={`/media/${b.mediaId}`} alt={b.alt} fill sizes="(min-width: 820px) 780px, 100vw" className="object-cover" />
                </div>
                {b.caption && <figcaption className="mt-2 text-center text-sm text-muted">{b.caption}</figcaption>}
              </figure>
            );
          case "quote":
            return (
              <blockquote key={i} className="rounded-r-xl border-l-4 border-bronze-500 bg-bronze-100/50 px-6 py-4 text-lg italic">
                <p>{b.text}</p>
                {b.cite && <footer className="mt-2 text-sm font-semibold not-italic text-bronze-700">{b.cite}</footer>}
              </blockquote>
            );
          case "callout":
            return (
              <aside key={i} className="rounded-[var(--radius-card)] border border-gold-300/60 bg-gold-200/20 p-5">
                {b.title && <p className="mb-1 font-bold text-forest-900">{b.title}</p>}
                <p className="!text-muted">
                  <Inline text={b.text} />
                </p>
              </aside>
            );
          case "cta":
            return (
              <div key={i} className="!my-10 rounded-[var(--radius-panel)] bg-brand-glow p-8 text-white md:p-10">
                <p className="t-h3 !text-white">{b.title}</p>
                {b.text && <p className="mt-2 max-w-xl !text-white/80">{b.text}</p>}
                <ButtonLink href={b.href} variant="accent" className="mt-6" arrow>
                  {b.label}
                </ButtonLink>
              </div>
            );
          case "faq":
            return (
              <div key={i} className="!my-8">
                <FaqAccordion items={b.items} />
              </div>
            );
          case "divider":
            return <hr key={i} className="my-8 border-line" />;
        }
      })}
    </div>
  );
}
