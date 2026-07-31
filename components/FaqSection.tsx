import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import CtaButton from "./CtaButton";

type Item = {q: string; a: string};
type Group = {label: string; items: Item[]};

/**
 * FAQ. Reads the shared "Faq" namespace so the landing section and the /faq
 * page share one source of truth.
 *
 * Two registers, matching how a marketing section differs from a reference leaf:
 *   - landing → `limit` shows the first N questions as a teaser in a two-column
 *     editorial layout: title + "see all" rail on the start side, questions on
 *     the end side, so it stops reading as a centred wall of text.
 *   - /faq    → `grouped` shows every question split into categories, each
 *               category a real <h2>, in a single start-aligned reading column.
 *
 * Answers collapse by default via a checkbox + CSS-grid accordion (`.acc-*` in
 * globals.css). Fifteen permanently-expanded answers is a wall of text, and
 * collapsing them is what makes the full set usable on a single page.
 */
export default function FaqSection({
  showHeader = true,
  grouped = false,
  limit,
}: {
  showHeader?: boolean;
  grouped?: boolean;
  limit?: number;
}) {
  const t = useTranslations("Faq");
  const groups = t.raw("groups") as Group[];

  const flat = groups.flatMap((g) => g.items);
  const teaser = typeof limit === "number" ? flat.slice(0, limit) : flat;

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      {grouped ? (
        /* /faq: shares PageIntro's max-w-[1400px] and start-aligns a
           max-w-[860px] reading column inside it — a centred column pushed the
           first question ~250px off the page's own axis. */
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-12">
          <div className="flex w-full max-w-[860px] flex-col gap-12">
            {showHeader && (
              <Reveal className="flex flex-col gap-5">
                <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
                <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
                  {t("title")}
                </h2>
              </Reveal>
            )}
            <div className="flex flex-col gap-16">
              {groups.map((group, gi) => (
                <div key={group.label} className="flex flex-col gap-2">
                  <Reveal className="pb-2">
                    <h2 className="font-sans text-24 font-medium leading-tight text-black lg:text-32">
                      {group.label}
                    </h2>
                  </Reveal>
                  <div className="flex flex-col">
                    {group.items.map((item, i) => (
                      <FaqRow
                        key={item.q}
                        item={item}
                        id={`faq-${gi}-${i}`}
                        delay={Math.min(i, 4) * 60}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Landing teaser: two-column editorial. Title + "see all" sit in a
           start-side rail; the questions read down the wider end column. */
        <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-16">
          <Reveal className="flex flex-col items-start gap-6">
            {showHeader && (
              <>
                <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
                <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
                  {t("title")}
                </h2>
              </>
            )}
            {/* The teaser used to dead-end: /faq's only inbound link was the
                footer, despite this section advertising the questions. */}
            {typeof limit === "number" && (
              <div className="pt-2">
                <CtaButton href="/faq" variant="dark">
                  {t("allCta")}
                </CtaButton>
              </div>
            )}
          </Reveal>
          <div className="flex flex-col">
            {teaser.map((item, i) => (
              <FaqRow key={item.q} item={item} id={`faq-${i}`} delay={Math.min(i, 4) * 60} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * One question. The `input` must precede both the `label` and `.acc-panel`,
 * because the CSS drives open/closed through `~` sibling selectors.
 *
 * 🔴 NOT a `dl`/`dt`/`dd`, and it must not be turned back into one. The rows
 * were exactly that, and it was invalid HTML: a `dl` may contain only `dt`/`dd`
 * groups or `div`s that themselves contain only `dt`/`dd`, and each row here
 * has to carry the `<input>` that drives the accordion as a SIBLING of the
 * question and the answer — that is what the `~` selectors in globals.css
 * traverse. So the checkbox could not live anywhere legal. axe failed it
 * (`definition-list`) on every route that renders this section, which is the
 * landing page and `/faq`.
 *
 * A heading is the better answer anyway, not merely the legal one: `dt` is not
 * a heading, so a screen-reader user could not jump question to question. As
 * `h3` they land in the rotor, one level under the `h2` that both call sites
 * already render above them. Tailwind's preflight strips heading margins and
 * sizes, so nothing moves on screen. The class names are untouched, so the
 * accordion CSS is byte-for-byte the same contract it was.
 */
function FaqRow({item, id, delay}: {item: Item; id: string; delay: number}) {
  return (
    <Reveal as="div" delay={delay} className="border-t border-black/10 last:border-b">
      <input type="checkbox" id={id} className="acc-toggle" />
      <h3>
        <label htmlFor={id} className="acc-label group">
          <span className="font-sans text-18 leading-snug text-black underline decoration-transparent underline-offset-[6px] [transition:text-decoration-color_200ms] group-hover:decoration-black lg:text-20 [text-wrap:balance]">
            {item.q}
          </span>
          {/* one glyph, two states: rotated 45deg a plus reads as a close mark */}
          <span aria-hidden className="acc-sign mt-1 text-20 leading-none text-muted">
            +
          </span>
        </label>
      </h3>
      <div className="acc-panel">
        <div>
          <p className="max-w-[720px] pb-7 text-15 leading-relaxed tabular-nums text-muted [text-wrap:pretty]">
            {item.a}
          </p>
        </div>
      </div>
    </Reveal>
  );
}
