import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { safeAdminNext } from "@/lib/safe-url";
import { login } from "@/actions/auth";
import { AdminForm, TextInput } from "@/components/admin/admin-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSession()) redirect(safeAdminNext(next));

  return (
    <main className="bg-brand-glow grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-panel)] bg-white p-8 shadow-[var(--shadow-lift)]">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/brand/logo-mark.png" alt="" width={48} height={44} className="h-11 w-auto" priority />
          <div>
            <h1 className="text-2xl font-extrabold">Admin sign in</h1>
            <p className="text-sm text-muted">Shreeji Marketing CMS</p>
          </div>
        </div>
        <AdminForm action={login} submitLabel="Sign in" inline>
          <input type="hidden" name="next" value={safeAdminNext(next)} />
          <TextInput label="Email" name="email" type="email" required />
          <TextInput label="Password" name="password" type="password" required />
        </AdminForm>
      </div>
    </main>
  );
}
