import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { PostEditor } from "@/components/admin/post-editor";

export default async function NewPost() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader title="New post" />
      <PostEditor post={null} />
    </>
  );
}
