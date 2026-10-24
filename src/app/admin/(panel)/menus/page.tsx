import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { MenuEditor } from "@/components/admin/menu-editor";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  header: "Header navigation",
  "footer-company": "Footer: Company links",
  "footer-legal": "Footer: Legal links",
};

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  await requirePagePermission("menus:write");
  const { menu: key } = await searchParams;
  const menus = await db.menu.findMany({ orderBy: { id: "asc" } });
  const current = menus.find((m) => m.key === key) ?? menus[0];
  const items = current ? await db.menuItem.findMany({ where: { menuId: current.id }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }) : [];

  return (
    <>
      <PageHeader title="Menus" description="Link lists. The header and footer links are edited in Header Management and Footer Management." />
      <nav aria-label="Menus" className="mb-6 flex flex-wrap gap-2">
        {menus.map((m) => (
          <Link key={m.id} href={`/admin/menus?menu=${m.key}`} aria-current={m.id === current?.id ? "true" : undefined} className={cn("inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold", m.id === current?.id ? "border-forest-900 bg-forest-900 text-white" : "border-line bg-white hover:border-bronze-300")}>
            {LABELS[m.key] ?? m.name}
          </Link>
        ))}
      </nav>
      {current && (current.key === "header" || current.key.startsWith("footer-")) ? (
        <Card title={LABELS[current.key] ?? current.name}>
          <p className="text-muted">
            This list is edited together with the rest of the {current.key === "header" ? "header" : "footer"}, so there is only one place to change it.
          </p>
          <div className="mt-4">
            <LinkButton href={current.key === "header" ? "/admin/header" : "/admin/footer"}>Open {current.key === "header" ? "Header" : "Footer"} Management</LinkButton>
          </div>
        </Card>
      ) : current ? (
        <Card title={LABELS[current.key] ?? current.name}>
          <MenuEditor
            key={current.id}
            menuId={current.id}
            menuKey={current.key}
            initial={items.map((i) => ({ key: `i${i.id}`, parentKey: i.parentId ? `i${i.parentId}` : null, label: i.label, href: i.href, openInNewTab: i.openInNewTab, isActive: i.isActive }))}
          />
        </Card>
      ) : (
        <p className="text-muted">No menus exist. Run the seed script to create them.</p>
      )}
    </>
  );
}
