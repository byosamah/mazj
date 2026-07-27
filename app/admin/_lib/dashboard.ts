import "server-only";

import { unstable_cache } from "next/cache";

import { bookableRooms, listProducts } from "@/server/rekaz/catalog";
import {
  fetchAllReservations,
  reservationsOnDay,
} from "@/server/rekaz/reservations";
import {
  expiringWithin,
  fetchAllSubscriptions,
  isActive,
} from "@/server/rekaz/subscriptions";
import type { RekazReservation } from "@/server/rekaz/types";
import {
  riyadhTime,
  riyadhToday,
  toRiyadhParts,
} from "@/server/domain/riyadh-time";

/**
 * Builds the operations view model.
 *
 * Every value the dashboard renders is computed here and handed over as plain
 * data. The page does no fetching, no date arithmetic and no filtering, which
 * is what lets this file be reasoned about (and later tested) without a
 * renderer.
 *
 * 🔴 EVERY TILE FAILS INDEPENDENTLY. Rekaz is a single upstream with no
 * documented rate limits and no status page. If subscriptions time out, the
 * occupancy board must still say who is in the meeting room, because that is
 * the number someone walked to their desk to check. A dashboard that blanks
 * entirely when one of four calls fails is a dashboard that gets replaced by a
 * phone call.
 *
 * 🔴 AND A FAILED TILE NEVER RENDERS ZERO. "0 bookings today" and "we could not
 * reach Rekaz" look identical in a number and mean opposite things. One of them
 * means go home.
 */

/** A tile's data, or the reason there is none. Never silently empty. */
export type Tile<T> = { ok: true; data: T } | { ok: false; message: string };

export type ReservationView = {
  id: string;
  /** `HH:mm` in Riyadh. */
  startTime: string;
  endTime: string;
  /** `YYYY-MM-DD` in Riyadh. */
  day: string;
  weekday: string;
  productName: string;
  priceName: string;
  customerName: string | null;
  status: string;
  reservationNumber: number;
  paymentStatus: string | null;
};

export type RoomOccupancy = {
  id: string;
  name: string;
  occupiedBy: ReservationView | null;
};

export type SubscriptionView = {
  id: string;
  code: string;
  itemName: string;
  /** `YYYY-MM-DD` in Riyadh. */
  endsOn: string;
  daysRemaining: number;
};

export type DashboardData = {
  /** ISO instant the data was assembled. Rendered as "last updated". */
  generatedAt: string;
  /** Riyadh calendar day the "today" tile describes. */
  today: string;
  todayReservations: Tile<ReservationView[]>;
  occupancy: Tile<RoomOccupancy[]>;
  upcoming: Tile<ReservationView[]>;
  subscriptions: Tile<{
    activeCount: number;
    totalCount: number;
    expiringSoon: SubscriptionView[];
  }>;
};

const UPCOMING_DAYS = 7;
const EXPIRY_HORIZON_DAYS = 30;

/** Cache key and invalidation tag for the Refresh button. */
export const DASHBOARD_CACHE_TAG = "admin-dashboard";

/**
 * Seconds the operations view may be reused before Rekaz is asked again.
 *
 * ⚠️ **This reverses the design's original "no caching at all".** That decision
 * argued a stale occupancy board is worse than none, which is true in the
 * abstract and was wrong here for two measured reasons.
 *
 * First, Rekaz is slow and wildly inconsistent: `/products` was observed
 * between 1.2s and 10.8s, `/reservations` at ~6s, and the assembled page took
 * 2.8s to 7.8s. A dashboard that takes eight seconds to answer "is the meeting
 * room free" is not a more truthful dashboard, it is one nobody opens.
 *
 * Second, and more important, that API also serves mazj.sa, where real
 * customers are checking out. Re-querying the whole reservation table on every
 * page view, refresh and stray tab is load pointed at the revenue path.
 *
 * The staleness objection is answered by honesty rather than by freshness: the
 * page renders the exact instant the data was assembled, and Refresh busts this
 * cache outright. Sixty seconds of drift on a room-occupancy board is
 * operationally invisible; eight seconds of blank screen is not.
 */
const CACHE_SECONDS = 60;

/**
 * The cached entry point. Use this from pages.
 *
 * `unstable_cache` is safe here only because `loadDashboard` reads no cookies
 * and no headers. If a future tile needs per-user data, it must NOT go through
 * this function: one admin's view would be served to the next.
 */
export const loadDashboardCached = unstable_cache(
  async (): Promise<DashboardData> => loadDashboard(),
  ["admin-dashboard-v1"],
  { revalidate: CACHE_SECONDS, tags: [DASHBOARD_CACHE_TAG] }
);

export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  const today = riyadhToday(now);

  // Fired together rather than in sequence: serial round trips to Riyadh from
  // Frankfurt are most of a second of staring at a spinner for no reason.
  //
  // 🔴 ONE reservations call feeds both the "today" and "upcoming" tiles, and
  // it fetches EVERYTHING. Rekaz ignores `dateMin`, `dateMax`, `upcoming` and
  // `statuses` entirely, and orders by `creationTime` rather than `startAt`, so
  // there is no server-side way to ask for a date range and no page that
  // reliably holds the upcoming bookings. See `fetchAllReservations`.
  const [products, allReservations, subscriptionPage] = await Promise.all([
    listProducts(),
    fetchAllReservations(),
    fetchAllSubscriptions(),
  ]);

  const todayReservations: Tile<ReservationView[]> = allReservations.ok
    ? {
        ok: true,
        data: reservationsOnDay(allReservations.value, today).map(
          toReservationView
        ),
      }
    : { ok: false, message: failureMessage(allReservations.error.code) };

  return {
    generatedAt: now.toISOString(),
    today,
    todayReservations,

    occupancy: buildOccupancy(
      products,
      allReservations.ok ? reservationsOnDay(allReservations.value, today) : null,
      now
    ),

    upcoming: allReservations.ok
      ? {
          ok: true,
          data: allReservations.value
            .filter((r) => withinNextDays(r, now, UPCOMING_DAYS))
            .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
            .map(toReservationView),
        }
      : { ok: false, message: failureMessage(allReservations.error.code) },

    subscriptions: subscriptionPage.ok
      ? {
          ok: true,
          data: {
            activeCount: subscriptionPage.value.items.filter(isActive).length,
            totalCount: subscriptionPage.value.totalCount,
            expiringSoon: expiringWithin(
              subscriptionPage.value.items,
              EXPIRY_HORIZON_DAYS,
              now
            ).map((s) => toSubscriptionView(s, now)),
          },
        }
      : { ok: false, message: failureMessage(subscriptionPage.error.code) },
  };
}

/**
 * Which rooms are in use at this exact moment.
 *
 * Needs both calls to have succeeded: the room list comes from the catalog and
 * the occupancy from today's bookings, and half of that is not a partial
 * answer, it is a wrong one. An occupancy board missing a room reads as "that
 * room is free".
 */
function buildOccupancy(
  products: Awaited<ReturnType<typeof listProducts>>,
  todayItems: RekazReservation[] | null,
  now: Date
): Tile<RoomOccupancy[]> {
  if (!products.ok) return { ok: false, message: failureMessage(products.error.code) };
  if (!todayItems) return { ok: false, message: "Could not load today's bookings." };

  const live = todayItems.filter(
    (r) =>
      !isCancelled(r) &&
      Date.parse(r.startAt) <= now.getTime() &&
      Date.parse(r.endAt) > now.getTime()
  );

  return {
    ok: true,
    data: bookableRooms(products.value.items).map((room) => ({
      id: room.id,
      name: room.name,
      occupiedBy:
        live
          .filter((r) => (r.providers ?? []).some((p) => p.id === room.id))
          .map(toReservationView)[0] ?? null,
    })),
  };
}

function withinNextDays(r: RekazReservation, now: Date, days: number): boolean {
  const startsAt = Date.parse(r.startAt);
  if (!Number.isFinite(startsAt)) return false;
  return (
    startsAt >= now.getTime() &&
    startsAt <= now.getTime() + days * 24 * 60 * 60 * 1000 &&
    !isCancelled(r)
  );
}

function isCancelled(r: RekazReservation): boolean {
  return r.status?.toLowerCase() === "cancelled";
}

function toReservationView(r: RekazReservation): ReservationView {
  const parts = toRiyadhParts(r.startAt);
  return {
    id: r.id,
    startTime: parts.time,
    endTime: riyadhTime(r.endAt),
    day: parts.date,
    weekday: parts.weekday,
    productName: r.productName,
    priceName: r.priceName,
    // Rekaz returns an empty string rather than null on some records. An empty
    // string renders as a blank gap that looks like a layout bug; an explicit
    // null lets the view say "walk-in" and mean it.
    customerName: r.customerName?.trim() || null,
    status: r.status,
    reservationNumber: r.reservationNumber,
    paymentStatus: r.orderPaymentStatusString,
  };
}

function toSubscriptionView(
  s: Parameters<typeof isActive>[0],
  now: Date
): SubscriptionView {
  const endsAt = s.endAt ? Date.parse(s.endAt) : Number.NaN;
  return {
    id: s.id,
    code: s.subscriptionCode,
    itemName: s.items[0]?.name ?? "Subscription",
    endsOn: s.endAt ? toRiyadhParts(s.endAt).date : "",
    daysRemaining: Number.isFinite(endsAt)
      ? Math.max(0, Math.ceil((endsAt - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0,
  };
}

/**
 * What a broken tile says.
 *
 * Deliberately does not include the upstream message. Rekaz's errors arrive in
 * Arabic on an English-only page and name their internal field names, neither
 * of which helps whoever is looking at this. The full detail is already in the
 * server log with a trace id.
 */
function failureMessage(code: string): string {
  switch (code) {
    case "upstream_unavailable":
      return "Rekaz is not responding. This is usually temporary.";
    case "rate_limited":
      return "Rekaz is rate limiting us. Try again shortly.";
    default:
      return "Could not load this from Rekaz.";
  }
}
