import { requireUser } from "@/lib/auth/session";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell";
import { logout } from "@/actions/auth";

const NAV: (AdminNavItem & { perm?: Permission })[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/pages", label: "Pages", icon: "file" },
  // { href: "/admin/home-page", label: "Home page", icon: "dashboard", perm: "settings:write" },
  // { href: "/admin/contact-page", label: "Contact page", icon: "phone", perm: "settings:write" },
  { href: "/admin/site-pages", label: "Site pages", icon: "layout" },
  { href: "/admin/posts", label: "Blog posts", icon: "edit" },
  { href: "/admin/services", label: "Services", icon: "target" },
  { href: "/admin/projects", label: "Projects", icon: "layout" },
  { href: "/admin/team", label: "Team", icon: "users" },
  { href: "/admin/testimonials", label: "Testimonials", icon: "star" },
  { href: "/admin/faqs", label: "FAQs", icon: "list" },
  { href: "/admin/media", label: "Media library", icon: "image" },
  { href: "/admin/header", label: "Header Management", icon: "layout", perm: "menus:write" },
  { href: "/admin/footer", label: "Footer Management", icon: "layout", perm: "menus:write" },
  { href: "/admin/menus", label: "Menus", icon: "menu", perm: "menus:write" },
  { href: "/admin/leads", label: "Leads", icon: "inbox", perm: "leads:read" },
  { href: "/admin/seo", label: "SEO & redirects", icon: "search" },
  { href: "/admin/settings", label: "Settings", icon: "settings", perm: "settings:write" },
  { href: "/admin/users", label: "Users", icon: "users", perm: "users:manage" },
  { href: "/admin/activity-logs", label: "Activity Logs", icon: "shield", perm: "audit:read" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = NAV.filter((n) => !n.perm || can(user.role, n.perm)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <AdminShell nav={nav} user={{ name: user.name, role: ROLE_LABELS[user.role] }} logout={logout}>
      {children}
    </AdminShell>
  );
}
