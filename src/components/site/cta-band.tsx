import { Container, Row } from "@/components/ui/layout";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

export function CtaBand({
  title,
  text,
  label,
  href = "/contact",
}: {
  title: string;
  text: string;
  label: string;
  href?: string;
}) {
  return (
    <section className="section section--cta bg-brand-glow py-16 text-white md:py-20" aria-labelledby="cta-title">
      <Container>
        <Row>
        <Reveal className="text-center">
          <h2 id="cta-title" className="t-h2 !text-white">
            {title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">{text}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <ButtonLink href={href} variant="accent" size="lg" arrow>
              {label}
            </ButtonLink>
            <ButtonLink href="/#work" variant="light" size="lg">
              View Our Work
            </ButtonLink>
          </div>
        </Reveal>
        </Row>
      </Container>
    </section>
  );
}
