import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Empty, FilterBar, Flash, LinkButton, PageHeader, Pager, StatusBadge, TableWrap, td, th } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deletePost, setPostStatus } from "@/actions/posts";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function PostsList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string; msg?: string; err?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = sp.status === "DRAFT" || sp.status === "PUBLISHED" ? (sp.status as "DRAFT" | "PUBLISHED") : undefined;
  const category = Number(sp.category) || undefined;
  const q = sp.q?.trim().slice(0, 80);
  const where = {
    ...(status ? { status } : {}),
    ...(category ? { categoryId: category } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }, { excerpt: { contains: q } }] } : {}),
  };
  const [items, total, categories] = await Promise.all([
    db.post.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { category: true, author: { select: { name: true } } } }),
    db.post.count({ where }),
    db.postCategory.findMany({ orderBy: { name: "asc" } }),
  ]);
  const base = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(category ? { category: String(category) } : {}) });
  const canDelete = can(user.role, "content:delete");

  return (
    <>
      <PageHeader title="Blog posts" description="Articles, categories and tags." actions={<LinkButton href="/admin/posts/new">Add post</LinkButton>} />
      <Flash params={sp} />
      <FilterBar
        q={q}
        placeholder="Search posts"
        filters={[
          { name: "status", label: "All statuses", value: status, options: [{ value: "PUBLISHED", label: "Published" }, { value: "DRAFT", label: "Draft" }] },
          { name: "category", label: "All categories", value: category ? String(category) : "", options: categories.map((c) => ({ value: String(c.id), label: c.name })) },
        ]}
      />
      <TableWrap>
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className={th}>Title</th>
              <th className={th}>Category</th>
              <th className={th}>Author</th>
              <th className={th}>Status</th>
              <th className={th}>Date</th>
              <th className={th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((p) => (
              <tr key={p.id}>
                <td className={td}><Link href={`/admin/posts/${p.id}`} className="font-semibold text-forest-900 hover:text-bronze-700">{p.title}</Link></td>
                <td className={`${td} text-muted`}>{p.category?.name ?? "—"}</td>
                <td className={`${td} text-muted`}>{p.author.name}</td>
                <td className={td}><StatusBadge status={p.status} /></td>
                <td className={`${td} text-muted`}>{formatDate(p.publishedAt ?? p.updatedAt)}</td>
                <td className={`${td} text-right`}>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Link href={`/admin/posts/${p.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Edit</Link>
                    <Link href={`/admin/preview/posts/${p.id}`} className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">Preview</Link>
                    <form action={setPostStatus}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={p.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                      <button className="min-h-9 rounded-lg px-2.5 text-sm font-semibold hover:bg-forest-50">{p.status === "PUBLISHED" ? "Unpublish" : "Publish"}</button>
                    </form>
                    {canDelete && <ConfirmButton small action={deletePost} fields={{ id: p.id }} title="Delete this post?" message={`“${p.title}” will be permanently deleted.`} label="Delete" />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <Empty>No posts found.</Empty>}
      </TableWrap>
      <Pager page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} base={base} />
    </>
  );
}
