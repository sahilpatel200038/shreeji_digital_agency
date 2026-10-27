import { AdminForm, SelectField, TextArea, TextInput } from "@/components/admin/admin-form";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { MediaPicker } from "@/components/admin/media-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import { Card } from "@/components/admin/ui";
import { createPostCategory, savePost } from "@/actions/posts";
import { toDatetimeLocal } from "@/lib/content-helpers";
import { parseBlocks } from "@/lib/blocks/schema";
import { blocksToHtml, sanitizeRichText } from "@/lib/rich-text";
import { scoreSeo } from "@/lib/seo/score";
import { siteUrl } from "@/lib/env";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { lockKey } from "@/lib/lock-keys";

type PostFull = Prisma.PostGetPayload<{ include: { seo: true; tags: { include: { tag: true } }; author: { select: { name: true } } } }>;

export async function PostEditor({ post }: { post: PostFull | null }) {
  const categories = await db.postCategory.findMany({ orderBy: { name: "asc" } });
  const blocks = parseBlocks(post?.blocks ?? []);
  const seo = post?.seo ?? null;
  const result = post
    ? scoreSeo({
        title: seo?.title,
        description: seo?.description,
        slug: post.slug,
        focusKeyword: seo?.focusKeyword,
        canonicalUrl: seo?.canonicalUrl,
        robotsIndex: seo?.robotsIndex,
        blocks,
        fallbackTitle: post.title,
        extraText: post.excerpt ?? "",
        imagesMissingAlt: blocks.filter((b) => b.type === "image" && !b.alt.trim()).length,
        published: post.status === "PUBLISHED",
      })
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <AdminForm action={savePost} submitLabel={post ? "Save post" : "Create post"} className="space-y-6 xl:col-span-2" lock={post ? [lockKey.post(post.id)] : undefined} cancelHref="/admin/posts">
        {post && <input type="hidden" name="id" value={post.id} />}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Card title="Content">
              <div className="space-y-4">
                <TextInput label="Title" name="title" defaultValue={post?.title} required maxLength={150} />
                <TextInput label="URL slug" name="slug" defaultValue={post?.slug} hint="Leave empty to generate from the title. Changing it on a published post creates a 301 redirect." />
                <TextArea label="Excerpt" name="excerpt" defaultValue={post?.excerpt} rows={3} maxLength={500} hint="Shown on the blog index and used as the fallback meta description." />
                <div>
                  <p className="mb-2 text-sm font-semibold text-forest-900">Post content</p>
                  <RichTextEditor html={sanitizeRichText(blocksToHtml(blocks))} />
                </div>
              </div>
            </Card>
            <Card title="SEO">
              <SeoPanel seo={seo ? { ...seo, secondaryKeywords: (seo.secondaryKeywords as string[] | null) ?? [] } : null} checks={result?.checks} score={result?.score} previewUrl={`${siteUrl.replace(/^https?:\/\//, "")}/blog/`} slugValue={post?.slug} />
            </Card>
          </div>
          <div className="min-w-0 space-y-6">
            <Card title="Publishing">
              <div className="space-y-4">
                <SelectField label="Status" name="status" defaultValue={post?.status ?? "DRAFT"} options={[{ value: "DRAFT", label: "Draft (not public)" }, { value: "PUBLISHED", label: "Published" }]} />
                <TextInput label="Publish date (IST)" name="publishedAt" type="datetime-local" defaultValue={toDatetimeLocal(post?.publishedAt)} hint="Empty = publish immediately. A future date schedules the post." />
                {post && <p className="text-sm text-muted">Author: <strong>{post.author.name}</strong></p>}
              </div>
            </Card>
            <Card title="Organise">
              <div className="space-y-4">
                <SelectField label="Category" name="categoryId" defaultValue={post?.categoryId ?? ""} options={[{ value: "", label: "Uncategorised" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                <TextInput label="Tags" name="tags" defaultValue={post?.tags.map((t) => t.tag.name).join(", ")} hint="Comma-separated, up to 10." />
              </div>
            </Card>
            <Card title="Banner image">
              <MediaPicker name="featuredMediaId" label="Banner image" defaultId={post?.featuredMediaId} hint="Shown on the right of this article banner and used for social sharing. Landscape, at least 1200×800. Empty = the blog banner image." />
            </Card>
            <Card title="Listing thumbnail">
              <MediaPicker name="thumbnailMediaId" label="Thumbnail" defaultId={post?.thumbnailMediaId} hint="Shown only on blog cards and the blog list, independent of the banner. Empty = the banner image is used." />
            </Card>
          </div>
        </div>
      </AdminForm>
      <div className="xl:col-span-2">
        <Card title="Add a category">
          <AdminForm action={createPostCategory} submitLabel="Add category" className="flex flex-wrap items-end gap-3" inline>
            <TextInput label="Category name" name="name" maxLength={100} className="min-w-64" />
          </AdminForm>
        </Card>
      </div>
    </div>
  );
}
