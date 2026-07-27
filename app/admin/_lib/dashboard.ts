import "server-only";

import { bookableRooms, listProducts } from "@/server/rekaz/catalog";
import { listReservations, listReservationsOnDay } from "@/server/rekaz/reservations";
import {
  expiringWithin,
  isActive,
  listSubscriptions,
} from "@/server/rekaz/subscriptions";
import type { RekazReservation } from "@/server/rekaz/types";
import {
  isWithin,
  riyadhDayRangeUtc,
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

export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  const today = riyadhToday(now);

  // Fired together rather than in sequence: four serial round trips to Riyadh
  // from Frankfurt is most of a second of staring at a spinner for no reason.
  const [products, todayPage, upcomingPage, subscriptionPage] = await Promise.all([
    listProducts(),
    listReservationsOnDay(today),
    listReservations({ upcoming: true }),
    listSubscriptions(),
  ]);

  const todayReservations: Tile<ReservationView[]> = todayPage.ok
    ? {
        ok: true,
        // Re-filtered to the Riyadh day even though the query already bounded
        // it. Rekaz's slots endpoint demonstrably pads a requested date range
        // rather than honouring it, and having been surprised once by that on
        // one endpoint, trusting it on another is optimism, not engineering.
        data: withinDay(todayPage.value.items, today).map(toReservationView),
      }
    : { ok: false, message: failureMessage(todayPage.error.code) };

  return {
    generatedAt: now.toISOString(),
    today,
    todayReservations,

    occupancy: buildOccupancy(products, todayPage.ok ? todayPage.value.items : null, now),

    upcoming: upcomingPage.ok
      ? {
          ok: true,
          data: upcomingPage.value.items
            .filter((r) => withinNextDays(r, now, UPCOMING_DAYS))
            .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))
            .map(toReservationView),
        }
      : { ok: false, message: failureMessage(upcomingPage.error.code) },

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

function withinDay(items: RekazReservation[], day: string): RekazReservation[] {
  const { start, end } = riyadhDayRangeUtc(day);
  return items
    .filter((r) => isWithin(r.startAt, start, end))
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
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
