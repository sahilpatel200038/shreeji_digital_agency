import type { Metadata } from "next";
import { listingSeo } from "@/lib/seo/listing";
import { buildMetadata } from "@/lib/seo/metadata";
import { getSettings } from "@/lib/settings/get";
import { getBannerMedia, getFaqs, getVerifiedTestimonials } from "@/lib/data/public";
import { resolveBanner } from "@/lib/banner";
import { BannerImage } from "@/components/ui/banner-image";
import { faqSchema, organizationSchema, websiteSchema } from "@/lib/seo/schema";
import { Banner, Section, SectionHeading, Pill } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { JsonLd } from "@/components/ui/json-ld";
import { FaqAccordion } from "@/components/ui/faq-accordion";
import { HeroText, Reveal, Stagger, StaggerItem } from "@/components/motion/reveal";
import { Counter } from "@/components/motion/counter";
import { TestimonialCard } from "@/components/site/cards";
import { VideoPlayer } from "@/components/ui/video-player";
import { parseVideoUrl } from "@/lib/video";
import { Slider } from "@/components/ui/slider";
import { ServicesSliderSection, WorkSliderSection } from "@/components/site/slider-sections";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const seo = await listingSeo("home");
  return buildMetadata({
    seo: { ...seo, title: seo.title || s.seo.defaultTitle, description: seo.description || s.seo.defaultDescription },
    fallbackTitle: s.seo.defaultTitle,
    path: "/",
  });
}

/** Icons for the "why us" cards, by position. Titles and text come from Admin > Settings > Homepage. */
const WHY_ICONS = ["users", "layout", "chart", "shield"];

export default async function HomePage() {
  const [settings, faqs, testimonials] = await Promise.all([
    getSettings(),
    getFaqs({ homeOnly: true }),
    getVerifiedTestimonials(),
  ]);
  const { home, general } = settings;
  const banner = resolveBanner("home", await getBannerMedia(settings.banners.home));
  const heroImage = home.heroImageAlt ? { ...banner, alt: home.heroImageAlt } : banner;
  const showTestimonials = home.showTestimonials && testimonials.length > 0;
  const showFaq = home.showFaq && faqs.length > 0;
  const showStats = home.showStats && home.stats.length > 0;

  return (
    <>
      <JsonLd data={[organizationSchema(settings, settings.seo.ogMediaId), websiteSchema(settings)]} />
      {showFaq && <JsonLd data={faqSchema(faqs.map((f) => ({ question: f.question, answer: f.answer })))} />}

      {/* Hero */}
      <Banner as="section" size="hero" rowClassName="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm font-semibold tracking-wide text-gold-300">
              <span className="size-2 rounded-full bg-gold-300" aria-hidden="true" />
              {home.eyebrow}
            </p>
            <h1 className="t-h1 !text-white">
              <HeroText text={home.headline} />
            </h1>
            <Reveal delay={0.35}>
              <p className="mt-6 max-w-xl text-lg text-white/80 md:text-xl">{home.subheadline}</p>
              <div className="mt-9 flex flex-wrap gap-4">
                {home.ctaPrimaryLabel && (
                  <ButtonLink href={home.ctaPrimaryHref || "/contact"} variant="accent" size="lg" arrow>
                    {home.ctaPrimaryLabel}
                  </ButtonLink>
                )}
                {home.ctaSecondaryLabel && (
                  <ButtonLink href={home.ctaSecondaryHref || "#work"} variant="light" size="lg">
                    {home.ctaSecondaryLabel}
                  </ButtonLink>
                )}
              </div>
              <p className="mt-6 text-sm text-white/60">{general.tagline}</p>
            </Reveal>
          </div>
          <Reveal delay={0.2} className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="absolute inset-0 -z-0 rounded-full bg-gold-300/20 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <BannerImage image={heroImage} />
            </div>
          </Reveal>
      </Banner>

      {/* About teaser */}
      {home.showAbout && (
      <Section tone="white" labelledBy="about-title">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <p className="mb-3 text-sm font-semibold tracking-[0.14em] text-bronze-700 uppercase">{home.aboutEyebrow}</p>
            <h2 id="about-title" className="t-h2">
              {home.aboutTitle}
            </h2>
            <p className="mt-5 text-lg text-muted">{home.aboutText}</p>
            {home.aboutPills.length > 0 && (
              <ul className="mt-6 flex flex-wrap gap-2">
                {home.aboutPills.map((t, i) => (
                  <li key={`${i}-${t}`}>
                    <Pill>{t}</Pill>
                  </li>
                ))}
              </ul>
            )}
            {home.aboutButtonLabel && (
              <ButtonLink href={home.aboutButtonHref || "/about"} variant="outline" className="mt-8" arrow>
                {home.aboutButtonLabel}
              </ButtonLink>
            )}
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {home.whyUs.map((w, i) => (
              <StaggerItem key={`${i}-${w.title}`} className="rounded-[var(--radius-card)] border border-line bg-paper p-5">
                <span className="mb-3 grid size-11 place-items-center rounded-xl bg-forest-900 text-gold-300">
                  <Icon name={WHY_ICONS[i] ?? "sparkles"} />
                </span>
                <h3 className="text-lg font-bold">{w.title}</h3>
                <p className="mt-1.5 text-[15px] text-muted">{w.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Section>
      )}

      {/* Core services */}
      {home.showServices && (
        <ServicesSliderSection
          id="services"
          title={home.servicesTitle}
          text={home.servicesText}
          footer={
            home.servicesButtonLabel ? (
              <ButtonLink href="/services" variant="outline" arrow>
                {home.servicesButtonLabel}
              </ButtonLink>
            ) : undefined
          }
        />
      )}

      {/* Process */}
      {home.showProcess && home.process.length > 0 && (
      <Section tone="forest" labelledBy="process-title">
        <SectionHeading id="process-title" tone="dark" eyebrow={home.processEyebrow} title={home.processTitle} />
        <Stagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {home.process.map((p, i) => (
            <StaggerItem key={`${i}-${p.title}`} className="rounded-[var(--radius-card)] border border-white/15 bg-white/[0.06] p-6">
              <span className="font-display text-4xl font-extrabold text-gradient">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-xl font-bold">{p.title}</h3>
              <p className="mt-2 text-white/75">{p.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </Section>
      )}

      {showStats && (
        <Section tone="forest" labelledBy="stats-title">
          <h2 id="stats-title" className="sr-only">
            Results
          </h2>
          <dl className="grid gap-8 text-center sm:grid-cols-2 lg:grid-cols-4">
            {home.stats.map((s) => (
              <div key={s.label}>
                <dd className="font-display text-5xl font-extrabold text-gradient">
                  <Counter value={s.value} suffix={s.suffix} />
                </dd>
                <dt className="mt-2 text-white/80">{s.label}</dt>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {showTestimonials && (
        <Section labelledBy="testimonials-title">
          <SectionHeading id="testimonials-title" eyebrow={home.testimonialsEyebrow} title={home.testimonialsTitle} />
          <Slider
            label="Client testimonials"
            items={testimonials.map((t) => (
              <TestimonialCard key={t.id} name={t.name} location={t.location} quote={t.quote} />
            ))}
          />
        </Section>
      )}

      {/* Work videos */}
      {home.showVideos && (
      <Section tone="paper" id="videos" labelledBy="videos-title" className="scroll-mt-20">
        <SectionHeading id="videos-title" eyebrow={home.videosEyebrow} title={home.videosTitle} text={home.videosText} />
        <Stagger className="grid gap-8 md:grid-cols-2">
          {[0, 1].map((i) => {
            const v = home.videos[i];
            const title = v?.title || `Work video ${i + 1}`;
            return (
              <StaggerItem key={i}>
                <VideoPlayer source={v?.url ? parseVideoUrl(v.url) : null} title={title} />
                <h3 className="mt-4 text-xl font-bold">{title}</h3>
                {v?.text && <p className="mt-1.5 text-muted">{v.text}</p>}
              </StaggerItem>
            );
          })}
        </Stagger>
      </Section>
      )}

      {/* Work */}
      {home.showWork && <WorkSliderSection id="work" title={home.workTitle} text={home.workText} />}

      {showFaq && (
        <Section tone={showTestimonials ? "white" : "paper"} labelledBy="faq-title">
          <div>
            <SectionHeading id="faq-title" align="center" eyebrow={home.faqEyebrow} title={home.faqTitle} />
            <FaqAccordion items={faqs.map((f) => ({ question: f.question, answer: f.answer }))} />
            {home.faqButtonLabel && (
              <div className="mt-8 text-center">
                <ButtonLink href="/faq" variant="ghost" arrow>
                  {home.faqButtonLabel}
                </ButtonLink>
              </div>
            )}
          </div>
        </Section>
      )}

    </>
  );
}
