import { AdminForm, CheckboxField, SelectField, TextArea, TextInput } from "@/components/admin/admin-form";
import { MediaPicker } from "@/components/admin/media-picker";
import { Card } from "@/components/admin/ui";
import { saveFaq, saveProject, saveTestimonial } from "@/actions/content";
import { saveTeamMember } from "@/actions/team";
import type { Faq, Project, TeamMember, Testimonial } from "@/generated/prisma/client";
import { lockKey } from "@/lib/lock-keys";

const STATUS = [
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft (hidden)" },
];

export function ProjectEditor({ project }: { project: Project | null }) {
  return (
    <AdminForm action={saveProject} submitLabel={project ? "Save project" : "Create project"} lock={project ? [lockKey.project(project.id)] : undefined} cancelHref="/admin/projects">
      {project && <input type="hidden" name="id" value={project.id} />}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Project name" name="name" defaultValue={project?.name} required maxLength={150} />
          <SelectField label="Category" name="category" defaultValue={project?.category ?? "DIGITAL_MARKETING"} options={[{ value: "DIGITAL_MARKETING", label: "Digital Marketing" }, { value: "WEB_DEVELOPMENT", label: "Web Development" }, { value: "WEB_APPLICATION", label: "Web Application" }]} />
          <TextInput label="Scope tags" name="tags" defaultValue={((project?.tags as string[] | null) ?? []).join(", ")} hint="Comma-separated, e.g. Next.js, UI/UX, SEO" className="md:col-span-2" />
          <TextArea label="Summary (optional)" name="summary" defaultValue={project?.summary} rows={2} maxLength={500} className="md:col-span-2" />
          <TextInput label="Project link (optional)" name="externalUrl" defaultValue={project?.externalUrl} placeholder="https://…" />
          <SelectField label="Status" name="status" defaultValue={project?.status ?? "PUBLISHED"} options={STATUS} />
          <TextInput label="Display order" name="sortOrder" type="number" min={0} max={9999} defaultValue={project?.sortOrder ?? 0} />
          <div className="md:col-span-2">
            <MediaPicker name="mediaId" label="Logo / image" defaultId={project?.mediaId} hint="Projects without an image show a branded placeholder." />
          </div>
        </div>
      </Card>
    </AdminForm>
  );
}

export function TestimonialEditor({ t }: { t: Testimonial | null }) {
  return (
    <AdminForm action={saveTestimonial} submitLabel={t ? "Save testimonial" : "Create testimonial"} lock={t ? [lockKey.testimonial(t.id)] : undefined} cancelHref="/admin/testimonials">
      {t && <input type="hidden" name="id" value={t.id} />}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Name" name="name" defaultValue={t?.name} required maxLength={120} />
          <TextInput label="Location" name="location" defaultValue={t?.location} maxLength={120} />
          <TextInput label="Company (optional)" name="company" defaultValue={t?.company} maxLength={160} />
          <TextInput label="Display order" name="sortOrder" type="number" min={0} max={9999} defaultValue={t?.sortOrder ?? 0} />
          <TextArea label="Quote" name="quote" defaultValue={t?.quote} rows={4} required maxLength={1500} className="md:col-span-2" />
          <SelectField label="Status" name="status" defaultValue={t?.status ?? "DRAFT"} options={[{ value: "PUBLISHED", label: "Published" }, { value: "DRAFT", label: "Draft (hidden)" }]} />
          <div className="rounded-lg border border-bronze-300 bg-bronze-100/40 p-3">
            <CheckboxField label="I have verified this testimonial is genuine" name="isVerified" defaultChecked={t?.isVerified} hint="It is shown publicly only when it is both Published and Verified, with the client's permission." />
          </div>
        </div>
      </Card>
    </AdminForm>
  );
}

export function FaqEditor({ f }: { f: Faq | null }) {
  return (
    <AdminForm action={saveFaq} submitLabel={f ? "Save FAQ" : "Create FAQ"} lock={f ? [lockKey.faq(f.id)] : undefined} cancelHref="/admin/faqs">
      {f && <input type="hidden" name="id" value={f.id} />}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Question" name="question" defaultValue={f?.question} required maxLength={500} className="md:col-span-2" />
          <TextArea label="Answer" name="answer" defaultValue={f?.answer} rows={5} required maxLength={3000} className="md:col-span-2" />
          <TextInput label="Group" name="category" defaultValue={f?.category ?? "General"} maxLength={60} hint="FAQs are grouped by this heading on the FAQ page." />
          <TextInput label="Display order" name="sortOrder" type="number" min={0} max={9999} defaultValue={f?.sortOrder ?? 0} />
          <SelectField label="Status" name="status" defaultValue={f?.status ?? "PUBLISHED"} options={STATUS} />
          <CheckboxField label="Show on the homepage" name="showOnHome" defaultChecked={f?.showOnHome} />
        </div>
      </Card>
    </AdminForm>
  );
}

export function TeamEditor({ member, nextOrder = 1 }: { member: TeamMember | null; nextOrder?: number }) {
  return (
    <AdminForm action={saveTeamMember} submitLabel={member ? "Save team member" : "Add team member"} lock={member ? [lockKey.team(member.id)] : undefined} cancelHref="/admin/team">
      {member && <input type="hidden" name="id" value={member.id} />}
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Name" name="name" defaultValue={member?.name} required maxLength={120} />
          <TextInput label="Role" name="role" defaultValue={member?.role} required maxLength={120} hint="Short designation, e.g. CEO." />
          <TextInput label="Full title (optional)" name="title" defaultValue={member?.title} maxLength={160} hint="Shown under the role, e.g. Chief Executive Officer." className="md:col-span-2" />
          <SelectField label="Status" name="status" defaultValue={member?.status ?? "PUBLISHED"} options={STATUS} />
          <TextInput label="Display order" name="sortOrder" type="number" min={0} max={9999} defaultValue={member?.sortOrder ?? nextOrder} hint="Lower numbers appear first. You can also reorder from the Team list." />
          <div className="md:col-span-2">
            <MediaPicker name="photoId" label="Photo" defaultId={member?.photoId} hint="Use only an approved photograph of this person. Without one, a neutral placeholder is shown." />
          </div>
        </div>
      </Card>
    </AdminForm>
  );
}
