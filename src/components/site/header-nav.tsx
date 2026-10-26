"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavChild = { label: string; href: string; openInNewTab: boolean };
type NavItem = NavChild & { children: NavChild[] };
type ServiceGroup = { name: string; services: { slug: string; title: string }[] };

/** Full-width row that expands/collapses its panel; a button, so it never navigates and works by touch and keyboard. */
function AccordionToggle({ id, label, expanded, onToggle, className }: { id: string; label: string; expanded: boolean; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      id={`${id}-btn`}
      aria-expanded={expanded}
      aria-controls={`${id}-panel`}
      onClick={onToggle}
      className={cn("flex w-full items-center justify-between gap-3 rounded-md text-left", className)}
    >
      <span>{label}</span>
      <Icon name="chevron-down" size={20} className={cn("shrink-0 transition-transform duration-300", expanded && "rotate-180")} />
    </button>
  );
}

/** Height-animated panel. Collapsed content is unmounted, so its links leave the tab order. */
function AccordionPanel({ id, expanded, children }: { id: string; expanded: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          key="panel"
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-btn`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav({
  items,
  groups,
  siteName,
  logo,
  brandName,
  brandTagline,
  cta,
}: {
  items: NavItem[];
  groups: ServiceGroup[];
  siteName: string;
  /** Admin-chosen logo (media URL); null = the bundled mark. */
  logo: string | null;
  brandName: string;
  brandTagline: string;
  /** Header button; null = hidden. */
  cta: { label: string; href: string; newTab: boolean } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Open accordion sections in the mobile menu (keys: a parent's href, or "<href>:<group name>" for nested groups).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // After a click in a desktop dropdown it stays hidden until the pointer leaves (hover/focus would keep it open).
  const [dropdownsHidden, setDropdownsHidden] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on navigation and start the new page at the top (unless the URL targets a #section).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    setExpanded(new Set());
    if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  /** Any menu link click: close the menu/dropdown now, and jump to the top if it points at the current page. */
  function onNavigate(href: string) {
    setOpen(false);
    setDropdownsHidden(true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!href.includes("#") && href.split("?")[0] === pathname) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }

  // Esc to close, lock body scroll, trap focus while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
        const all = [toggleRef.current, ...Array.from(f)].filter(Boolean) as HTMLElement[];
        const first = all[0];
        const last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-all duration-300",
        scrolled ? "border-line shadow-sm" : "border-transparent",
      )}
    >
      {/* The blur lives on its own layer: backdrop-filter on <header> would make it the containing block of the
          fixed mobile panel below and collapse that panel to the header's height. */}
      <div
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-0 -z-10 transition-all duration-300", scrolled ? "bg-paper/90 backdrop-blur-md" : "bg-paper/80 backdrop-blur-sm")}
      />
      <div className="container">
      <div className="row flex h-[72px] items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3" aria-label={`${siteName} home`}>
          <Image src={logo ?? "/brand/logo-mark.png"} alt="" width={44} height={40} priority className="h-10 w-auto" />
          {(brandName || brandTagline) && (
            <span className="leading-none">
              {brandName && <span className="block font-display text-lg font-extrabold tracking-tight text-forest-900">{brandName}</span>}
              {brandTagline && <span className="block font-display text-[11px] font-bold tracking-[0.28em] text-bronze-700">{brandTagline}</span>}
            </span>
          )}
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              const hasMenu = item.href === "/services" && groups.length > 0;
              const hasChildren = !hasMenu && item.children.length > 0;
              return (
                <li key={item.href} className="group relative" onMouseLeave={() => setDropdownsHidden(false)}>
                  <Link
                    href={item.href}
                    onClick={() => onNavigate(item.href)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative inline-flex min-h-11 items-center gap-1 rounded-lg px-3.5 text-[15px] font-semibold text-forest-900 transition hover:text-bronze-700",
                      active && "text-bronze-700",
                    )}
                  >
                    {item.label}
                    {(hasMenu || hasChildren) && <Icon name="chevron-down" size={16} className="transition-transform group-hover:rotate-180 group-focus-within:rotate-180" />}
                    <span
                      className={cn(
                        "absolute inset-x-3.5 bottom-1.5 h-0.5 origin-left scale-x-0 rounded bg-bronze-500 transition-transform duration-300 group-hover:scale-x-100",
                        active && "scale-x-100",
                      )}
                    />
                  </Link>
                  {hasChildren && (
                    <div className={cn("invisible absolute top-full left-0 z-50 min-w-56 pt-2 opacity-0 transition duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100", dropdownsHidden && "!invisible !opacity-0 pointer-events-none")}>
                      <ul className="rounded-[var(--radius-card)] border border-line bg-white p-2 shadow-[var(--shadow-lift)]">
                        {item.children.map((c) => (
                          <li key={c.href}>
                            <Link href={c.href} onClick={() => onNavigate(c.href)} className="block rounded-md px-3 py-2 text-[15px] font-medium text-forest-900 hover:bg-forest-50 hover:text-bronze-700">
                              {c.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {hasMenu && (
                    <div className={cn("invisible absolute top-full left-1/2 z-50 w-[560px] -translate-x-1/2 pt-2 opacity-0 transition duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100", dropdownsHidden && "!invisible !opacity-0 pointer-events-none")}>
                      <div className="grid grid-cols-2 gap-6 rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-[var(--shadow-lift)]">
                        {groups.map((g) => (
                          <div key={g.name}>
                            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-bronze-700 uppercase">{g.name}</p>
                            <ul className="space-y-0.5">
                              {g.services.map((s) => (
                                <li key={s.slug}>
                                  <Link
                                    href={`/services/${s.slug}`}
                                    onClick={() => onNavigate(`/services/${s.slug}`)}
                                    className="block rounded-md px-2 py-1.5 text-[15px] font-medium text-forest-900 hover:bg-forest-50 hover:text-bronze-700"
                                  >
                                    {s.title}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                        {item.children.length > 0 && (
                          <div className="col-span-2 border-t border-line pt-4">
                            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-bronze-700 uppercase">More</p>
                            <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5">
                              {item.children.map((c) => (
                                <li key={`${c.href}-${c.label}`}>
                                  <Link href={c.href} onClick={() => onNavigate(c.href)} className="block rounded-md px-2 py-1.5 text-[15px] font-medium text-forest-900 hover:bg-forest-50 hover:text-bronze-700">
                                    {c.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          {cta && (
            <div className="hidden sm:block">
              <ButtonLink href={cta.href} variant="primary" size="sm" external={cta.newTab}>
                {cta.label}
              </ButtonLink>
            </div>
          )}
          <button
            ref={toggleRef}
            type="button"
            className="grid size-11 place-items-center rounded-lg text-forest-900 hover:bg-forest-900/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => {
              if (open) setExpanded(new Set());
              setOpen(!open);
            }}
          >
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            ref={panelRef}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto bg-paper px-4 pt-4 pb-10 lg:hidden"
          >
            <nav aria-label="Mobile">
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const isServices = item.href === "/services" && groups.length > 0;
                  const hasSub = isServices || item.children.length > 0;
                  const link = (href: string, label: string, className: string) => (
                    <Link href={href} onClick={() => onNavigate(href)} className={className}>
                      {label}
                    </Link>
                  );
                  const subLink = "block rounded-md py-2 text-base text-muted hover:text-bronze-700";
                  return (
                    <li key={item.href}>
                      {hasSub ? (
                        <>
                          <AccordionToggle
                            id={`m-${item.href}`}
                            label={item.label}
                            expanded={expanded.has(item.href)}
                            onToggle={() => toggle(item.href)}
                            className={cn("min-h-12 py-3 text-lg font-semibold", active ? "text-bronze-700" : "text-forest-900")}
                          />
                          <AccordionPanel id={`m-${item.href}`} expanded={expanded.has(item.href)}>
                            <ul className="mb-3 ml-3 space-y-0.5 border-l-2 border-bronze-300 pl-4">
                              <li>{link(item.href, `All ${item.label}`, cn(subLink, "font-semibold text-forest-900"))}</li>
                              {isServices
                                ? groups.map((g) => {
                                    const key = `${item.href}:${g.name}`;
                                    return (
                                      <li key={g.name}>
                                        <AccordionToggle
                                          id={`m-${key}`}
                                          label={g.name}
                                          expanded={expanded.has(key)}
                                          onToggle={() => toggle(key)}
                                          className="min-h-11 py-2 text-base font-semibold text-forest-900"
                                        />
                                        <AccordionPanel id={`m-${key}`} expanded={expanded.has(key)}>
                                          <ul className="mb-2 ml-3 space-y-0.5 border-l-2 border-line pl-4">
                                            {g.services.map((s) => (
                                              <li key={s.slug}>{link(`/services/${s.slug}`, s.title, subLink)}</li>
                                            ))}
                                          </ul>
                                        </AccordionPanel>
                                      </li>
                                    );
                                  })
                                : null}
                              {item.children.map((c) => (
                                <li key={`${c.href}-${c.label}`}>{link(c.href, c.label, subLink)}</li>
                              ))}
                            </ul>
                          </AccordionPanel>
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => onNavigate(item.href)}
                          aria-current={active ? "page" : undefined}
                          className={cn("flex min-h-12 items-center py-3 text-lg font-semibold", active ? "text-bronze-700" : "text-forest-900")}
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              {cta && (
                <ButtonLink href={cta.href} variant="accent" size="lg" className="mt-6 w-full" arrow external={cta.newTab} onClick={() => onNavigate(cta.href)}>
                  {cta.label}
                </ButtonLink>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
