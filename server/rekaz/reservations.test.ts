import { describe, expect, it } from "vitest";

import { filterSlotsToRange, groupSlotsByDay } from "./reservations";
import type { RekazSlot } from "./types";

/**
 * The slot filter, which exists because Rekaz does not honour the date range it
 * is given.
 *
 * Observed against the live API on 2026-07-27: asking for 07-28 to 07-29
 * returned windows on the 27th, 28th AND 29th; asking for a single Friday
 * returned the preceding Thursday. Handing that straight to a date picker
 * offers people slots on days they did not ask about, and on a Friday offers
 * them Thursday while the heading says Friday.
 */

function slot(from: string, overrides: Partial<RekazSlot> = {}): RekazSlot {
  return {
    from,
    to: new Date(Date.parse(from) + 3_600_000).toISOString(),
    availableReservationsCount: 1,
    availableProvidersCount: 1,
    availableProviderIds: ["room-1"],
    isOutDated: false,
    isAvailable: true,
    amounts: {
      totalPrice: 110,
      totalAfterDiscount: 110,
      effectiveQuantity: 1,
      depositAmount: null,
      basePrice: 0,
      priceWithTax: 0,
    },
    maxConnectedTo: null,
    ...overrides,
  };
}

describe("filterSlotsToRange", () => {
  it("🔴 drops the padding days Rekaz adds around the requested range", () => {
    const slots = [
      slot("2026-07-27T06:00:00Z"), // padding before
      slot("2026-07-28T06:00:00Z"), // asked for
      slot("2026-07-29T06:00:00Z"), // asked for
      slot("2026-07-30T06:00:00Z"), // padding after
    ];

    const kept = filterSlotsToRange(slots, "2026-07-28", "2026-07-29");

    expect(kept.map((s) => s.from)).toEqual([
      "2026-07-28T06:00:00Z",
      "2026-07-29T06:00:00Z",
    ]);
  });

  it("drops windows already in the past", () => {
    const slots = [
      slot("2026-07-28T06:00:00Z", { isOutDated: true }),
      slot("2026-07-28T07:00:00Z"),
    ];

    expect(filterSlotsToRange(slots, "2026-07-28", "2026-07-28")).toHaveLength(1);
  });

  it("drops unavailable windows", () => {
    const slots = [
      slot("2026-07-28T06:00:00Z", { isAvailable: false }),
      slot("2026-07-28T07:00:00Z"),
    ];

    expect(filterSlotsToRange(slots, "2026-07-28", "2026-07-28")).toHaveLength(1);
  });

  it("🔴 judges the day in Riyadh, not UTC", () => {
    // 21:00Z on the 27th is already 00:00 on the 28th at the venue. A UTC
    // comparison would drop this window from a request for the 28th, silently
    // hiding a genuinely bookable late slot.
    const late = slot("2026-07-27T21:00:00Z");

    expect(filterSlotsToRange([late], "2026-07-28", "2026-07-28")).toHaveLength(1);
    expect(filterSlotsToRange([late], "2026-07-27", "2026-07-27")).toHaveLength(0);
  });

  it("keeps a single-day request that matches exactly", () => {
    const slots = [slot("2026-07-28T06:00:00Z"), slot("2026-07-28T07:00:00Z")];
    expect(filterSlotsToRange(slots, "2026-07-28", "2026-07-28")).toHaveLength(2);
  });

  it("returns nothing rather than everything when the range matches nothing", () => {
    // The failure mode worth guarding: an empty result must not fall back to
    // showing the unfiltered list, which would be Friday's picker full of
    // Thursday's slots.
    const slots = [slot("2026-07-30T06:00:00Z")];
    expect(filterSlotsToRange(slots, "2026-07-31", "2026-07-31")).toEqual([]);
  });

  it("handles an empty input", () => {
    expect(filterSlotsToRange([], "2026-07-28", "2026-07-29")).toEqual([]);
  });
});

describe("groupSlotsByDay", () => {
  it("groups by the Riyadh day and preserves chronological order", () => {
    const grouped = groupSlotsByDay([
      slot("2026-07-28T06:00:00Z"),
      slot("2026-07-28T07:00:00Z"),
      slot("2026-07-29T06:00:00Z"),
    ]);

    expect([...grouped.keys()]).toEqual(["2026-07-28", "2026-07-29"]);
    expect(grouped.get("2026-07-28")).toHaveLength(2);
    expect(grouped.get("2026-07-29")).toHaveLength(1);
  });

  it("puts a late-evening window on the next Riyadh day", () => {
    const grouped = groupSlotsByDay([
      slot("2026-07-27T18:00:00Z"),
      slot("2026-07-27T21:00:00Z"),
    ]);

    expect([...grouped.keys()]).toEqual(["2026-07-27", "2026-07-28"]);
  });
});
