import {useTranslations} from "next-intl";
import Reveal from "./Reveal";

type Item = {q: string; a: string};
type Group = {label: string; items: Item[]};

/**
 * FAQ. Reads the shared "Faq" namespace so the landing section and the /faq
 * page share one source of truth.
 *
 * Two registers, matching how a marketing section differs from a reference leaf:
 *   - landing → `limit` shows the first N questions as a teaser, no categories.
 *   - /faq    → `grouped` shows every question split into categories, each
 *               category a real <h2>. The route previously had NO h2 at all,
 *               because it rendered this section with showHeader={false}.
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
      {/* On the landing this is a centred marketing section. On /faq it sits
          under PageIntro, whose h1 is start-aligned inside max-w-[1400px] — so
          a centred max-w-[860px] column pushed the first question ~250px off
          the page's own axis and read as a misalignment rather than a
          composition. Grouped mode therefore shares PageIntro's container and
          start-aligns the reading column inside it. */}
      <div
        className={
          grouped
            ? "mx-auto flex w-full max-w-[1400px] flex-col gap-12"
            : "mx-auto flex w-full max-w-[860px] flex-col gap-12"
        }
      >
        <div className={grouped ? "flex w-full max-w-[860px] flex-col gap-12" : "contents"}>
        {showHeader && (
          <Reveal className="flex flex-col items-center gap-5 text-center">
            <p className="eyebrow text-12 text-muted">{t("eyebrow")}</p>
            <h2 className="whitespace-pre-line text-balance font-sans text-32 font-medium leading-[1.05] text-black lg:text-50">
              {t("title")}
            </h2>
          </Reveal>
        )}

        {grouped ? (
          <div className="flex flex-col gap-16">
            {groups.map((group, gi) => (
              <div key={group.label} className="flex flex-col gap-2">
                <Reveal className="pb-2">
                  <h2 className="font-sans text-24 font-medium leading-tight text-black lg:text-32">
                    {group.label}
                  </h2>
                </Reveal>
                <dl className="flex flex-col">
                  {group.items.map((item, i) => (
                    <FaqRow
                      key={item.q}
                      item={item}
                      id={`faq-${gi}-${i}`}
                      delay={Math.min(i, 4) * 60}
                    />
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <dl className="flex flex-col">
            {teaser.map((item, i) => (
              <FaqRow key={item.q} item={item} id={`faq-${i}`} delay={Math.min(i, 4) * 60} />
            ))}
          </dl>
        )}
        </div>
      </div>
    </section>
  );
}

/**
 * One question. The `input` must precede both the `label` and `.acc-panel`,
 * because the CSS drives open/closed through `~` sibling selectors.
 */
function FaqRow({item, id, delay}: {item: Item; id: string; delay: number}) {
  return (
    <Reveal as="div" delay={delay} className="border-t border-black/10 last:border-b">
      <input type="checkbox" id={id} className="acc-toggle" />
      <dt>
        <label htmlFor={id} className="acc-label group">
          <span className="font-sans text-18 leading-snug text-black transition-opacity duration-200 group-hover:opacity-60 lg:text-20 [text-wrap:balance]">
            {item.q}
          </span>
          {/* one glyph, two states: rotated 45deg a plus reads as a close mark */}
          <span aria-hidden className="acc-sign mt-1 text-20 leading-none text-muted">
            +
          </span>
        </label>
      </dt>
      <dd className="acc-panel">
        <div>
          <p className="max-w-[720px] pb-7 text-15 leading-relaxed tabular-nums text-muted [text-wrap:pretty]">
            {item.a}
          </p>
        </div>
      </dd>
    </Reveal>
  );
}
