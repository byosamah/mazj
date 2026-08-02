import Image from "next/image";
import {Link} from "@/i18n/navigation";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";
import JsonLd from "./JsonLd";
import {faqPageSchema} from "@/lib/schema";

type Fact = {label: string; value: string};
type Cta = {label: string; href: string; variant?: "dark" | "light"};
type Qa = {q: string; a: string};

/**
 * Shared body for the four space detail pages: photo card + facts + what's
 * included + booking CTAs, then an optional "in detail" band (prose + a
 * page-specific FAQ). Pages pass already-translated strings.
 */
export default function SpaceDetail({
  image,
  imageAlt,
  body,
  facts,
  includesTitle,
  includes,
  ctas,
  aboutTitle,
  about,
  faqTitle,
  faq,
  faqAllLabel,
}: {
  image: string;
  /**
   * Must describe the PHOTOGRAPH ("Open desks in the shared coworking space
   * at MAZJ…"), NEVER the page title: this prop once received `t("title")`,
   * the literal text of the <h1> a few hundred pixels up, so a screen reader
   * announced the same phrase twice in a row (WCAG 1.1.1) and it shipped
   * ignored for a while. Pages pass the `photoAlt` i18n key.
   */
  imageAlt?: string;
  body: string;
  facts: Fact[];
  includesTitle: string;
  includes: string[];
  ctas: Cta[];
  /** Heading for the prose band; required with `about`. */
  aboutTitle?: string;
  /** 2-3 paragraphs of indexable depth: who it's for, booking mechanics. */
  about?: string[];
  /** Heading for the page-specific FAQ column; required with `faq`. */
  faqTitle?: string;
  /** Short Q&A set. Expanded on purpose: 3-4 visible answers are the content
      these transactional pages were missing, and they need no accordion. */
  faq?: Qa[];
  /** Label for the link to the full /faq page. */
  faqAllLabel?: string;
}) {
  return (
    <section className="relative w-full bg-beige px-6 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex items-start justify-center">
          {/* Hairline via `after:`, the MediaFrame idiom. This is the biggest
              photo on all four space routes and it was the last drop-shadowed
              card on the site; its inset ring never rendered at all, because an
              inset shadow paints under the opaque photo that fills the box. */}
          <div className="relative aspect-[4/3] w-full max-w-[640px] overflow-clip rounded-[16px] after:pointer-events-none after:absolute after:inset-0 after:rounded-[16px] after:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] after:content-['']">
            <Image
              src={image}
              alt={imageAlt ?? ""}
              fill
              sizes="(min-width: 1024px) 640px, 100vw"
              className="object-cover"
            />
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
            {/* 🔴 A HEADING, not a styled <p>. This labels the four buying
                reasons on all 8 space-detail URLs, which is the exact block a
                buyer-intent query asks about, and a paragraph puts it in no
                outline and no screen-reader rotor. `h3` is the right level: it
                sits under the `aboutTitle` h2 and introduces no skipped level.
                Visually identical, because `.eyebrow` (a class, 0-1-0) outranks
                `h3 { letter-spacing: -0.02em }` (an element, 0-0-1) and
                Tailwind's preflight strips heading size and margin. */}
            <h3 className="eyebrow text-12 text-muted">{includesTitle}</h3>
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

      {/* The "in detail" band: the depth these transactional pages were missing
          (each ran ~130 words of unique copy against queries whose ranking
          pages run 600+). Prose on the left, the page's own Q&A on the right. */}
      {about && about.length > 0 && faq && faq.length > 0 && (
        <div className="mx-auto mt-16 grid w-full max-w-[1400px] grid-cols-1 items-start gap-12 border-t border-black/10 pt-14 lg:mt-24 lg:grid-cols-2 lg:gap-16 lg:pt-16">
          <Reveal className="flex flex-col gap-5">
            {aboutTitle && (
              <h2 className="max-w-[18ch] text-balance font-sans text-24 font-medium leading-tight text-black lg:text-32">
                {aboutTitle}
              </h2>
            )}
            {about.map((paragraph, i) => (
              <p
                key={i}
                className="max-w-[56ch] text-pretty text-15 leading-relaxed text-black/80 lg:text-16"
              >
                {paragraph}
              </p>
            ))}
          </Reveal>

          <Reveal delay={100} className="flex flex-col gap-4">
            {/* 🔴 FAQPage markup lives HERE, beside the questions it describes,
                not in the four page.tsx files that mount this component.
                Google requires the marked-up answer to be present on the page,
                so the schema and the visible <dl> must never be able to
                disagree. Building both from the same `faq` prop makes that
                structurally true rather than a thing to remember: there is no
                second read of the message file to drift from.

                Each of the four space pages carries its own four questions and
                NONE of them repeats one from /faq (verified 2026-08-02: 16
                space questions, 18 on /faq, zero overlap), so these are 16
                genuinely additional Q&A pairs rather than a duplicate of the
                FAQPage node on /faq. One FAQPage per URL is exactly what the
                spec wants.

                ⚠️ Deliberately NOT extended to the landing page's FAQ teaser,
                which renders a `limit`ed slice of the /faq set. Marking up a
                partial copy of another page's questions is the one shape of
                this that IS duplication. app/CLAUDE.md records that rule.

                On Google specifically this earns no stars any more (FAQ rich
                results are limited to government and health sites). It is here
                for Perplexity, which measurably favours FAQ structured data,
                and for the other answer engines that read it. */}
            <JsonLd data={faqPageSchema(faq)} />
            {faqTitle && (
              <h2 className="text-balance font-sans text-24 font-medium leading-tight text-black lg:text-32">
                {faqTitle}
              </h2>
            )}
            <dl className="flex flex-col">
              {faq.map((item) => (
                <div
                  key={item.q}
                  className="flex flex-col gap-2 border-t border-black/10 py-5 last:border-b"
                >
                  <dt className="font-sans text-16 font-medium leading-snug text-black lg:text-18">
                    {item.q}
                  </dt>
                  <dd className="max-w-[62ch] text-pretty text-15 leading-relaxed text-muted">
                    {item.a}
                  </dd>
                </div>
              ))}
            </dl>
            {faqAllLabel && (
              <Link
                href="/faq"
                className="relative self-start text-14 text-muted underline underline-offset-4 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] [transition:color_160ms,transform_120ms] hover:text-black active:scale-[0.96]"
              >
                {faqAllLabel}
              </Link>
            )}
          </Reveal>
        </div>
      )}
    </section>
  );
}
