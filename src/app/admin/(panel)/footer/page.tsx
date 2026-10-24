import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/get";
import { AdminForm, CheckboxField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { MenuItemsField } from "@/components/admin/menu-editor";
import { Card, LinkButton, PageHeader } from "@/components/admin/ui";
import { saveFooter } from "@/actions/site-chrome";
import { lockKey } from "@/lib/lock-keys";

export const dynamic = "force-dynamic";

const toItems = (items: { id: number; parentId: number | null; label: string; href: string; openInNewTab: boolean; isActive: boolean }[]) =>
  items.map((i) => ({ key: `i${i.id}`, parentKey: i.parentId ? `i${i.parentId}` : null, label: i.label, href: i.href, openInNewTab: i.openInNewTab, isActive: i.isActive }));

export default async function FooterManagement() {
  await requirePagePermission("menus:write");
  const { footer, general, contact, social } = await getSettings();
  const menus = await db.menu.findMany({ where: { key: { in: ["footer-company", "footer-legal"] } }, include: { items: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } } });
  const company = menus.find((m) => m.key === "footer-company");
  const legal = menus.find((m) => m.key === "footer-legal");
  return (
    <>
      <PageHeader
        title="Footer Management"
        description="Everything in the footer at the bottom of every page. The phone, email and address are the same details used on the Contact page, so changing them here updates both."
        actions={<LinkButton href="/" variant="outline">View live</LinkButton>}
      />
      <AdminForm
        action={saveFooter}
        submitLabel="Save footer"
        lock={[lockKey.chrome("footer"), lockKey.setting("footer"), lockKey.setting("general"), lockKey.setting("contact"), lockKey.setting("social"), lockKey.menu("footer-company"), lockKey.menu("footer-legal")]}
      >
        <div className="space-y-6">
          <Card title="Logo and description">
            <div className="grid gap-5 md:grid-cols-2">
              <MediaPicker name="logoMediaId" label="Footer logo" defaultId={footer.logoMediaId} hint="Shown at about 44 px tall on the dark footer. Empty = the built-in Shreeji mark." />
              <div className="space-y-4">
                <TextInput label="Brand name (first line)" name="brandName" defaultValue={footer.brandName} maxLength={30} hint="Empty hides both lines and shows the logo alone." />
                <TextInput label="Brand tagline (second line)" name="brandTagline" defaultValue={footer.brandTagline} maxLength={30} />
              </div>
              <TextArea label="Footer description" name="footerBlurb" defaultValue={general.footerBlurb} rows={3} maxLength={300} className="md:col-span-2" />
              <TextInput label="Tagline (under the description)" name="tagline" defaultValue={general.tagline} maxLength={120} />
              <TextInput label="Copyright text" name="copyright" defaultValue={general.copyright} maxLength={160} hint="The year is added automatically." />
              <TextInput label="Line at the bottom right" name="bottomLine" defaultValue={footer.bottomLine} maxLength={120} hint="Empty hides it." className="md:col-span-2" />
            </div>
          </Card>
          <Card title="Services column">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <CheckboxField label="Show the services column" name="showServices" defaultChecked={footer.showServices} hint="Lists the services marked Main service in Services, in their display order." />
              </div>
              <TextInput label="Column heading" name="servicesHeading" defaultValue={footer.servicesHeading} maxLength={40} />
              <TextInput label="Most services to list" name="servicesLimit" type="number" min={1} max={30} defaultValue={footer.servicesLimit} />
            </div>
          </Card>
          <Card title="Company and legal links">
            <div className="space-y-6">
              <TextInput label="Column heading" name="companyHeading" defaultValue={footer.companyHeading} maxLength={40} hint="Company and legal links are listed together under this heading." />
              <div>
                <h3 className="mb-2 text-sm font-bold text-forest-900">Company links</h3>
                <MenuItemsField name="companyItems" initial={toItems(company?.items ?? [])} />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-bold text-forest-900">Legal links</h3>
                <MenuItemsField name="legalItems" initial={toItems(legal?.items ?? [])} />
              </div>
            </div>
          </Card>
          <Card title="Contact information">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <CheckboxField label="Show the contact column" name="showContact" defaultChecked={footer.showContact} />
              </div>
              <TextInput label="Column heading" name="contactHeading" defaultValue={footer.contactHeading} maxLength={40} className="md:col-span-2" />
              <TextInput label="Phone" name="phone" defaultValue={contact.phone} maxLength={40} />
              <TextInput label="Email" name="email" type="email" defaultValue={contact.email} maxLength={190} />
              <TextArea label="Address" name="address" defaultValue={contact.address} rows={2} maxLength={300} className="md:col-span-2" />
            </div>
          </Card>
          <Card title="Social media">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <CheckboxField label="Show the social icons" name="showSocial" defaultChecked={footer.showSocial} hint="An icon appears only for a link you fill in below." />
              </div>
              <TextInput label="Instagram" name="instagram" defaultValue={social.instagram} maxLength={500} placeholder="https://…" />
              <TextInput label="Facebook" name="facebook" defaultValue={social.facebook} maxLength={500} placeholder="https://…" />
              <TextInput label="LinkedIn" name="linkedin" defaultValue={social.linkedin} maxLength={500} placeholder="https://…" />
              <TextInput label="YouTube" name="youtube" defaultValue={social.youtube} maxLength={500} placeholder="https://…" />
              <TextInput label="X (Twitter)" name="x" defaultValue={social.x} maxLength={500} placeholder="https://…" />
            </div>
          </Card>
        </div>
      </AdminForm>
    </>
  );
}
