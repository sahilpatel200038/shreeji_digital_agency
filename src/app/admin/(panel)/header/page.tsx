import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/get";
import { AdminForm, CheckboxField, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { MenuItemsField } from "@/components/admin/menu-editor";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { saveHeader } from "@/actions/site-chrome";
import { lockKey } from "@/lib/lock-keys";

export const dynamic = "force-dynamic";

export default async function HeaderManagement() {
  await requirePagePermission("menus:write");
  const { header } = await getSettings();
  const menu = await db.menu.findUnique({ where: { key: "header" }, include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  return (
    <>
      <PageHeader
        title="Header Management"
        description="The logo, navigation links and button at the top of every page. In the navigation, an item linking to /services automatically shows a dropdown of all published services."
        actions={<LinkButton href="/" variant="outline">View live</LinkButton>}
      />
      <AdminForm action={saveHeader} submitLabel="Save header" lock={[lockKey.chrome("header"), lockKey.setting("header"), lockKey.menu("header")]}>
        <div className="space-y-6">
          <Card title="Logo">
            <div className="grid gap-5 md:grid-cols-2">
              <MediaPicker name="logoMediaId" label="Logo image" defaultId={header.logoMediaId} hint="Shown at about 40 px tall. Empty = the built-in Shreeji mark." />
              <div className="space-y-4">
                <TextInput label="Brand name (first line)" name="brandName" defaultValue={header.brandName} maxLength={30} hint="Empty hides both lines and shows the logo alone." />
                <TextInput label="Brand tagline (second line)" name="brandTagline" defaultValue={header.brandTagline} maxLength={30} />
              </div>
            </div>
          </Card>
          <Card title="Navigation menu">
            <p className="mb-4 text-sm text-muted">Links in the order they appear. To add a sub-service (or any sub-link) under a menu item, click Add item, fill in the label and link, then set Parent to that item, for example Services. Use the arrows to reorder and the bin to delete; remember to Save header. Use /path, #section, https://, mailto: or tel: links.</p>
            <MenuItemsField
              name="menuItems"
              initial={(menu?.items ?? []).map((i) => ({ key: `i${i.id}`, parentKey: i.parentId ? `i${i.parentId}` : null, label: i.label, href: i.href, openInNewTab: i.openInNewTab, isActive: i.isActive }))}
            />
          </Card>
          <Card title="Call-to-action button">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <CheckboxField label="Show the button" name="showCta" defaultChecked={header.showCta} />
              </div>
              <TextInput label="Button text" name="ctaLabel" defaultValue={header.ctaLabel} maxLength={40} />
              <TextInput label="Button link" name="ctaHref" defaultValue={header.ctaHref} maxLength={300} hint="/contact, #section or https://…" />
              <div className="md:col-span-2">
                <CheckboxField label="Open the link in a new tab" name="ctaNewTab" defaultChecked={header.ctaNewTab} />
              </div>
            </div>
          </Card>
        </div>
      </AdminForm>
    </>
  );
}
