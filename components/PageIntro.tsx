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
  variant = "panel",
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
  /**
   * "panel" (default) is the light two-column opener below.
   * "hero" is the full-bleed photo opener: the route photograph fills the
   * whole band edge-to-edge behind a scrim, with the copy overlaid at the
   * bottom-start in beige — the sub-page's arrival moment, distinct from the
   * bg-beige content that follows. Opt in per route so it can roll out one
   * page at a time; the h1 stays a real <h1> for the Arabic clip rule.
   */
  variant?: "panel" | "hero";
}) {
  if (variant === "hero") {
    return (
      <section className="relative flex min-h-[600px] w-full items-end overflow-clip bg-black px-6 pb-14 pt-[150px] lg:min-h-[700px] lg:px-10 lg:pb-20 lg:pt-[190px]">
        {/* Full-bleed route photograph. Decorative here: it sits BEHIND the h1
            that already carries the page's meaning, so alt="" unless a route
            passes a descriptive imageAlt. Eager — this is the opener's LCP. */}
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={imageAlt ?? ""}
            className="absolute inset-0 z-0 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          /* Reference routes (no photography) keep a quiet textured ground. */
          <div aria-hidden className="dot-field absolute inset-0 z-0 opacity-70" />
        )}

        {/* Scrim: darkest at the bottom where the copy sits, so beige text
            clears AA over ANY photo (measured — the /events windows are the
            bright-backdrop worst case), fading to clear up top so the room
            still reads. Multi-stop + bottom-heavy: ~0.79 black at the eyebrow's
            height is what pulls the brightest window pixel under the small
            label back over 4.5:1. Inline so the exact stops are legible and the
            format-on-save linter can't rewrite them. */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.86) 24%, rgba(0,0,0,0.68) 46%, rgba(0,0,0,0.28) 72%, rgba(0,0,0,0) 100%)",
          }}
        />
        {/* Start-side scrim: darkens only the copy corner so the small eyebrow
            clears AA over a bright photo (AR /events window), locale-flipped. */}
        <div className="hero-x-scrim" aria-hidden="true" />
        {/* Same hairline design grid the landing hero carries, light variant. */}
        <div className="grid-overlay grid-overlay--light" aria-hidden="true" />

        <div className="relative z-[2] mx-auto w-full max-w-[1400px]">
          <div className="flex max-w-[720px] flex-col gap-5">
            <div className="flex items-baseline gap-5 border-t border-beige/25 pt-5">
              {index && <span className="eyebrow text-12 text-orange tabular-nums">{index}</span>}
              <span className="eyebrow text-12 text-beige">{eyebrow}</span>
            </div>

            <WordReveal
              as="h1"
              className="max-w-[15ch] font-sans text-45 font-black leading-[1.04] text-beige lg:text-85 lg:leading-[0.98] lg:tracking-[-1.7px]"
            >
              {title}
            </WordReveal>

            {intro && (
              <Reveal delay={220}>
                <p className="max-w-[56ch] text-pretty text-15 leading-relaxed text-beige lg:text-18">
                  {intro}
                </p>
              </Reveal>
            )}
          </div>
        </div>
      </section>
    );
  }

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
