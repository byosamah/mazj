import {useTranslations} from "next-intl";
import Reveal from "./Reveal";
import WordReveal from "./WordReveal";
import CtaButton from "./CtaButton";
import {SOCIALS} from "@/lib/links";

/**
 * The /events archive: every workshop, talk, screening and gathering MAZJ has
 * hosted (2022-2025), pulled from @mazjorg.
 *
 * ONE layer now, not two. This used to open with four "recurring series" poster
 * cards above the dated list, but every one of those editions had already
 * happened AND already appeared in the list below — Coffee & Sketch ran nine
 * times and had nine archive rows. So the route's strongest visual was a
 * duplicate advertising the past.
 *
 * The editions instead carry a `v` marker (V1, V2, V3 ...) numbered
 * chronologically within their series, which is the information the poster
 * cards were really conveying. The poster treatment moved to UpcomingEvents,
 * where announcing something is the actual job.
 *
 * Rows are grouped under a real <h2> per year, so date context is structural
 * rather than repeated per row.
 */

type Entry = {y: string; d: string; t: string; h: string; s?: string; v?: string};

export default function PastEvents() {
  const t = useTranslations("EventsPage");
  const archive = t.raw("archive") as Entry[];

  // Group the flat archive by year, preserving the newest-first order.
  const years: Array<{year: string; items: Entry[]}> = [];
  for (const entry of archive) {
    const last = years[years.length - 1];
    if (last && last.year === entry.y) last.items.push(entry);
    else years.push({year: entry.y, items: [entry]});
  }

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      {/* same hairline design grid the landing sections carry */}
      <div className="grid-overlay" aria-hidden="true" />
      <div className="relative z-[2] mx-auto flex w-full max-w-[1400px] flex-col gap-24">
        {/* Full archive, grouped by year */}
        <div className="flex flex-col gap-10">
          <Reveal className="flex flex-col gap-3 border-t border-black/10 pt-6">
            <p className="eyebrow text-12 text-muted">{t("archiveLabel")}</p>
            <p className="max-w-[52ch] text-14 leading-relaxed text-muted text-pretty">{t("archiveNote")}</p>
          </Reveal>

          {years.map((group) => (
            <div key={group.year} className="flex flex-col gap-1">
              {/* The year was a decorative <p> at 25% black, so grouping existed
                  only visually: assistive tech got 41 equal-weight h3s with no
                  year context, and the route contained no h2 at all. */}
              <Reveal>
                <h2 className="font-sans text-32 font-bold leading-tight text-black/50 tabular-nums lg:text-50">
                  {group.year}
                </h2>
              </Reveal>
              {/* ONE observer for the whole year, CSS staggers the rows. */}
              <Reveal as="ul" className="reveal-list flex flex-col">
                {group.items.map((e, i) => (
                  <li
                    key={`${e.d}-${e.t}-${i}`}
                    className="flex flex-col gap-1 border-t border-black/10 py-5 sm:flex-row sm:items-baseline sm:gap-8"
                  >
                    <p className="eyebrow text-12 text-muted tabular-nums sm:w-[140px] sm:shrink-0">
                      {e.d}
                    </p>
                    <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                      <h3 className="flex flex-wrap items-baseline gap-x-3 font-sans text-16 font-medium leading-snug text-black text-balance lg:text-20">
                        {e.t}
                        {/* Edition marker for rows belonging to a recurring
                            series, numbered chronologically within it. This is
                            what the deleted "series" cards were really saying,
                            and it says it in place instead of duplicating the
                            row in a second section above.
                            dir="ltr" isolates the Latin "V" + numeral: inside an
                            RTL line the bidi algorithm can otherwise reorder it
                            against neighbouring punctuation.
                            The explicit {" "} matters: flex gap separates the
                            badge visually but not in the DOM text, so without it
                            the heading's accessible/crawled name concatenates
                            ("قهوة وسكتشV9"). */}
                        {e.v && (
                          <>
                            {" "}
                            <span
                              dir="ltr"
                              className="eyebrow shrink-0 text-11 text-orange tabular-nums"
                            >
                              {e.v}
                            </span>
                          </>
                        )}
                      </h3>
                      <p className="text-14 leading-relaxed text-muted text-pretty sm:max-w-[42%] sm:text-end">
                        {e.h}
                      </p>
                    </div>
                  </li>
                ))}
              </Reveal>
            </div>
          ))}
        </div>

        {/* Closing plate on tan. This route never touched bg-beige-card at all,
            so the host pitch was a fifth white box after four white series
            cards and a long grey list. */}
        <Reveal className="flex flex-col items-start gap-5 rounded-[16px] bg-beige-card p-10 lg:p-16">
          <WordReveal
            as="h2"
            className="max-w-[16ch] font-sans text-32 font-bold leading-[1.05] text-brown lg:text-45"
          >
            {t("hostTitle")}
          </WordReveal>
          <p className="max-w-[52ch] text-pretty text-15 leading-relaxed text-brown/85 lg:text-16">
            {t("hostBody")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <CtaButton href="/spaces/event-hall" variant="onTan">
              {t("hostCta")}
            </CtaButton>
            <CtaButton href={SOCIALS.instagram} variant="light">
              {t("followCta")}
            </CtaButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
