"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { UnsavedChangesProvider, useUnsavedGuard } from "@/components/admin/unsaved-changes";

export type AdminNavItem = { href: string; label: string; icon: string };

export function AdminShell(props: {
  nav: AdminNavItem[];
  user: { name: string; role: string };
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <UnsavedChangesProvider>
      <ShellInner {...props} />
    </UnsavedChangesProvider>
  );
}

function ShellInner({
  nav,
  user,
  logout,
  children,
}: {
  nav: AdminNavItem[];
  user: { name: string; role: string };
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const guard = useUnsavedGuard();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  const sidebar = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <Image src="/brand/logo-mark.png" alt="" width={40} height={36} className="h-9 w-10 object-contain" />
        <span className="leading-tight">
          <span className="block font-display font-extrabold text-white">Shreeji CMS</span>
          <span className="block text-xs text-bronze-300">Admin panel</span>
        </span>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {nav.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={active(n.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition",
                active(n.href) ? "bg-white/10 text-gold-300 shadow-[inset_3px_0_0_var(--color-gold-300)]" : "text-white/80 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon name={n.icon} size={20} />
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold text-white">{user.name}</p>
        <p className="mb-3 text-xs text-bronze-300">{user.role}</p>
        <div className="flex gap-2">
          <Link href="/" target="_blank" className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/20 text-sm text-white hover:bg-white/10">
            <Icon name="eye" size={16} /> View site
          </Link>
          {/* Signing out leaves the page, so it asks first when there are unsaved changes. */}
          <button
            type="button"
            onClick={() => (guard ? guard.confirmLeave(() => startTransition(() => void logout())) : startTransition(() => void logout()))}
            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm text-white hover:bg-white/10"
            aria-label="Sign out"
          >
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh bg-forest-950 lg:block">{sidebar}</aside>

      <div className="flex items-center justify-between bg-forest-950 px-4 py-3 lg:hidden">
        <span className="font-display font-extrabold text-white">Shreeji CMS</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-drawer"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="grid size-11 place-items-center rounded-lg text-white hover:bg-white/10"
        >
          <Icon name={open ? "x" : "menu"} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-forest-950/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div id="admin-drawer" className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-forest-950">
            {sidebar}
          </div>
        </div>
      )}

      <main id="admin-main" className="min-w-0 bg-paper px-4 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
