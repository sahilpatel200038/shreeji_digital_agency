import { requirePagePermission } from "@/lib/auth/session";
import { AdminForm, SelectField, TextInput } from "@/components/admin/admin-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { createUser } from "@/actions/users";

export default async function NewUser() {
  await requirePagePermission("users:manage");
  return (
    <>
      <PageHeader title="Add user" />
      <Card>
        <AdminForm action={createUser} submitLabel="Create user">
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Full name" name="name" required maxLength={120} />
            <TextInput label="Email" name="email" type="email" required maxLength={190} />
            <SelectField label="Role" name="role" defaultValue="EDITOR" options={[{ value: "EDITOR", label: "Editor: content and media" }, { value: "ADMIN", label: "Administrator: content, leads, menus, settings, redirects" }, { value: "SUPER_ADMIN", label: "Super Admin: everything, including users" }]} />
            <TextInput label="Temporary password" name="password" type="password" required hint="At least 12 characters with upper-case, lower-case and a number. Ask the user to change it after signing in." />
          </div>
        </AdminForm>
      </Card>
    </>
  );
}
