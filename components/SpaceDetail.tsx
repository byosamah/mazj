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
          <div className="relative aspect-[4/3] w-full max-w-[640px] overflow-clip rounded-[16px] shadow-[0_10px_32px_rgba(0,0,0,0.12)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt={imageAlt} className="h-full w-full object-cover" />
          </div>
        </Reveal>

        <Reveal delay={100} className="flex flex-col gap-6">
          <p className="max-w-[560px] text-15 leading-relaxed text-black lg:text-16">{body}</p>

          <dl className="flex max-w-[480px] flex-col">
            {facts.map((fact, i) => (
              <div key={i} className="flex flex-col gap-1 border-t border-black/10 py-4">
                <dt className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{fact.label}</dt>
                <dd className="text-15 text-black lg:text-16">{fact.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-12 uppercase tracking-[0.05em] text-muted">{includesTitle}</p>
            <ul className="flex max-w-[480px] flex-col gap-2">
              {includes.map((item, i) => (
                <li key={i} className="text-15 leading-relaxed text-muted">
                  {item}
                </li>
              ))}
            </ul>
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
