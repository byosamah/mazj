import { describe, expect, it } from "vitest";

import { expiringWithin, isActive } from "./subscriptions";
import type { RekazSubscription } from "./types";

const NOW = new Date("2026-07-27T12:00:00Z");

function sub(overrides: Partial<RekazSubscription> = {}): RekazSubscription {
  return {
    id: "sub-1",
    subscriptionCode: "SUB-aaaaa",
    customerId: "cus-1",
    startAt: "2026-07-01T00:00:00Z",
    endAt: "2026-08-01T00:00:00Z",
    status: "Active",
    isPaused: false,
    items: [{ id: "i1", priceId: "p1", name: "Shared seat", quantity: 1 }],
    branchId: "b1",
    totalAmount: 980,
    paidAmount: 980,
    remainingAmount: 0,
    lastInvoiceStatus: "Paid",
    creationTime: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("isActive", () => {
  it("matches Rekaz's own casing", () => {
    expect(isActive(sub({ status: "Active" }))).toBe(true);
  });

  it("🔴 is case-insensitive", () => {
    // `status` is an undocumented string on an API with no schema and no SDK.
    // If Rekaz ever returns `active`, an exact comparison would empty the
    // dashboard's member count without any error to notice.
    expect(isActive(sub({ status: "active" }))).toBe(true);
    expect(isActive(sub({ status: "ACTIVE" }))).toBe(true);
  });

  it("rejects every other status", () => {
    for (const status of ["Pending", "Expired", "Cancelled", ""]) {
      expect(isActive(sub({ status })), status).toBe(false);
    }
  });
});

describe("expiringWithin", () => {
  it("includes an active subscription ending inside the horizon", () => {
    const found = expiringWithin([sub({ endAt: "2026-08-10T00:00:00Z" })], 30, NOW);
    expect(found).toHaveLength(1);
  });

  it("excludes one ending beyond the horizon", () => {
    const found = expiringWithin([sub({ endAt: "2026-09-30T00:00:00Z" })], 30, NOW);
    expect(found).toHaveLength(0);
  });

  it("🔴 excludes one that has already ended", () => {
    // A renewal prompt for a membership that lapsed three weeks ago is noise,
    // and noise is how an operations dashboard stops being read.
    const found = expiringWithin([sub({ endAt: "2026-07-01T00:00:00Z" })], 30, NOW);
    expect(found).toHaveLength(0);
  });

  it("excludes non-active subscriptions regardless of end date", () => {
    const found = expiringWithin(
      [sub({ status: "Cancelled", endAt: "2026-08-01T00:00:00Z" })],
      30,
      NOW
    );
    expect(found).toHaveLength(0);
  });

  it("excludes one with no end date", () => {
    expect(expiringWithin([sub({ endAt: null })], 30, NOW)).toHaveLength(0);
  });

  it("survives an unparseable end date without throwing", () => {
    expect(expiringWithin([sub({ endAt: "not a date" })], 30, NOW)).toHaveLength(0);
  });

  it("sorts soonest first, because that is the order to act in", () => {
    const found = expiringWithin(
      [
        sub({ id: "c", endAt: "2026-08-20T00:00:00Z" }),
        sub({ id: "a", endAt: "2026-07-29T00:00:00Z" }),
        sub({ id: "b", endAt: "2026-08-05T00:00:00Z" }),
      ],
      30,
      NOW
    );

    expect(found.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("includes one ending exactly now and one exactly at the horizon", () => {
    // Boundaries are inclusive on both ends. A membership expiring at this
    // instant is the single most urgent thing on the list, and dropping the
    // far boundary would make a 30-day view silently a 29-day one.
    const atNow = sub({ id: "now", endAt: NOW.toISOString() });
    const atHorizon = sub({
      id: "horizon",
      endAt: new Date(NOW.getTime() + 30 * 86_400_000).toISOString(),
    });

    expect(expiringWithin([atNow, atHorizon], 30, NOW).map((s) => s.id)).toEqual([
      "now",
      "horizon",
    ]);
  });

  it("handles an empty list", () => {
    expect(expiringWithin([], 30, NOW)).toEqual([]);
  });
});
