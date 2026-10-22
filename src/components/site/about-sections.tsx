import Image from "next/image";
import type { Block } from "@/lib/blocks/schema";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { BlockRenderer } from "@/components/blocks/block-renderer";
import { Section, SectionHeading } from "@/components/ui/layout";

export type TeamMemberView = { id: number; name: string; role: string; title: string; photo: { id: number; checksum: string; altText: string } | null };

/** Company profile: the page's CMS content on the left, a company photo on the right (stacked on mobile, text first). */
export function CompanyProfileSection({ blocks, image }: { blocks: Block[]; image: { src: string; alt: string } }) {
  return (
    <Section tone="white" labelledBy="company-profile-label">
      <h2 id="company-profile-label" className="sr-only">
        Company profile
      </h2>
      <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div className="min-w-0">
          <BlockRenderer blocks={blocks} />
        </div>
        <Reveal className="lg:sticky lg:top-28">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-forest-50 shadow-[var(--shadow-lift)]">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 80vw, 100vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function AvatarPlaceholder() {
  return (
    <div className="bg-brand-glow grid h-full w-full place-items-center text-gold-300/80" role="img" aria-label="Photo to be added">
      <svg viewBox="0 0 24 24" width="30%" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
      </svg>
    </div>
  );
}

export function TeamSection({ members, eyebrow = "Leadership", title = "Meet our leadership team" }: { members: TeamMemberView[]; eyebrow?: string; title?: string }) {
  if (members.length === 0) return null;
  return (
    <Section tone="paper" id="team" labelledBy="team-heading">
      <div className="w-full">
        <SectionHeading id="team-heading" eyebrow={eyebrow} title={title} align="center" />
        <Stagger className="flex flex-wrap justify-center gap-6">
          {members.map((m) => (
            <StaggerItem key={m.id} className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]">
              <article className="group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white text-center transition duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                <div className="relative aspect-[4/3] overflow-hidden bg-forest-900">
                  {m.photo ? (
                    <Image src={`/media/${m.photo.id}?v=${m.photo.checksum.slice(0, 8)}`} alt={m.photo.altText || `${m.name}, ${m.title || m.role}`} fill sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw" className="object-cover" />
                  ) : (
                    <AvatarPlaceholder />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="t-h3 !text-xl">{m.name}</h3>
                  <p className="mt-1 font-semibold text-bronze-700">{m.role}</p>
                  {m.title && m.title !== m.role && <p className="mt-0.5 text-sm text-muted">{m.title}</p>}
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
