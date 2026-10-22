import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";

type Variant = "primary" | "accent" | "outline" | "ghost" | "light" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] font-semibold whitespace-nowrap transition duration-200 ease-[var(--ease-brand)] select-none disabled:pointer-events-none disabled:opacity-60 aria-busy:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-forest-900 text-white hover:-translate-y-0.5 hover:bg-forest-800 hover:shadow-[var(--shadow-lift)]",
  accent: "bg-gradient-to-r from-gold-300 to-bronze-500 text-forest-950 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
  outline: "border-2 border-forest-900 text-forest-900 hover:bg-forest-900 hover:text-white",
  ghost: "text-forest-900 hover:bg-forest-900/5",
  light: "border-2 border-white/40 text-white hover:bg-white hover:text-forest-900",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-12 px-6 text-base",
  lg: "min-h-14 px-8 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: Variant; size?: Size; className?: string; children: ReactNode; arrow?: boolean };

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  arrow,
  external,
  onClick,
}: CommonProps & { href: string; external?: boolean; onClick?: () => void }) {
  const content = (
    <>
      {children}
      {arrow && <Icon name="arrow-right" size={18} className="transition-transform group-hover/btn:translate-x-1" />}
    </>
  );
  if (external || /^(https?:|mailto:|tel:)/.test(href)) {
    return (
      <a
        href={href}
        className={buttonClasses(variant, size, className)}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={buttonClasses(variant, size, className)}>
      {content}
    </Link>
  );
}

export function Button({
  variant,
  size,
  className,
  children,
  arrow,
  loading,
  ...rest
}: CommonProps & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={buttonClasses(variant, size, className)}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
      {arrow && !loading && <Icon name="arrow-right" size={18} />}
    </button>
  );
}
