import "server-only";

import type { AppError } from "../core/errors";
import { log } from "../core/logger";
import { map, ok, type Result } from "../core/result";
import { isWithin, riyadhDate, riyadhDayRangeUtc } from "../domain/riyadh-time";
import { rekazRequest } from "./client";
import type { RekazPage, RekazReservation, RekazSlot } from "./types";

/** Rekaz caps every collection at 100 records per request. */
export const REKAZ_PAGE_MAX = 100;

/**
 * 🔴 **`customerMobile` is the ONE filter this endpoint honours.**
 *
 * Measured against the live tenant on 2026-07-28. The unfiltered list reports
 * `totalCount` 562; `customerMobile=<a real number>` returns 7, every one of
 * them carrying that number, spanning January 2025 to July 2026. So it is a
 * genuine query over the whole table rather than a filter applied to page one,
 * and a number nobody has ever used returns 0. The leading plus is tolerated:
 * `+966...` and `966...` behave identically.
 *
 * ⚠️ It is a SUBSTRING match, not equality. A four-digit fragment matched too,
 * so a caller must still compare each returned row's own mobile against its own
 * before treating that row as its own. `server/rekaz/reconcile.ts` does exactly
 * that, and its test pins the near-miss.
 *
 * ⚠️ And it is an OPTIMISATION, never sole evidence. Rekaz publishes no
 * versioning and no changelog, so an empty filtered response cannot be told
 * apart from the filter having quietly changed. `reconcileReservation` treats
 * it accordingly.
 */
export type ListReservationsOptions = {
  /** Substring match over the customer's mobile. The one working filter. */
  customerMobile?: string;
  skipCount?: number;
  maxResultCount?: number;
  /**
   * 🔴 Filters Rekaz ACCEPTS AND SILENTLY IGNORES. Passing any of these changes
   * nothing whatsoever about the response.
   *
   * Measured 2026-07-27 and re-measured 2026-07-28: `dateMin`, `dateMax`,
   * `upcoming`, `statuses` and `customerId` each return the identical full 562
   * rows, including for values that match nothing at all. (`keyword` and
   * `branchId`, which this client does not expose, were measured the same way
   * and behave the same.) Not an error, not a warning, just the unfiltered list
   * wearing the shape of a filtered one.
   *
   * They are nested behind this name rather than sitting beside `customerMobile`
   * for one reason: as ordinary optional parameters they READ as working
   * filters, and a future session skimming the signature would believe them.
   * They are still sent, because they cost nothing and the day Rekaz implements
   * them this starts working. `test/rekaz.integration.test.ts` watches the live
   * API for exactly that day.
   */
  ignoredByRekaz?: IgnoredReservationFilters;
};

/**
 * Parameters that go on the wire and do nothing.
 *
 * @see ListReservationsOptions.ignoredByRekaz. No caller may rely on any of
 * these. If one is ever measured to work, move it up into
 * `ListReservationsOptions` in the same edit that records the measurement.
 */
export type IgnoredReservationFilters = {
  /** ISO 8601. Inclusive lower bound on reservation start. */
  dateMin?: string;
  /** ISO 8601. Inclusive upper bound. */
  dateMax?: string;
  statuses?: string[];
  customerId?: string;
  /** Rekaz's own "future only" filter. */
  upcoming?: boolean;
};

/**
 * One page of reservations.
 *
 * Use `customerMobile` when you already know whose booking you are looking for,
 * and `fetchAllReservations` for anything that needs a date range, because a
 * date range cannot be asked for at all.
 */
export function listReservations(
  options: ListReservationsOptions = {}
): Promise<Result<RekazPage<RekazReservation>, AppError>> {
  const { ignoredByRekaz = {}, ...rest } = options;
  const { statuses, ...alsoIgnored } = ignoredByRekaz;
  return rekazRequest<RekazPage<RekazReservation>>({
    path: "/reservations",
    query: {
      maxResultCount: REKAZ_PAGE_MAX,
      ...rest,
      ...alsoIgnored,
      ...(statuses?.length ? { statuses: statuses.join(",") } : {}),
    },
  });
}

/**
 * Sanity ceiling on pages fetched, so a growing tenant can never turn one
 * dashboard render into an unbounded crawl of Rekaz.
 *
 * 🔴 An order of magnitude ABOVE today's volume, never below it. This was 4,
 * i.e. 400 rows, against a tenant already holding 562: the function dropped 162
 * real reservations on every single call, and the occupancy board rendered the
 * gap as free rooms. A ceiling below the live row count is not a safety limit,
 * it is silent data loss wearing one. 20 pages is 2,000 rows.
 *
 * ⚠️ It is a real cost, not a free number. Each page is its own sequential
 * request with the client's 10s ceiling on it, so at the ceiling this function
 * alone can hold a serverless invocation for a long time. That is why it exists
 * at all, why reaching it is REPORTED rather than logged, and why the honest
 * answer to a tenant that genuinely outgrows it is a stored read model, not a
 * bigger number here.
 */
const MAX_PAGES = 20;

/**
 * Everything Rekaz will give us, plus whether that was actually everything.
 *
 * 🔴 `truncated` exists because the previous return type reported a short list
 * and a complete one identically. A `log.warn` is not a report: nobody staring
 * at an occupancy board is also reading the server log, which is precisely how
 * a third of the table went missing for as long as it did. A caller that reads
 * `items` and ignores `truncated` has kept the bug and added a field.
 */
export type AllReservations = {
  items: RekazReservation[];
  /** Rekaz's own count of the whole table, taken from page one. */
  totalCount: number;
  /** True when `items` fell short of `totalCount`, for any reason. */
  truncated: boolean;
};

/**
 * Every reservation Rekaz will give us, across pages.
 *
 * 🔴 This exists because a date range cannot be asked for server-side (see
 * `ListReservationsOptions`) AND because the sort order is not what you would
 * guess. Rows come back ordered by **`creationTime` descending, NOT `startAt`**.
 * Verified over the whole table: `creationTime` is monotonically descending,
 * `startAt` is not.
 *
 * The consequence is the trap. "Recent pages hold the upcoming bookings" is
 * true only while people book close to the date. A booking made three months
 * ago for next Tuesday sits several pages down, so any code that reads page 1
 * and calls it "upcoming" silently loses exactly the long-lead bookings, which
 * for an events hall are the large ones.
 *
 * 🔴 **There is no creation-time cutoff any more, and there must not be one.**
 * This used to stop paging once a page's oldest `creationTime` passed 180 days,
 * on the reasoning that a future booking was necessarily created before it
 * happens. That reasoning cannot bound the question every consumer actually
 * asks, which is about `startAt`: an events hall booked in March for a wedding
 * in September is BOTH old enough to be cut and still in the future. The
 * dashboard then shows the hall as free while the customer is standing in it.
 * A creation-time cutoff can never answer a start-time question. Worse, when
 * that cut fired it skipped the truncation warning entirely, so the worst case
 * logged nothing at all.
 *
 * **Paged SEQUENTIALLY, and it must stay that way.** This docblock used to
 * claim page one was fetched for `totalCount` and "the rest go out together, so
 * the wall clock is two round trips". That was false on both halves: the loop
 * was strictly sequential and capped at 4 pages. It is worth saying plainly,
 * because somebody tidying the code to match that sentence would introduce
 * exactly the parallelism that flattens Rekaz. Six concurrent calls made an
 * endpoint hang past two minutes that answers in 1.5s on its own, and that same
 * API serves mazj.sa's live checkout.
 */
export async function fetchAllReservations(): Promise<
  Result<AllReservations, AppError>
> {
  const first = await listReservations({ skipCount: 0 });
  if (!first.ok) return first;

  const { totalCount } = first.value;
  const items = [...first.value.items];

  // How many pages the tenant actually holds, from Rekaz's own count, capped.
  // Deriving it here is the fix: the page count now follows the data instead of
  // the data being trimmed to fit the page count.
  const pages = Math.min(Math.ceil(totalCount / REKAZ_PAGE_MAX), MAX_PAGES);

  for (let page = 1; page < pages; page++) {
    if (items.length >= totalCount) break;

    const next = await listReservations({ skipCount: page * REKAZ_PAGE_MAX });

    // A failed page is not a reason to show nothing. Page 1 holds the most
    // recently created rows, which is where every imminent booking lives, so a
    // partial list beats an error the reader cannot act on. But it comes back
    // FLAGGED, not quietly.
    if (!next.ok) {
      log.warn("rekaz.reservations.partial", {
        page,
        collected: items.length,
        totalCount,
        reason: next.error.code,
      });
      break;
    }

    if (next.value.items.length === 0) break;
    items.push(...next.value.items);
  }

  const truncated = items.length < totalCount;
  if (truncated) {
    // Logged AND returned, deliberately. The log is for whoever is on call; the
    // flag is for the person actually looking at the screen.
    log.warn("rekaz.reservations.truncated", {
      collected: items.length,
      totalCount,
      ceiling: MAX_PAGES,
    });
  }

  return ok({ items, totalCount, truncated });
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
