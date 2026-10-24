import { notFound } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { AdminForm, FileField, TextInput } from "@/components/admin/admin-form";
import { Card, Flash, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteMedia, replaceMedia, updateMedia } from "@/actions/media";
import { findMediaUsage } from "@/lib/media/usage";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MediaDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const user = await requirePagePermission("media:write");
  const { id } = await params;
  const m = Number(id) > 0 ? await db.media.findUnique({ where: { id: Number(id) } }) : null;
  if (!m) notFound();
  const usage = await findMediaUsage(m.id);

  return (
    <>
      <PageHeader title={m.title} description={`${m.fileName} · uploaded ${formatDate(m.createdAt)}`} />
      <Flash params={await searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card title="Preview">
          <div className="relative aspect-video overflow-hidden rounded-lg bg-forest-50">
            <Image src={`/media/${m.id}?v=${m.checksum.slice(0, 8)}`} alt={m.altText} fill sizes="600px" className="object-contain" unoptimized />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted">Dimensions</dt><dd>{m.width} × {m.height}px</dd>
            <dt className="text-muted">Type</dt><dd>{m.mimeType}</dd>
            <dt className="text-muted">Size</dt><dd>{Math.round(m.sizeBytes / 1024)} KB</dd>
            <dt className="text-muted">URL</dt><dd className="break-all"><code>/media/{m.id}</code></dd>
          </dl>
        </Card>
        <div className="space-y-6">
          <Card title="Details">
            <AdminForm action={updateMedia}>
              <input type="hidden" name="id" value={m.id} />
              <TextInput label="Title" name="title" defaultValue={m.title} required maxLength={255} />
              <TextInput label="Alt text" name="altText" defaultValue={m.altText} maxLength={500} hint="Describe the image for screen readers and search engines." />
              <TextInput label="Folder" name="folder" defaultValue={m.folder} maxLength={80} />
            </AdminForm>
          </Card>
          <Card title="Replace file">
            <AdminForm action={replaceMedia} submitLabel="Replace image" inline>
              <input type="hidden" name="id" value={m.id} />
              <FileField label="New image" name="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" required hint="Keeps the same ID, so every place that uses this image updates automatically." />
            </AdminForm>
          </Card>
          <Card title="Used by">
            {usage.length === 0 ? <p className="text-muted">Not used anywhere. Safe to delete.</p> : <ul className="list-disc space-y-1 pl-5 text-sm">{usage.map((u) => <li key={u}>{u}</li>)}</ul>}
            {can(user.role, "media:delete") && (
              <div className="mt-4">
                <ConfirmButton action={deleteMedia} fields={{ id: m.id }} title="Delete this file?" message={usage.length ? "This file is in use and cannot be deleted until it is removed from the items listed." : "The file will be permanently deleted."} label="Delete file" />
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
