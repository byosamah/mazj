import "server-only";

import { splitByBookingFlow, listProducts } from "@/server/rekaz/catalog";
import { chargedAmount } from "@/server/rekaz/types";
import { filterSlotsToRange, getSlots } from "@/server/rekaz/reservations";
import { riyadhDate, riyadhToday } from "@/server/domain/riyadh-time";
import { spaceBySlug, type BookingFlow } from "@/server/domain/spaces";
import type {
  RekazCustomField,
  RekazPrice,
  RekazProduct,
} from "@/server/rekaz/types";

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

/** The live price row behind an immutable id, or `null` if this catalog has none. */
function priceIn(
  products: RekazProduct[],
  rekazSlug: string,
  immutableId: string
): RekazPrice | null {
  const product = products.find((p) => p.slug === rekazSlug);
  return product?.pricing.find((p) => p.immutableId === immutableId) ?? null;
}

/**
 * The catalog for one space, or `null` if Rekaz does not have it.
 *
 * Returning null rather than throwing so the page can render an honest "booking
 * is temporarily unavailable" instead of a 500. Rekaz being down must not take
 * a marketing page down with it.
 *
 * 🔴 A LIVE read, deliberately, and it must stay one. This is what decides
 * whether the page renders a booking form at all, because it carries
 * `isOutOfStock`, and `server/rekaz/catalog.ts` is explicit that its memo is for
 * read paths and never for checking stock. A cached copy here would keep selling
 * a room operations pulled a minute ago.
 *
 * It is also what makes the cached read in `loadAvailability` nearly free: a
 * live download still STORES its result in that memo, so rendering this page
 * warms the entry every duration change then reads.
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
        // 🔴 The SAME function the booking service records onto our own row as
        // `amountSnapshot`. It used to be this expression written out here and
        // `price.amount` written out there, which agreed only while no price
        // carried a discount; the first discounted price would have shown the
        // buyer one figure and handed the desk another.
        amount: chargedAmount(p),
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
 * 🔴 A day Rekaz has no windows on is simply ABSENT from the response, and it
 * never says why. Closed, sold out, and withdrawn from sale all arrive as the
 * same silence, so nothing downstream may render one of those three as a fact.
 * This paragraph used to instruct the UI to present such days as "closed", which
 * is the one claim the data cannot support. The window is now seeded with every
 * day in it instead, and the empty ones are offered as unavailable with no
 * reason attached.
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

  // 🔴 REK-042, and the ONE cached catalog read in the booking flow.
  //
  // This call exists for a single field: turning the immutable id the browser
  // holds into the live price id `/reservations/slots` wants. It was a full
  // catalog download on EVERY duration change, on top of the one the page render
  // had already paid, against a tenant measured answering between 1.2 and 10.8
  // seconds. Two downloads per press, to read one id.
  //
  // `{cached: true}` is `server/rekaz/catalog.ts`'s opt-in, and that module is
  // emphatic about who may take it: read paths only, never anything about to
  // bill, to check stock, or to decide what a customer may buy right now. This
  // clears all three. The slots themselves are still fetched live below,
  // `isOutOfStock` is read by `loadBookableSpace` on a live catalog, and the
  // price a customer is CHARGED is resolved from that file's own live read
  // inside `server/services/booking.ts`. Nothing on this path touches money.
  const catalog = await listProducts({ cached: true });
  if (!catalog.ok) return { ok: false, reason: "upstream" };

  const price = priceIn(catalog.value.items, mapping.rekazSlug, priceImmutableId);
  if (!price) return { ok: false, reason: "upstream" };

  // 🔴 ONE clock reading for the whole window, passed explicitly. `riyadhToday()`
  // takes its own `new Date()` by default, so calling it bare next to a separate
  // `Date.now()` is two readings that can straddle midnight: the seeded days
  // would then start a day away from the range we asked Rekaz for.
  const now = Date.now();
  const start = riyadhToday(new Date(now));
  const end = riyadhDate(new Date(now + days * 86_400_000));

  let result = await getSlots({
    priceId: price.id,
    startDate: start,
    endDate: end,
  });

  if (!result.ok) {
    // 🔴 The one thing a remembered catalog can get wrong here, answered rather
    // than left for the visitor to discover.
    //
    // A live price id ROTATES whenever anybody edits an amount in the Rekaz
    // dashboard, so a copy up to a minute old can name an id that no longer
    // exists, and slots asked for under a dead id fail exactly like an outage
    // does. Without this the error box's retry button would resend the same dead
    // id and fail identically for the rest of that minute: a button that cannot
    // possibly work, offered at the money step.
    //
    // So ask live, ONCE, and only re-ask for slots when the id actually moved. A
    // genuine outage therefore costs one extra catalog read and stops, rather
    // than looping.
    const live = await listProducts({ fresh: true });
    const livePrice = live.ok
      ? priceIn(live.value.items, mapping.rekazSlug, priceImmutableId)
      : null;
    if (!livePrice || livePrice.id === price.id) {
      return { ok: false, reason: "upstream" };
    }

    result = await getSlots({
      priceId: livePrice.id,
      startDate: start,
      endDate: end,
    });
    if (!result.ok) return { ok: false, reason: "upstream" };
  }

  // 🔴 REK-054. Every day in the window is seeded EMPTY before a single slot is
  // filed against it.
  //
  // Building this map from the response alone produced a calendar with holes in
  // it: the strip jumped from Thursday straight to Sunday, which reads as a
  // rendering fault rather than as a venue that is shut at the weekend. It also
  // made three pieces of the picker unreachable, since a day with zero slots
  // could not exist to be disabled, greyed, or explained.
  //
  // ⚠️ Seeded, NOT labelled. Rekaz cannot distinguish closed from fully booked
  // from withdrawn from sale, so the day is offered as unavailable and nothing
  // is asserted about why. `filterSlotsToRange` guarantees every surviving slot
  // falls inside `[start, end]`, so this seed covers all of them; the `??` below
  // stays as a backstop rather than as a live path.
  const byDay = new Map<string, DaySlots>();
  for (let offset = 0; offset <= days; offset++) {
    const day = riyadhDate(new Date(now + offset * 86_400_000));
    byDay.set(day, { day, slots: [] });
  }

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
