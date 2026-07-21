import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import MediaFrame from "./MediaFrame";
import CtaButton from "./CtaButton";
import {SOCIALS} from "@/lib/links";

/**
 * Announced events.
 *
 * This carries the poster-card treatment that used to belong to the "recurring
 * series" block. That was the wrong home for it: every series edition had
 * already happened, so the strongest visual on the route was advertising the
 * past. The archive absorbed those editions as V-numbers, and the poster cards
 * now do the job they were always shaped for — announcing what is next.
 *
 * 🔴 NOTHING IS CURRENTLY SCHEDULED. The entries in `upcoming` are EXAMPLES,
 * so that the layout can be reviewed with realistic content. Every card renders
 * a visible "Example" badge and the section note says plainly that the calendar
 * is empty, because a visitor must never mistake a placeholder for a real date
 * and turn up to something that does not exist.
 *
 * When real events exist: replace `EventsPage.upcoming` in BOTH message files
 * and delete `exampleBadge` from the card below. When the calendar empties
 * again, set `upcoming` to `[]` and the designed empty state takes over.
 */
const POSTER: Record<string, string> = {
  "Coffee & Sketch": "/images/events/coffee-sketch.jpg",
  "قهوة وسكتش": "/images/events/coffee-sketch.jpg",
  "The Brand Factory": "/images/events/brand-factory.jpg",
  "مصنع العلامات": "/images/events/brand-factory.jpg",
  "Loqma w Fayda": "/images/events/loqma-fayda.jpg",
  "لقمة وفايدة": "/images/events/loqma-fayda.jpg",
};
const FALLBACK_POSTER = "/images/events/women-design.jpg";

type Upcoming = {t: string; v?: string; d: string; h: string; b: string};

export default function UpcomingEvents() {
  const t = useTranslations("EventsPage");
  const items = t.raw("upcoming") as Upcoming[];
  const hasItems = Array.isArray(items) && items.length > 0;

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      <div className="grid-overlay" aria-hidden="true" />

      <div className="relative z-[2] mx-auto flex w-full max-w-[1400px] flex-col gap-14">
        <Reveal className="flex flex-col gap-5 border-t border-black/15 pt-6">
          <p className="eyebrow text-12 text-muted">{t("upcomingLabel")}</p>
          <WordReveal
            as="h2"
            className="max-w-[14ch] font-sans text-32 font-bold leading-[1.05] text-black lg:text-50"
          >
            {t("upcomingTitle")}
          </WordReveal>
          <p className="max-w-[62ch] text-pretty text-15 leading-relaxed text-muted lg:text-16">
            {hasItems ? t("upcomingNote") : t("upcomingEmpty")}
          </p>
        </Reveal>

        {/* Three-up, unlike the two-up product grids elsewhere. An announcement
            list is short and odd-numbered by nature, and three cards in a
            two-column grid orphan the last one against a half-width hole.
            Three columns balance the common case and let 1-2 items sit
            start-aligned without reading as a gap. */}
        {hasItems ? (
          <ul className="grid grid-cols-1 gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-12 lg:gap-y-16">
            {items.map((e, i) => (
              <Reveal as="li" key={`${e.t}-${i}`} delay={(i % 3) * 90} className="reveal-card flex flex-col gap-6">
                <MediaFrame
                  src={POSTER[e.t] ?? FALLBACK_POSTER}
                  ratio="aspect-[900/844]"
                  eager={i === 0}
                >
                  {/* Visible on every card on purpose: these are placeholders,
                      and an unmarked placeholder date is a person showing up to
                      a locked door. */}
                  <span className="eyebrow absolute top-4 end-4 rounded-[4px] bg-orange px-2.5 py-1.5 text-11 text-white">
                    {t("exampleBadge")}
                  </span>
                </MediaFrame>

                <div className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-6 border-t border-black/10 pt-5">
                    <span className="eyebrow text-12 text-orange tabular-nums">{e.v}</span>
                    <span className="eyebrow text-12 text-muted tabular-nums">{e.d}</span>
                  </div>
                  <h3 className="text-balance font-sans text-24 font-medium leading-[1.1] text-black lg:text-32">
                    {e.t}
                  </h3>
                  <p className="text-15 leading-relaxed text-black/70">{e.h}</p>
                  <p className="max-w-[46ch] text-pretty text-15 leading-relaxed text-muted">{e.b}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        ) : (
          <Reveal className="flex flex-wrap items-center gap-4 border-t border-black/10 pt-8">
            <CtaButton href="/spaces/event-hall" variant="dark">
              {t("hostCta")}
            </CtaButton>
            <CtaButton href={SOCIALS.instagram} variant="light">
              {t("followCta")}
            </CtaButton>
          </Reveal>
        )}
      </div>
    </section>
  );
}
