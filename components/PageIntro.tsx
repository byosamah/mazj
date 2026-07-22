import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import MediaFrame from "./MediaFrame";

/**
 * The shared sub-page opener, driving ~9 routes.
 *
 * Rebuilt because it was the single biggest reason the sub-pages read as
 * documents rather than designed pages: a plain <h1> and a paragraph pinned to
 * one edge, leaving roughly 60% of the first viewport empty, identical on every
 * route.
 *
 * It now borrows three things from the landing page instead:
 *   - WordReveal on the h1, the same word-by-word statement motion the landing
 *     uses for its display headings.
 *   - A ruled meta row carrying a route index beside the eyebrow, so the opener
 *     starts on a hairline like every other block on the site.
 *   - Either the route's own media in a MediaFrame, or, when a route has no
 *     photography, the dot-field texture. That split is deliberate: marketing
 *     routes open with an image, reference routes (faq, privacy, terms) stay
 *     quiet, which is how the reference system modulates by page role.
 *
 * The <h1> must stay a real h1 for the Arabic clip rule
 * (`html[lang="ar"] h1,h2,h3 { line-height: 1.35 }`).
 */
export default function PageIntro({
  eyebrow,
  title,
  intro,
  image,
  imageAlt,
  imageRatio = "aspect-[4/5]",
  index,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Route photography. Omit on reference routes for the quiet treatment. */
  image?: string;
  /**
   * Describe the PHOTOGRAPH, never the page title (the h1 sits beside it).
   * Omit — keeping alt="" — when the same photo appears again lower on the
   * page with a descriptive alt (the space detail routes), so the file is
   * described once, not announced twice.
   */
  imageAlt?: string;
  imageRatio?: string;
  /** Two-digit route marker, e.g. "02". */
  index?: string;
}) {
  return (
    <section className="relative w-full overflow-clip bg-beige px-6 pb-16 pt-[150px] lg:px-10 lg:pb-24 lg:pt-[190px]">
      {/* same hairline design grid the landing sections carry */}
      <div className="grid-overlay" aria-hidden="true" />

      <div className="relative z-[2] mx-auto grid w-full max-w-[1400px] grid-cols-1 items-end gap-12 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
        <div className="flex flex-col gap-5">
          <div className="flex items-baseline gap-5 border-t border-black/15 pt-5">
            {index && <span className="eyebrow text-12 text-orange tabular-nums">{index}</span>}
            <span className="eyebrow text-12 text-muted">{eyebrow}</span>
          </div>

          <WordReveal
            as="h1"
            className="max-w-[15ch] font-sans text-40 font-black leading-[1.04] text-black lg:text-70 lg:leading-[1.02] lg:tracking-[-1.4px]"
          >
            {title}
          </WordReveal>

          {intro && (
            <Reveal delay={220}>
              <p className="max-w-[56ch] text-pretty text-15 leading-relaxed text-muted lg:text-18">
                {intro}
              </p>
            </Reveal>
          )}
        </div>

        {image ? (
          <Reveal delay={140} className="w-full">
            <MediaFrame src={image} alt={imageAlt} ratio={imageRatio} eager className="lg:ms-auto lg:max-w-[420px]" />
          </Reveal>
        ) : (
          /* Reference routes keep the opener quiet: texture, not photography. */
          <div aria-hidden className="dot-field hidden h-[240px] w-full rounded-[16px] lg:block" />
        )}
      </div>
    </section>
  );
}
