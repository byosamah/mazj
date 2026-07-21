import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

type Fact = {label: string; value: string};
type Cta = {label: string; href: string; variant?: "dark" | "light"};

/**
 * Shared body for the four space detail pages: photo card + facts + what's
 * included + booking CTAs. Pages pass already-translated strings.
 */
export default function SpaceDetail({
  image,
  imageAlt,
  body,
  facts,
  includesTitle,
  includes,
  ctas,
}: {
  image: string;
  imageAlt: string;
  body: string;
  facts: Fact[];
  includesTitle: string;
  includes: string[];
  ctas: Cta[];
}) {
  return (
    <section className="relative w-full bg-beige px-6 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex items-start justify-center">
          <div className="relative aspect-[4/3] w-full max-w-[640px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(0,0,0,0.1)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
          </div>
        </Reveal>

        <Reveal delay={100} className="flex flex-col gap-6">
          <p className="max-w-[560px] text-15 leading-relaxed text-black lg:text-16 text-pretty">{body}</p>

          {/* Spec table. `last:border-b` closes the list: rows with a top rule
              and no closing rule read as truncated rather than as a finished
              datasheet. Reversed hierarchy — the VALUE leads at reading size,
              the label sits above it in the small label register. */}
          <dl className="flex max-w-[480px] flex-col">
            {facts.map((fact, i) => (
              <div
                key={i}
                className="flex flex-col gap-1 border-t border-black/10 py-4 last:border-b"
              >
                <dt className="eyebrow text-12 text-muted">{fact.label}</dt>
                <dd className="text-15 text-black lg:text-16 tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {/* "What's included" was a bare <ul> in muted grey with the markers
              stripped, so four separate buying reasons read as one grey
              paragraph with line breaks. Each item now gets a coral marker and
              full-strength ink, and the container staggers them with a single
              observer. The marker uses mt-[7px]+shrink-0 for optical alignment
              against the first line of a wrapping item. */}
          <div className="flex flex-col gap-4">
            <p className="eyebrow text-12 text-muted">{includesTitle}</p>
            {/* must be a Reveal, not a plain <ul>: `.reveal-list` hides its
                children until the CONTAINER gains `.is-visible`. */}
            <Reveal as="ul" className="reveal-list flex max-w-[480px] flex-col gap-3">
              {includes.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-[7px] h-[6px] w-[6px] shrink-0 rounded-full bg-orange"
                  />
                  <span className="text-15 leading-relaxed text-black/80 text-pretty">{item}</span>
                </li>
              ))}
            </Reveal>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            {ctas.map((cta, i) => (
              <CtaButton key={i} href={cta.href} variant={cta.variant ?? "dark"}>
                {cta.label}
              </CtaButton>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
