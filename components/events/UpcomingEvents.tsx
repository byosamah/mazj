import {useTranslations} from "next-intl";

import {SOCIALS} from "@/lib/links";
import type {EventView} from "@/app/[locale]/events/_lib/events";

import CtaButton from "../CtaButton";
import Reveal from "../Reveal";
import WordReveal from "../WordReveal";
import EventCard from "./EventCard";

/**
 * Announced events.
 *
 * ⚠️ This used to read its content from `EventsPage.upcoming` in the message
 * files, where three FABRICATED entries sat behind a visible "Example" badge
 * because there was no other way to review the layout. It now takes real rows,
 * and the badge is gone along with the key that produced it.
 *
 * The designed empty state survives and matters more than before: an empty
 * calendar is now a genuine, self-reporting state rather than a placeholder,
 * and it is the single most likely thing a visitor sees between programmes.
 */
export default function UpcomingEvents({events}: {events: EventView[]}) {
  const t = useTranslations("EventsPage");
  const hasItems = events.length > 0;

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
            {events.map((event, i) => (
              <EventCard key={event.slug} event={event} index={i} />
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
