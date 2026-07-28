import "server-only";

import { splitByBookingFlow, listProducts } from "@/server/rekaz/catalog";
import { filterSlotsToRange, getSlots } from "@/server/rekaz/reservations";
import { riyadhDate, riyadhToday } from "@/server/domain/riyadh-time";
import { spaceBySlug, type BookingFlow } from "@/server/domain/spaces";
import type { RekazCustomField } from "@/server/rekaz/types";

/**
 * Everything the booking pages need from Rekaz, as plain data.
 *
 * The sanctioned crossing for `app/[locale]/spaces/**`. Pages and client
 * components import from here; nothing under `app/[locale]/` may reach
 * `@/server` directly. See the header of `eslint.config.mjs`.
 *
 * 🔴 Nothing here ever returns a Rekaz `id` for a price. The client works in
 * `immutableId` only, because price ids rotate whenever someone edits a price
 * in the Rekaz dashboard: a page rendered on Monday would submit an id that no
 * longer exists on Tuesday. The service resolves the live id at write time.
 */

/** One purchasable duration, as the picker renders it. */
export type PriceOption = {
  /** Stable handle. The only price identifier the browser ever sees. */
  immutableId: string;
  /** Rekaz's Arabic label, e.g. `ساعتان`. English comes from messages/en.json. */
  labelAr: string;
  amount: number;
  /** Minutes, for reservations. */
  durationMinutes: number | null;
  /** Days, for subscriptions. */
  billingPeriodDays: number | null;
};

export type BookableSpace = {
  slug: string;
  flow: BookingFlow;
  nameAr: string;
  prices: PriceOption[];
  customFields: RekazCustomField[];
  isOutOfStock: boolean;
};

/**
 * The catalog for one space, or `null` if Rekaz does not have it.
 *
 * Returning null rather than throwing so the page can render an honest "booking
 * is temporarily unavailable" instead of a 500. Rekaz being down must not take
 * a marketing page down with it.
 */
export async function loadBookableSpace(
  slug: string
): Promise<BookableSpace | null> {
  const space = spaceBySlug(slug);
  if (!space) return null;

  const catalog = await listProducts();
  if (!catalog.ok) return null;

  const product = catalog.value.items.find((p) => p.slug === space.rekazSlug);
  if (!product) return null;

  return {
    slug: space.slug,
    flow: space.flow,
    nameAr: product.nameAr,
    isOutOfStock: product.isOutOfStock,
    customFields: product.customFields ?? [],
    prices: product.pricing
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((p) => ({
        immutableId: p.immutableId,
        labelAr: p.name,
        amount: p.discountedAmount || p.amount,
        durationMinutes: p.duration,
        billingPeriodDays: p.billingPeriod,
      })),
  };
}

/** Which of the four spaces are sold as time slots. Used by the pages. */
export async function bookableFlowFor(slug: string): Promise<BookingFlow | null> {
  return spaceBySlug(slug)?.flow ?? null;
}

/**
 * Availability, or the reason there is none.
 *
 * 🔴 A bare `DaySlots[] | null` conflated "Rekaz is down" with "nothing is
 * free", and the form rendered NEITHER: on null it fell through every branch,
 * leaving an empty step 2 with a permanently disabled submit and no message at
 * all. A silent dead end at the money step is the worst possible failure mode,
 * because the visitor concludes the business is broken rather than that the
 * request failed.
 */
export type Availability =
  | { ok: true; days: DaySlots[] }
  | { ok: false; reason: "upstream" };

export type DaySlots = {
  /** `YYYY-MM-DD` in Riyadh. */
  day: string;
  slots: { from: string; to: string; startTime: string; endTime: string }[];
};

/**
 * Availability for one space and duration, across a window of days.
 *
 * 🔴 Two Rekaz behaviours are absorbed here rather than leaked to the UI. The
 * date range comes back PADDED, so a request for the 28th returns the 27th and
 * 29th too, and past windows arrive flagged rather than omitted. Both are
 * filtered by `filterSlotsToRange`. A picker fed the raw response would offer
 * people slots on days they did not ask about, and this morning's slots this
 * afternoon.
 *
 * Fridays and Saturdays simply have no slots: the venue is closed and Rekaz
 * returns nothing for them. The UI must present that as "closed", not as an
 * error.
 */
export async function loadAvailability(
  spaceSlug: string,
  priceImmutableId: string,
  days = 14
): Promise<Availability> {
  const mapping = spaceBySlug(spaceSlug);
  if (!mapping || mapping.flow !== "reservation") {
    // Not a slot-booked product. An empty calendar is the honest answer, not an
    // error: subscriptions have no slots by design.
    return { ok: true, days: [] };
  }

  const catalog = await listProducts();
  if (!catalog.ok) return { ok: false, reason: "upstream" };

  const product = catalog.value.items.find((p) => p.slug === mapping.rekazSlug);
  const price = product?.pricing.find((p) => p.immutableId === priceImmutableId);
  if (!price) return { ok: false, reason: "upstream" };

  const start = riyadhToday();
  const end = riyadhDate(new Date(Date.now() + days * 86_400_000));

  const result = await getSlots({
    priceId: price.id,
    startDate: start,
    endDate: end,
  });
  if (!result.ok) return { ok: false, reason: "upstream" };

  const byDay = new Map<string, DaySlots>();
  for (const slot of filterSlotsToRange(result.value, start, end)) {
    const day = riyadhDate(slot.from);
    const entry = byDay.get(day) ?? { day, slots: [] };
    entry.slots.push({
      from: slot.from,
      to: slot.to,
      startTime: riyadhTimeOf(slot.from),
      endTime: riyadhTimeOf(slot.to),
    });
    byDay.set(day, entry);
  }

  return {
    ok: true,
    days: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
  };
}

function riyadhTimeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Re-exported so pages can enumerate spaces without importing `@/server`. */
export { splitByBookingFlow };
