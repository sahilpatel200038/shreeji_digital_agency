import { requirePagePermission } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { TestimonialEditor } from "@/components/admin/simple-editors";

export default async function NewTestimonial() {
  await requirePagePermission("content:write");
  return (
    <>
      <PageHeader backHref="/admin/testimonials" title="New testimonial" />
      <TestimonialEditor t={null} />
    </>
  );
}
