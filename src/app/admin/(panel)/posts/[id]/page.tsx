import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/session";
import { Flash, LinkButton, PageHeader } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/post-editor";

export const dynamic = "force-dynamic";

export default async function EditPost({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePagePermission("content:write");
  const { id } = await params;
  const post = Number(id) > 0 ? await db.post.findUnique({ where: { id: Number(id) }, include: { seo: true, tags: { include: { tag: true } }, author: { select: { name: true } } } }) : null;
  if (!post) notFound();
  return (
    <>
      <PageHeader
        title={`Edit: ${post.title}`}
        actions={
          <>
            <LinkButton href={`/admin/preview/posts/${post.id}`} variant="outline">Preview</LinkButton>
            {post.status === "PUBLISHED" && <LinkButton href={`/blog/${post.slug}`} variant="outline">View live</LinkButton>}
          </>
        }
      />
      <Flash params={await searchParams} />
      <PostEditor post={post} />
    </>
  );
}
