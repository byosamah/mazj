import "server-only";

import type { AppError } from "../core/errors";
import { map, type Result } from "../core/result";
import { riyadhDate, riyadhDayRangeUtc } from "../domain/riyadh-time";
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

export function listReservations(
  options: ListReservationsOptions = {}
): Promise<Result<RekazPage<RekazReservation>, AppError>> {
  const { statuses, ...rest } = options;
  return rekazRequest<RekazPage<RekazReservation>>({
    path: "/reservations",
    query: {
      maxResultCount: REKAZ_PAGE_MAX,
      ...rest,
      // Rekaz expects a repeated `statuses` parameter. A comma-joined single
      // value is accepted for the one-status case we use; anything richer needs
      // real repeated params and a change here.
      ...(statuses?.length ? { statuses: statuses.join(",") } : {}),
    },
  });
}

/**
 * Every reservation on one Riyadh calendar day.
 *
 * 🔴 The day boundary is computed in the venue's zone, not UTC. A UTC "today"
 * begins at 03:00 Riyadh, so between midnight and 3am a UTC-derived range shows
 * yesterday's bookings labelled as today's, and drops the events hall's
 * 21:00-24:00 slots onto the wrong date entirely.
 */
export function listReservationsOnDay(
  day: string
): Promise<Result<RekazPage<RekazReservation>, AppError>> {
  const { start, end } = riyadhDayRangeUtc(day);
  return listReservations({
    dateMin: start.toISOString(),
    dateMax: end.toISOString(),
  });
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
