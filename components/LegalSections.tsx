import {useTranslations} from "next-intl";
import Reveal from "./Reveal";

/**
 * Legal body for /terms and /privacy.
 *
 * Runs the brand system in "quiet mode": no pinning, no scrub, no display type.
 * A document page proves seriousness by refusing to fill the grid, so the
 * effective-date rail deliberately occupies a whole column to carry two words
 * while the prose sits off-axis beside it. That also fixes a real defect — the
 * h1 (max-w-[1400px], start-aligned) previously jumped ~270px to a centred
 * max-w-[860px] body, reading as a misalignment rather than a composition.
 *
 * The review notice used to be brown-on-tan-on-beige at roughly 1.17:1, i.e.
 * functionally invisible. A disclaimer nobody can read is worse than none, so
 * it now carries a coral rule and full-strength ink.
 */
export default function LegalSections({
  reviewNote,
  effectiveLabel,
  effectiveDate,
  sections,
  footLines = [],
}: {
  reviewNote: string;
  effectiveLabel: string;
  /** ISO date (YYYY-MM-DD). Rendered machine-readable, displayed localised. */
  effectiveDate: string;
  sections: Array<{h: string; body: string}>;
  footLines?: string[];
}) {
  // Every other string on this route arrives as an already-translated prop, so
  // the component reaches for a namespace only for the tax line (see below).
  const t = useTranslations("Footer");

  return (
    <section className="relative w-full bg-beige px-6 py-16 lg:px-10 lg:py-24">
      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        {/* Metadata rail: one datum, five columns, and no apology for it. */}
        <Reveal className="lg:col-span-4 xl:col-span-3">
          <div className="flex flex-col gap-2 border-t border-black/15 pt-5 lg:sticky lg:top-[120px]">
            <p className="eyebrow text-12 text-muted">{effectiveLabel}</p>
            {/* machine value stays ISO; only the visible label is localised */}
            <time
              dateTime={effectiveDate}
              className="text-15 text-black [font-variant-numeric:tabular-nums]"
            >
              {effectiveDate}
            </time>
          </div>
        </Reveal>

        <div className="flex flex-col gap-10 lg:col-span-8 xl:col-start-5 xl:col-span-8">
          <Reveal className="flex items-start gap-4 border-s-2 border-orange bg-beige-card/60 p-6 ps-5">
            <p className="text-14 leading-relaxed text-brown [text-wrap:pretty]">{reviewNote}</p>
          </Reveal>

          {/* One observer staggers every clause. Previously each section got
              delay={0}, so all of them wiped in as a single block — the only
              list on the site with no stagger at all. */}
          <Reveal as="div" className="reveal-list flex flex-col gap-10">
            {sections.map((s, i) => (
              <div key={i} className="flex flex-col gap-3 border-t border-black/10 pt-8">
                <h2 className="font-sans text-20 font-medium leading-snug text-black lg:text-24 [text-wrap:balance]">
                  {s.h}
                </h2>
                {/* 60ch, not 68: `ch` is the "0" advance (~9.9px here), so 68ch
                    fit ~94 AVERAGE glyphs per line at 1440 — past the ~90 outer
                    bound for sustained legal reading. 60ch lands ~83. */}
                <p className="max-w-[60ch] whitespace-pre-line text-15 leading-relaxed text-muted [text-wrap:pretty]">
                  {s.body}
                </p>
              </div>
            ))}
          </Reveal>

          {footLines.length > 0 && (
            <Reveal className="flex flex-col gap-2 border-t border-black/10 pt-8">
              {footLines.map((line, i) => (
                <p key={i} className="eyebrow text-12 text-muted [font-variant-numeric:tabular-nums]">
                  {line}
                </p>
              ))}
              {/* This was `VAT {ZATCA_TAX_NUMBER}`: a Latin label welded into
                  the component, so Arabic /privacy and /terms announced an
                  English word inside Arabic prose with no `lang` change on it
                  (WCAG 3.1.2), on top of breaking the repo's own rule that no
                  display text lives in a component.

                  `Footer.zatca` is the one translated label for this datum and
                  is already shipped on every page's footer, including these
                  two, so reading it here keeps the wording identical in both
                  locales instead of inventing a second phrasing.

                  `dir="ltr"` came off with the literal, and had to. It existed
                  to isolate a bare Latin numeral; the value is now a full
                  sentence whose base direction must follow the document, and
                  forcing LTR onto Arabic prose is itself a bidi bug. The digits
                  are a weak (EN) run at the end of the line, which the bidi
                  algorithm already orders correctly on their own. Footer.tsx
                  renders this exact string with no dir attribute.

                  🔴 Note the number now lives only in the message files, not in
                  `ZATCA_TAX_NUMBER`. If it ever changes, update both. */}
              <p className="eyebrow text-12 text-muted [font-variant-numeric:tabular-nums]">
                {t("zatca")}
              </p>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
