/**
 * The events programme, as rules rather than rows.
 *
 * Pure and framework-free: no database, no clock of its own, no `next-intl`.
 * Everything here takes what it needs as an argument, which is what makes the
 * phase transitions and the seat arithmetic testable without a fixture.
 *
 * Design record: `docs/superpowers/specs/2026-07-28-events-programme-design.md`
 */

import { VENUE_TIME_ZONE } from "./riyadh-time";

/**
 * How much of an event's start time was actually recorded.
 *
 * 🔴 Not a formatting preference. A timestamptz always holds a clock time; that
 * does not mean a human ever wrote one down. Four of the 41 imported historical
 * events record only a month and none records a time, so rendering their stored
 * hour would be publishing a fact nobody has.
 */
export type DatePrecision = "exact" | "day" | "month";

/** Where an event sits relative to now. Derived, never stored. */
export type EventPhase = "upcoming" | "live" | "past";

/** The minimum an event must carry for the rules below to apply. */
export type EventTiming = {
  startsAt: string;
  endsAt: string;
  datePrecision: DatePrecision;
};

/**
 * 🔴 An event is PAST once it has ENDED, not once it has started.
 *
 * The distinction is the whole "it moves itself down the page" feature. Keying
 * on `startsAt` would drop a three-hour workshop into the archive at the moment
 * its doors opened, so anybody checking the address while walking to it would
 * find it filed under history.
 */
export function eventPhase(event: EventTiming, now: Date = new Date()): EventPhase {
  const t = now.getTime();
  if (t >= new Date(event.endsAt).getTime()) return "past";
  if (t >= new Date(event.startsAt).getTime()) return "live";
  return "upcoming";
}

/**
 * Registration closes when the event STARTS.
 *
 * One rule, no stored cutoff, nothing to misconfigure. A different cutoff, if
 * it is ever wanted, is a column and a migration; guessing at one now would be
 * a field on the admin form that nobody sets correctly.
 */
export function registrationIsOpen(
  event: EventTiming,
  now: Date = new Date()
): boolean {
  return eventPhase(event, now) === "upcoming";
}

// ---------------------------------------------------------------------------
// What an event must carry before it may go live
// ---------------------------------------------------------------------------

/** The four strings `events_published_is_bilingual` requires. */
export type PublishableCopy = {
  titleEn: string | null;
  titleAr: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
};

/** Which one is missing, named as the form's own control. */
export type MissingForPublish =
  | "titleEn"
  | "titleAr"
  | "summaryEn"
  | "summaryAr";

/**
 * The first thing standing between this event and the public site, or `null`.
 *
 * 🔴 ONE definition, read by three callers that would otherwise each grow their
 * own: the save action, the status control on the events list, and the same
 * control on the event's own page. Two of those write the same row from
 * different screens, and a rule restated per screen is a rule that eventually
 * lets one screen publish what the other refuses.
 *
 * ⚠️ It is deliberately STRICTER than the check constraint it mirrors. Postgres
 * asks only that the four columns are NOT NULL, so a row holding `''` satisfies
 * it and would publish an event with a blank heading on both language pages.
 * The trim closes that, and being stricter is the safe direction: the worst it
 * can do is refuse to publish something nobody would want published.
 *
 * The ORDER is the form's reading order, so the field it names is the first one
 * an operator's eye reaches when they open the event to fix it.
 */
export function missingToPublish(
  copy: PublishableCopy
): MissingForPublish | null {
  if (!copy.titleEn?.trim()) return "titleEn";
  if (!copy.titleAr?.trim()) return "titleAr";
  if (!copy.summaryEn?.trim()) return "summaryEn";
  if (!copy.summaryAr?.trim()) return "summaryAr";
  return null;
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export type SeatState =
  | { kind: "unlimited" }
  | { kind: "available"; left: number; showCount: false }
  | { kind: "running_low"; left: number; showCount: true }
  | { kind: "full"; left: 0 };

/**
 * When "N seats left" starts appearing.
 *
 * Scaled to the room rather than fixed, because urgency is a ratio. Eight left
 * of thirty is the last quarter of Al-Ma'arij and worth saying; eight left of
 * ten is most of the room still empty, and announcing it reads as desperation.
 * Eight left of a hundred is genuinely nearly gone, so the fixed ceiling holds
 * at the top end.
 */
export function lowSeatThreshold(capacity: number): number {
  return Math.min(8, Math.ceil(capacity / 3));
}

export function seatState(capacity: number | null, taken: number): SeatState {
  if (capacity === null) return { kind: "unlimited" };

  const left = Math.max(0, capacity - taken);
  if (left === 0) return { kind: "full", left: 0 };
  if (left <= lowSeatThreshold(capacity)) {
    return { kind: "running_low", left, showCount: true };
  }
  return { kind: "available", left, showCount: false };
}

// ---------------------------------------------------------------------------
// Dates, as a reader in Al Khobar sees them
// ---------------------------------------------------------------------------

/**
 * 🔴 The calendar is PINNED, and the reason is a crash rather than a nicety.
 *
 * `ar-SA` carries region Saudi Arabia, and ICU's default calendar for that
 * region is `islamic-umalqura`. Whether a given engine applies it varies by ICU
 * version: this repo's Node renders `ar-SA` as Gregorian while browsers have
 * historically rendered it as Hijri. A server and a client disagreeing about
 * what month it is inside the same `<time>` element is a React hydration
 * mismatch, and the visible symptom is not a wrong date but a broken page.
 *
 * `-u-ca-gregory` states the calendar so no engine gets to choose. `ar-SA` is
 * kept over bare `ar` because it also selects Arabic-Indic numerals (`٢٠٢٥`),
 * which is what every number in `messages/ar.json` already uses.
 *
 * Belt and braces: these formatters are only ever called from Server
 * Components, and the finished STRING is what crosses to the browser.
 */
function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB";
}

/** A formatted event date, and its time when one was actually recorded. */
export type FormattedWhen = {
  /** Always present. "12 October 2025", "17-18 February 2023", "March 2023". */
  date: string;
  /** Present only at `exact` precision. "7:00 pm". */
  time: string | null;
  /** Present only at `exact` precision. "Sunday". */
  weekday: string | null;
  /** The `datetime` attribute for `<time>`. Always the real instant. */
  machine: string;
};

export function formatEventWhen(
  event: EventTiming,
  locale: string
): FormattedWhen {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  const intl = intlLocale(locale);

  if (event.datePrecision === "month") {
    return {
      date: new Intl.DateTimeFormat(intl, {
        month: "long",
        year: "numeric",
        timeZone: VENUE_TIME_ZONE,
      }).format(start),
      time: null,
      weekday: null,
      machine: event.startsAt.slice(0, 7),
    };
  }

  const dayFormat = new Intl.DateTimeFormat(intl, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: VENUE_TIME_ZONE,
  });

  const a = splitParts(dayFormat, start);
  const b = splitParts(dayFormat, end);

  // A workshop that ran across two days is one event, not two, and the source
  // copy said so ("17-18 February"). Compacted only when the month and year
  // agree; anything wider is rendered as two full dates, because
  // "30 November-2 December" invites a misread of the month.
  const date =
    a.day !== b.day
      ? a.month === b.month && a.year === b.year
        ? `${a.day}-${b.day} ${a.month} ${a.year}`
        : `${dayFormat.format(start)} - ${dayFormat.format(end)}`
      : dayFormat.format(start);

  if (event.datePrecision === "day") {
    return { date, time: null, weekday: null, machine: event.startsAt.slice(0, 10) };
  }

  return {
    date,
    time: new Intl.DateTimeFormat(intl, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: VENUE_TIME_ZONE,
      ...(locale === "ar" ? {} : { hour12: true }),
    }).format(start),
    weekday: new Intl.DateTimeFormat(intl, {
      weekday: "long",
      timeZone: VENUE_TIME_ZONE,
    }).format(start),
    machine: event.startsAt,
  };
}

function splitParts(
  format: Intl.DateTimeFormat,
  instant: Date
): { day: string; month: string; year: string } {
  const parts = format.formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return { day: get("day"), month: get("month"), year: get("year") };
}

/**
 * The year an event belongs to, for the archive's `<h2>` grouping.
 *
 * Read in Riyadh, not UTC. A 21:00-23:00 New Year's Eve event is stored at
 * 18:00Z on 31 December and would group under the FOLLOWING year if the year
 * were taken off the UTC instant.
 *
 * 🔴 ALWAYS Western digits, because this is a grouping KEY, not a label.
 * `formatEventYear` renders it. Keeping the two apart matters: the Arabic
 * archive shows `٢٠٢٣`, and grouping on the rendered string would give the two
 * locales different bucket keys for the same year, which is fine until
 * something tries to compare or sort them.
 */
export function eventYear(event: EventTiming): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    timeZone: VENUE_TIME_ZONE,
  }).format(new Date(event.startsAt));
}

/**
 * The year as the reader sees it: `2023` in English, `٢٠٢٣` in Arabic.
 *
 * ⚠️ Arabic-Indic here is correct and is NOT an inconsistency with the seat
 * counts beside it, which render `4`. `TONE.md` §4 draws the line at register
 * rather than at language: Western digits in product and marketing copy,
 * Arabic-Indic in dated archives. The 41 imported events already shipped
 * `٢٠٢٥` for exactly this reason, and a seat count is a live figure on a card,
 * not an archive entry.
 */
export function formatEventYear(event: EventTiming, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    timeZone: VENUE_TIME_ZONE,
  }).format(new Date(event.startsAt));
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/** Longest slug the `events.slug` check constraint accepts. */
export const MAX_SLUG_LENGTH = 80;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A URL segment from a title.
 *
 * ASCII only, and deliberately so: the slug is the same in both locales, it is
 * what gets pasted into an Instagram bio, and a percent-encoded Arabic title is
 * 200 unreadable characters that no one can tell has been truncated. The
 * English title is the source; an Arabic-only draft gets a slug from its
 * edition or its date instead, decided by the caller.
 */
export function slugifyTitle(title: string, edition?: string | null): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const withEdition = edition
    ? `${base}-${edition.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    : base;

  return withEdition.slice(0, MAX_SLUG_LENGTH).replace(/^-+|-+$/g, "");
}

/** Does this string satisfy the database's own `slug` constraint? */
export function isValidSlug(value: string): boolean {
  return (
    value.length >= 2 && value.length <= MAX_SLUG_LENGTH && SLUG_SHAPE.test(value)
  );
}
