import { getPublishedServices } from "@/lib/data/public";
import { getSettings } from "@/lib/settings/get";
import { Section } from "@/components/ui/layout";
import { Icon } from "@/components/ui/icons";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/components/site/contact-form";

/** The single enquiry section shown directly above the footer on every public page. */
export async function ContactSection() {
  const [{ contact }, services] = await Promise.all([getSettings(), getPublishedServices().catch(() => [])]);
  return (
    <Section tone="white" id="contact" labelledBy="contact-title">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <Reveal>
          <p className="mb-3 text-sm font-semibold tracking-[0.14em] text-bronze-700 uppercase">{contact.sectionEyebrow}</p>
          <p className="text-lg text-muted">{contact.intro}</p>
          <address className="mt-8 space-y-5 not-italic">
            <p className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-gold-300">
                <Icon name="map-pin" />
              </span>
              <span>
                <span className="block font-bold text-forest-900">{contact.visitLabel}</span>
                <span className="text-muted">{contact.address}</span>
                {contact.mapsUrl && (
                  <a href={contact.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold text-bronze-700 hover:underline">
                    {contact.mapsLabel}
                  </a>
                )}
              </span>
            </p>
            <p className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-gold-300">
                <Icon name="phone" />
              </span>
              <span>
                <span className="block font-bold text-forest-900">{contact.callLabel}</span>
                <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="text-muted hover:text-bronze-700">
                  {contact.phone}
                </a>
              </span>
            </p>
            <p className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-gold-300">
                <Icon name="mail" />
              </span>
              <span>
                <span className="block font-bold text-forest-900">{contact.emailLabel}</span>
                <a href={`mailto:${contact.email}`} className="break-all text-muted hover:text-bronze-700">
                  {contact.email}
                </a>
              </span>
            </p>
            {contact.hours && (
              <p className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-forest-900 text-gold-300">
                  <Icon name="list" />
                </span>
                <span>
                  <span className="block font-bold text-forest-900">{contact.hoursLabel}</span>
                  <span className="text-muted">{contact.hours}</span>
                </span>
              </p>
            )}
          </address>
        </Reveal>
        <Reveal delay={0.1} className="rounded-[var(--radius-panel)] border border-line bg-paper p-6 shadow-[var(--shadow-soft)] md:p-8">
          <h2 id="contact-title" className="t-h3 mb-6">
            {contact.formTitle}
          </h2>
          <ContactForm services={services.map((s) => ({ slug: s.slug, title: s.title }))} />
        </Reveal>
      </div>
    </Section>
  );
}
