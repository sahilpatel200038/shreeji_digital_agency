import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Empty, FilterBar, Flash, PageHeader, Pager } from "@/components/admin/ui";
import { UploadZone } from "@/components/admin/upload-zone";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 24;

export default async function MediaLibrary({ searchParams }: { searchParams: Promise<{ q?: string; folder?: string; page?: string; msg?: string; err?: string }> }) {
  await requirePagePermission("media:write");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim().slice(0, 80);
  const folder = sp.folder?.replace(/[^a-z0-9-_]/gi, "").slice(0, 80) || undefined;
  const where = { mimeType: { startsWith: "image/" }, ...(folder ? { folder } : {}), ...(q ? { OR: [{ title: { contains: q } }, { fileName: { contains: q } }, { altText: { contains: q } }] } : {}) };
  const [items, total, folders] = await Promise.all([
    db.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.media.count({ where }),
    db.media.groupBy({ by: ["folder"], _count: { _all: true }, orderBy: { folder: "asc" } }),
  ]);
  const base = new URLSearchParams({ ...(q ? { q } : {}), ...(folder ? { folder } : {}) });

  return (
    <>
      <PageHeader title="Media library" description="Images used across pages, posts, services and SEO. Files are stored in the database, so they persist on any host." />
      <Flash params={sp} />
      <UploadZone folder={folder ?? "general"} />
      <div className="mt-8" />
      <FilterBar q={q} placeholder="Search by title, file name or alt text" filters={[{ name: "folder", label: "All folders", value: folder, options: folders.map((f) => ({ value: f.folder, label: `${f.folder} (${f._count._all})` })) }]} />
      {items.length === 0 ? (
        <Empty>No media found. Upload an image above.</Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {items.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/media/${m.id}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-white transition hover:border-bronze-300 hover:shadow-[var(--shadow-soft)]">
                <span className="relative block aspect-square bg-forest-50">
                  <Image src={`/media/${m.id}?v=${m.checksum.slice(0, 8)}`} alt={m.altText} fill sizes="200px" className="object-contain p-2" unoptimized />
                </span>
                <span className="block p-3">
                  <span className="block truncate text-sm font-semibold">{m.title}</span>
                  <span className="block text-xs text-muted">{m.width}×{m.height} · {Math.round(m.sizeBytes / 1024)} KB</span>
                  {!m.altText && <span className="mt-1 block text-xs font-semibold text-bronze-700">Missing alt text</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} base={base} />
    </>
  );
}
