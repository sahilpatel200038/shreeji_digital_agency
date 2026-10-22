import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/motion/reveal";

/** `.container`: the one content width, margin and padding for the whole site. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("container", className)}>{children}</div>;
}

/** `.row`: the layout block inside a container. Grids and flex layouts for a section go on its className. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("row", className)}>{children}</div>;
}

/**
 * Shared page banner: full-width brand background; content sits in `.container > .row`.
 * Defaults to full screen (viewport minus the sticky header) and grows with its content, never a fixed 100vh.
 */
export function Banner({
  children,
  as: Tag = "header",
  size = "hero",
  className,
  rowClassName,
}: {
  children: ReactNode;
  as?: "header" | "section";
  size?: "page" | "hero";
  className?: string;
  rowClassName?: string;
}) {
  const heights = {
    page: "min-h-[clamp(15rem,30svh,22rem)]",
    // Full screen: the viewport minus the sticky header (72px); grows with content on small screens.
    hero: "min-h-[max(30rem,calc(100svh-72px))]",
  };
  return (
    <Tag className={cn("section section--banner bg-brand-glow relative flex items-center overflow-hidden text-white", heights[size], className)}>
      <Container className="py-12 md:py-16">
        <Row className={rowClassName}>{children}</Row>
      </Container>
    </Tag>
  );
}

type Tone = "paper" | "white" | "forest";

export function Section({
  children,
  tone = "paper",
  className,
  id,
  labelledBy,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  id?: string;
  labelledBy?: string;
}) {
  const tones: Record<Tone, string> = {
    paper: "bg-paper",
    white: "bg-white",
    forest: "bg-brand-glow text-white [&_h2]:text-white [&_h3]:text-white",
  };
  return (
    <section id={id} aria-labelledby={labelledBy} className={cn("section", `section--${tone}`, "py-16 md:py-24", tones[tone], className)}>
      <Container>
        <Row>{children}</Row>
      </Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  id,
  align = "left",
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  text?: string;
  id?: string;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl md:mb-14", align === "center" && "mx-auto text-center")}>
      {eyebrow && (
        <p className={cn("mb-3 text-sm font-semibold tracking-[0.14em] uppercase", tone === "dark" ? "text-gold-300" : "text-bronze-700")}>{eyebrow}</p>
      )}
      <h2 id={id} className="t-h2">
        {title}
      </h2>
      {text && <p className={cn("mt-4 text-lg", tone === "dark" ? "text-white/80" : "text-muted")}>{text}</p>}
    </Reveal>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-bronze-100 px-3 py-1 text-xs font-semibold text-bronze-700">{children}</span>;
}
