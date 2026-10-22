import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { parseBlocks } from "@/lib/blocks/schema";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Draft preview inside the admin shell. Never public: requires an authenticated session. */
export default async function PreviewPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requirePagePermission("content:write");
  const { kind, id } = await params;
  const n = Number(id);
  if (!(n > 0)) notFound();

  let title = "";
  let status = "DRAFT";
  let body: React.ReactNode = null;
  let editHref = "";
  let liveHref = "";

  if (kind === "pages") {
    const p = await db.page.findUnique({ where: { id: n } });
    if (!p) notFound();
    title = p.title; status = p.status; editHref = `/admin/pages/${n}`; liveHref = `/${p.slug}`;
    body = <BlockRenderer blocks={parseBlocks(p.blocks)} />;
  } else if (kind === "posts") {
    const p = await db.post.findUnique({ where: { id: n }, include: { author: { select: { name: true } } } });
    if (!p) notFound();
    title = p.title; status = p.status; editHref = `/admin/posts/${n}`; liveHref = `/blog/${p.slug}`;
    body = (
      <>
        {p.excerpt && <p className="mb-6 text-lg text-muted">{p.excerpt}</p>}
        <BlockRenderer blocks={parseBlocks(p.blocks)} />
      </>
    );
  } else if (kind === "services") {
    const s = await db.service.findUnique({ where: { id: n } });
    if (!s) notFound();
    title = s.heroHeading || s.title; status = s.status; editHref = `/admin/services/${n}`; liveHref = `/services/${s.slug}`;
    const list = (v: unknown) => (v as Record<string, string>[] | null) ?? [];
    body = (
      <div className="space-y-8">
        <p className="text-lg text-muted">{s.summary}</p>
        {s.intro && <p>{s.intro}</p>}
        <section><h2 className="t-h3 mb-3">Benefits</h2><ul className="list-disc space-y-1 pl-6">{list(s.benefits).map((b) => <li key={b.title}><strong>{b.title}:</strong> {b.text}</li>)}</ul></section>
        <section><h2 className="t-h3 mb-3">Included</h2><ul className="list-disc space-y-1 pl-6">{((s.included as string[] | null) ?? []).map((i) => <li key={i}>{i}</li>)}</ul></section>
        <section><h2 className="t-h3 mb-3">Process</h2><ol className="list-decimal space-y-1 pl-6">{list(s.process).map((b) => <li key={b.title}><strong>{b.title}:</strong> {b.text}</li>)}</ol></section>
        <BlockRenderer blocks={parseBlocks(s.blocks ?? [])} />
      </div>
    );
  } else notFound();

  return (
    <div>
      <div role="status" className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center justify-between gap-3 bg-gold-200 px-4 py-3 md:-mx-8 md:px-8">
        <p className="font-semibold text-forest-950">
          Preview <StatusBadge status={status} /> <span className="ml-2 font-normal">This is how the content will read. Page chrome is simplified.</span>
        </p>
        <span className="flex gap-3 text-sm font-semibold">
          <Link href={editHref} className="underline">Back to editor</Link>
          {status === "PUBLISHED" && <Link href={liveHref} className="underline">View live</Link>}
        </span>
      </div>
      <article className="mx-auto max-w-3xl rounded-[var(--radius-card)] border border-line bg-white p-6 md:p-10">
        <h1 className="t-h1 mb-6">{title}</h1>
        {body}
      </article>
    </div>
  );
}
