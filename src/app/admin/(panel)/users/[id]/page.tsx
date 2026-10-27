import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { AdminForm, CheckboxField, SelectField, TextInput } from "@/components/admin/admin-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { resetUserPassword, updateUser } from "@/actions/users";
import { lockKey } from "@/lib/lock-keys";

export const dynamic = "force-dynamic";

export default async function EditUser({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePagePermission("users:manage");
  const { id } = await params;
  const u = Number(id) > 0 ? await db.user.findUnique({ where: { id: Number(id) } }) : null;
  if (!u) notFound();
  return (
    <>
      <PageHeader backHref="/admin/users" title={u.name} description={u.email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile & access">
          <AdminForm action={updateUser} lock={[lockKey.user(u.id)]} cancelHref="/admin/users">
            <input type="hidden" name="id" value={u.id} />
            <TextInput label="Full name" name="name" defaultValue={u.name} required maxLength={120} />
            <SelectField label="Role" name="role" defaultValue={u.role} options={[{ value: "EDITOR", label: "Editor" }, { value: "ADMIN", label: "Administrator" }, { value: "SUPER_ADMIN", label: "Super Admin" }]} />
            <CheckboxField label="Account active" name="isActive" defaultChecked={u.isActive} hint={u.id === actor.id ? "You cannot deactivate your own account." : "Deactivating signs the user out immediately."} />
          </AdminForm>
        </Card>
        <Card title="Reset password">
          <AdminForm action={resetUserPassword} submitLabel="Set new password" inline>
            <input type="hidden" name="id" value={u.id} />
            <TextInput label="New password" name="password" type="password" required hint="At least 12 characters with upper-case, lower-case and a number. The user is signed out everywhere." />
          </AdminForm>
        </Card>
      </div>
    </>
  );
}
