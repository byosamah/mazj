import {useTranslations} from "next-intl";

import {Link} from "@/i18n/navigation";
import {SOCIALS} from "@/lib/links";
import type {EventView} from "@/app/[locale]/events/_lib/events";

import CtaButton from "../CtaButton";
import Reveal from "../Reveal";
import WordReveal from "../WordReveal";

/**
 * The archive: everything MAZJ has hosted, grouped by year, newest first.
 *
 * ⚠️ The 41 rows here were typed by hand into `EventsPage.archive` in both
 * message files until 2026-07-28. They now come from the database along with
 * everything else, which is what makes an event move itself down here when its
 * end time passes. There is no "mark as past" step and nothing to forget.
 *
 * Rows are grouped under a real `<h2>` per year, so date context is structural
 * rather than repeated on every row. The `v` edition marker is what the deleted
 * "recurring series" poster cards were really conveying, said in place instead
 * of duplicating the row in a second section above.
 */
export default function PastEvents({events}: {events: EventView[]}) {
  const t = useTranslations("EventsPage");

  // Grouped preserving the newest-first order the query already established.
  //
  // 🔴 Grouped on `year` (always Western digits) and LABELLED with `yearLabel`
  // (Arabic-Indic in Arabic). Grouping on the rendered string would work by
  // accident and break the day anything tried to compare two locales' keys.
  const years: Array<{key: string; label: string; items: EventView[]}> = [];
  for (const event of events) {
    const last = years[years.length - 1];
    if (last && last.key === event.year) last.items.push(event);
    else years.push({key: event.year, label: event.yearLabel, items: [event]});
  }

  return (
    <section className="relative w-full bg-beige px-6 py-24 lg:px-10 lg:py-32">
      {/* same hairline design grid the landing sections carry */}
      <div className="grid-overlay" aria-hidden="true" />
      <div className="relative z-[2] mx-auto flex w-full max-w-[1400px] flex-col gap-24">
        <div className="flex flex-col gap-10">
          <Reveal className="flex flex-col gap-3 border-t border-black/10 pt-6">
            <p className="eyebrow text-12 text-muted">{t("archiveLabel")}</p>
            <p className="max-w-[52ch] text-pretty text-14 leading-relaxed text-muted">
              {t("archiveNote")}
            </p>
          </Reveal>

          {years.map((group) => (
            <div key={group.key} className="flex flex-col gap-1">
              {/* The year was a decorative <p> at 25% black, so grouping existed
                  only visually: assistive tech got 41 equal-weight h3s with no
                  year context, and the route contained no h2 at all. */}
              <Reveal>
                <h2 className="font-sans text-32 font-bold leading-tight text-black/50 tabular-nums lg:text-50">
                  {group.label}
                </h2>
              </Reveal>
              {/* ONE observer for the whole year, CSS staggers the rows. */}
              <Reveal as="ul" className="reveal-list flex flex-col">
                {group.items.map((event) => (
                  <ArchiveRow key={event.slug} event={event} />
                ))}
              </Reveal>
            </div>
          ))}
        </div>

        {/* Closing plate on tan. This route never touched bg-beige-card at all,
            so the host pitch was a fifth white box after a long grey list. */}
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

/**
 * One archive row, linked only when there is a page behind it.
 *
 * 🔴 Most of the archive is NOT linked, and that is deliberate. The 41 imported
 * events carry a title, a date and a one-line subtitle; a page per row would be
 * 41 near-empty URLs pointed at from the strongest page on the route, which is
 * thin content at a scale Google acts on. An event with a write-up or a poster
 * earns one. See `hasDetailPage`.
 */
function ArchiveRow({event}: {event: EventView}) {
  const heading = (
    <h3 className="flex flex-wrap items-baseline gap-x-3 text-balance font-sans text-16 font-medium leading-snug text-black lg:text-20">
      {event.title}
      {/* The explicit {" "} matters: flex gap separates the badge visually but
          not in the DOM text, so without it the heading's accessible and
          crawled name concatenates ("قهوة وسكتشV9"). dir="ltr" isolates the
          Latin marker inside an RTL line. */}
      {event.edition && (
        <>
          {" "}
          <span
            dir="ltr"
            className="eyebrow shrink-0 text-11 text-orange tabular-nums"
          >
            {event.edition}
          </span>
        </>
      )}
    </h3>
  );

  return (
    <li className="flex flex-col gap-1 border-t border-black/10 py-5 sm:flex-row sm:items-baseline sm:gap-8">
      <time
        dateTime={event.when.machine}
        className="eyebrow text-12 text-muted tabular-nums sm:w-[140px] sm:shrink-0"
      >
        {event.when.date}
      </time>
      <div className="flex flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        {event.hasDetail ? (
          <Link
            href={`/events/${event.slug}`}
            className="underline-offset-4 hover:underline [transition:opacity_200ms,transform_120ms] active:scale-[0.96]"
          >
            {heading}
          </Link>
        ) : (
          heading
        )}
        <p className="text-pretty text-14 leading-relaxed text-muted sm:max-w-[42%] sm:text-end">
          {event.summary}
        </p>
      </div>
    </li>
  );
}
