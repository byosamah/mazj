import "server-only";

import type { AppError } from "../core/errors";
import { log } from "../core/logger";
import { map, ok, type Result } from "../core/result";
import { isWithin, riyadhDate, riyadhDayRangeUtc } from "../domain/riyadh-time";
import { rekazRequest } from "./client";
import type { RekazPage, RekazReservation, RekazSlot } from "./types";

/** Rekaz caps every collection at 100 records per request. */
export const REKAZ_PAGE_MAX = 100;

export type ListReservationsOptions = {
  /** ISO 8601. Inclusive lower bound on reservation start. */
  dateMin?: string;
  /** ISO 8601. Inclusive upper bound. */
  dateMax?: string;
  statuses?: string[];
  customerId?: string;
  /** Rekaz's own "future only" filter. */
  upcoming?: boolean;
  skipCount?: number;
  maxResultCount?: number;
};

/**
 * One page of reservations.
 *
 * 🔴 **Every filter this endpoint documents is silently IGNORED.** Measured
 * against the live tenant on 2026-07-27: `dateMin`, `dateMax`, `upcoming` and
 * `statuses` all return the identical first 100 rows of 555, spanning February
 * to October. Not an error, not a warning, just the unfiltered list wearing the
 * shape of a filtered one.
 *
 * The options are still accepted and still sent, because they cost nothing and
 * the day Rekaz implements them this starts working. **But no caller may rely
 * on them.** Use `fetchAllReservations` and filter in code.
 */
export function listReservations(
  options: ListReservationsOptions = {}
): Promise<Result<RekazPage<RekazReservation>, AppError>> {
  const { statuses, ...rest } = options;
  return rekazRequest<RekazPage<RekazReservation>>({
    path: "/reservations",
    query: {
      maxResultCount: REKAZ_PAGE_MAX,
      ...rest,
      ...(statuses?.length ? { statuses: statuses.join(",") } : {}),
    },
  });
}

/**
 * Hard ceiling on pages fetched, so a growing tenant can never turn one
 * dashboard render into an unbounded crawl of Rekaz.
 */
const MAX_PAGES = 4;

/**
 * How far back in CREATION time to page before stopping.
 *
 * The stop condition has to be expressed in creation time because that is the
 * only thing the ordering guarantees. The reasoning: a reservation for a future
 * date was necessarily created before that date, so paging back six months of
 * creations catches every upcoming booking with a lead time under six months.
 * For a coworking space that is every real booking; a year-ahead events-hall
 * reservation would be missed, which is why `MAX_PAGES` is a backstop rather
 * than the primary limit and why the truncation is logged.
 */
const CREATION_LOOKBACK_DAYS = 180;

/**
 * Every reservation Rekaz will give us, across pages.
 *
 * 🔴 This exists because filtering server-side is impossible (see above) AND
 * because the sort order is not what you would guess. Rows come back ordered by
 * **`creationTime` descending, NOT `startAt`**. Verified over all 555 rows:
 * `creationTime` is monotonically descending, `startAt` is not.
 *
 * The consequence is the trap. "Recent pages hold the upcoming bookings" is
 * true only while people book close to the date. A booking made three months
 * ago for next Tuesday sits on page 4, so any code that reads page 1 and calls
 * it "upcoming" silently loses exactly the long-lead bookings, which for an
 * events hall are the large ones. Reading one page looks correct for months and
 * then quietly drops the most valuable reservation of the year.
 *
 * 555 rows is six requests. Page 1 is fetched first for `totalCount`, then the
 * rest go out together, so the wall clock is two round trips rather than six.
 */
export async function fetchAllReservations(
  now: Date = new Date()
): Promise<Result<RekazReservation[], AppError>> {
  const cutoff = now.getTime() - CREATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const all: RekazReservation[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await listReservations({ skipCount: page * REKAZ_PAGE_MAX });

    // A failed page is not a reason to show nothing. Page 1 holds the most
    // recently created rows, which is where every imminent booking lives, so a
    // partial list beats an error the reader cannot act on.
    if (!result.ok) {
      if (page === 0) return result;
      log.warn("rekaz.reservations.partial", {
        page,
        collected: all.length,
        reason: result.error.code,
      });
      break;
    }

    const { items, totalCount } = result.value;
    all.push(...items);

    if (all.length >= totalCount || items.length < REKAZ_PAGE_MAX) break;

    // Stop as soon as this page's oldest creation predates the lookback. Every
    // later page is older still, so nothing relevant can be down there.
    const oldest = items[items.length - 1]?.creationTime;
    if (oldest && Date.parse(oldest) < cutoff) break;

    if (page === MAX_PAGES - 1) {
      log.warn("rekaz.reservations.truncated", {
        totalCount,
        fetched: all.length,
        reason: `hit the ${MAX_PAGES}-page cap before reaching the ${CREATION_LOOKBACK_DAYS}-day lookback`,
      });
    }
  }

  return ok(all);
}

/**
 * Every reservation on one Riyadh calendar day.
 *
 * 🔴 The day boundary is computed in the venue's zone, not UTC. A UTC "today"
 * begins at 03:00 Riyadh, so between midnight and 3am a UTC-derived range shows
 * yesterday's bookings labelled as today's, and drops the events hall's
 * 21:00-24:00 slots onto the wrong date entirely.
 */
export function reservationsOnDay(
  all: RekazReservation[],
  day: string
): RekazReservation[] {
  const { start, end } = riyadhDayRangeUtc(day);
  return all
    .filter((r) => isWithin(r.startAt, start, end))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export type SlotQuery = {
  priceId: string;
  /** `YYYY-MM-DD`, as a Riyadh calendar day. */
  startDate: string;
  endDate: string;
  minQuantity?: number;
};

/**
 * Raw availability windows from Rekaz, unfiltered.
 *
 * 🔴 `MinQuantity` is REQUIRED despite being documented as optional. Omitting it
 * returns a 400 whose message is in Arabic. It defaults to 1 here so no caller
 * has to know that.
 */
export function getSlotsRaw(
  query: SlotQuery
): Promise<Result<RekazSlot[], AppError>> {
  return rekazRequest<RekazSlot[]>({
    path: "/reservations/slots",
    query: {
      PriceId: query.priceId,
      StartDate: query.startDate,
      EndDate: query.endDate,
      MinQuantity: query.minQuantity ?? 1,
    },
  });
}

/**
 * Availability windows that are genuinely offerable to a visitor.
 *
 * 🔴 Rekaz PADS the requested range rather than honouring it. Asking for
 * 2026-07-28 to 2026-07-29 returned windows on the 27th, 28th AND 29th; asking
 * for a single Friday returned the preceding Thursday. Handing that response
 * straight to a date picker offers people slots on days they did not ask about,
 * and on a Friday offers them Thursday while claiming it is Friday.
 *
 * So the caller's requested range is re-imposed here, in Riyadh days, and past
 * windows are dropped. Both filters are needed: `isOutDated` catches today's
 * mornings, the range filter catches the padding.
 */
export async function getSlots(
  query: SlotQuery
): Promise<Result<RekazSlot[], AppError>> {
  const raw = await getSlotsRaw(query);
  return map(raw, (slots) => filterSlotsToRange(slots, query.startDate, query.endDate));
}

/**
 * Pure counterpart of `getSlots`, so the padding and staleness rules can be
 * tested without a network.
 */
export function filterSlotsToRange(
  slots: RekazSlot[],
  startDate: string,
  endDate: string
): RekazSlot[] {
  return slots.filter((slot) => {
    if (slot.isOutDated) return false;
    if (!slot.isAvailable) return false;
    const day = riyadhDate(slot.from);
    return day >= startDate && day <= endDate;
  });
}

/**
 * Groups windows by the Riyadh day they start on.
 *
 * A `Map` rather than an object because insertion order is meaningful (the API
 * returns chronologically) and an object with `YYYY-MM-DD` keys would be
 * reordered by the integer-key rule in some engines.
 */
export function groupSlotsByDay(slots: RekazSlot[]): Map<string, RekazSlot[]> {
  const byDay = new Map<string, RekazSlot[]>();
  for (const slot of slots) {
    const day = riyadhDate(slot.from);
    const existing = byDay.get(day);
    if (existing) existing.push(slot);
    else byDay.set(day, [slot]);
  }
  return byDay;
}
