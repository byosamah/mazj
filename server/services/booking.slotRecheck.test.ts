import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The server-side slot re-check, and which DAY it asks Rekaz about.
 *
 * 🔴 REK-015, a latent refusal of a perfectly valid booking. `getSlots` runs
 * everything it fetches through `filterSlotsToRange`, which compares each
 * window's RIYADH date against the range asked for. The write path derived that
 * range as `slotFrom.slice(0, 10)`, which is the UTC date. The two disagree for
 * every window starting at or after 21:00 UTC, because that instant is already
 * midnight in Al Khobar: the customer's own slot is filtered out of its own
 * re-check, `stillFree` is false, and the booking is refused with "That time was
 * just taken."
 *
 * The events hall sells exactly those late windows, so this was a live refusal
 * waiting on a 9pm booking rather than a theoretical one.
 *
 * 🔴 `getSlots` IS MOCKED OVER THE REAL `filterSlotsToRange`. A mock that
 * ignored `startDate` would pass against the broken code, which is precisely the
 * defect: the filter was never wrong, the day handed to it was. Reintroduce
 * `slotFrom.slice(0, 10)` and the first test below must go red. If it does not,
 * this file is proving nothing.
 *
 * ⚠️ WHAT THIS FILE CANNOT PROVE, and it is the half that carries the risk. The
 * fix also changes the `StartDate` / `EndDate` sent to Rekaz, and every request
 * here is answered by a fixture rather than by Rekaz. So nothing below shows
 * that the live API still returns a 21:00Z window when asked about the FOLLOWING
 * Riyadh day. The reason to expect it does is that Rekaz PADS ranges rather than
 * honouring them (measured: asking for one Friday returned the preceding
 * Thursday, which is why `filterSlotsToRange` exists at all), so it returns more
 * than the day requested rather than less. That is an argument, not a
 * measurement. Confirm against the live tenant before treating REK-015 as
 * closed.
 */

/**
 * One bookable window, in the shape `filterSlotsToRange` reads.
 *
 * Only `from`, `isOutDated` and `isAvailable` are consulted; the rest is present
 * so the literal satisfies `RekazSlot` without a cast.
 */
function slot(from: string, to: string) {
  return {
    from,
    to,
    availableReservationsCount: 1,
    availableProvidersCount: 1,
    availableProviderIds: [] as string[],
    isOutDated: false,
    isAvailable: true,
    amounts: {
      totalPrice: 220,
      totalAfterDiscount: 220,
      effectiveQuantity: 1,
      depositAmount: null,
      basePrice: 0,
      priceWithTax: 0,
    },
    maxConnectedTo: null,
  };
}

/**
 * Two windows on ONE Riyadh evening, as Rekaz reports them (UTC):
 *
 *   17:00Z -> 20:00 in Al Khobar, the 10th under either reading
 *   21:00Z -> 00:00 in Al Khobar, the 11th in Riyadh and still the 10th in UTC
 *
 * The second one is the whole test. Fixed dates rather than relative ones
 * because nothing here consults a clock: `isOutDated` is a field on the fixture,
 * and `filterSlotsToRange` compares strings.
 */
const RAW_SLOTS = [
  slot("2026-08-10T17:00:00Z", "2026-08-10T19:00:00Z"),
  slot("2026-08-10T21:00:00Z", "2026-08-10T23:00:00Z"),
];

const createReservation = vi.fn(async (_input: Record<string, unknown>) => ({
  ok: true as const,
  value: {
    invoiceId: "inv-1",
    reservationIds: ["r-1"],
    paymentLink: "/orders/pay/X",
  },
}));

vi.mock("@/server/core/idempotency", () => ({
  beginIdempotent: async () => ({ ok: true, value: { kind: "proceed" } }),
  completeIdempotent: async () => ({ ok: true, value: undefined }),
  abandonIdempotent: async () => undefined,
}));

vi.mock("@/server/core/rate-limit", () => ({
  checkRateLimit: async () => ({
    ok: true,
    value: { allowed: true, remaining: 7, resetAt: new Date(), retryAfterSeconds: 0 },
  }),
  checkRateLimits: async () => ({
    ok: true,
    value: { allowed: true, remaining: 7, resetAt: new Date(), retryAfterSeconds: 0 },
  }),
  rateLimitedError: () => ({ code: "rate_limited", message: "x" }),
}));

vi.mock("@/server/env", () => ({
  env: () => ({
    IP_HASH_SALT: "0123456789abcdef0123456789abcdef",
    REKAZ_API_BASE: "https://platform.rekaz.io/api/public",
  }),
}));

// The booking record is bookkeeping AFTER the sale, deliberately best effort in
// the service. Stubbed to a success so nothing here depends on a database.
vi.mock("@/server/db/bookings", () => ({
  recordBooking: async () => ({ ok: true, value: undefined }),
}));

const PRICE = {
  id: "live-price-id",
  immutableId: "stable-price-id",
  order: 1,
  name: "ساعتان",
  duration: 120,
  billingPeriod: null,
  amount: 220,
  discountedAmount: 220,
  depositAmount: 0,
  hasDeposit: false,
};

vi.mock("@/server/rekaz/catalog", () => ({
  listProducts: async () => ({
    ok: true,
    value: {
      totalCount: 1,
      items: [
        {
          id: "p-hall",
          slug: "qaah-alfaalyat-almaarj",
          nameAr: "قاعة الفعاليات",
          nameEn: "قاعة الفعاليات",
          name: "قاعة الفعاليات",
          type: 0,
          typeString: "Reservation",
          pricing: [PRICE],
          customFields: [],
          productProviders: [],
          // ⚠️ Empty on the events hall on the live tenant, which is exactly why
          // `resolveBranchId` has a fallback.
          branchIds: [],
          isOutOfStock: false,
          amount: 220,
          duration: 120,
          description: null,
          shortDescription: null,
          maximumQuantityPerOrder: 1,
        },
      ],
    },
  }),
  listBranches: async () => ({ ok: true, value: [{ id: "branch-1" }] }),
  resolveBranchId: async (product: { branchIds?: string[] }) => ({
    ok: true,
    value: product.branchIds?.[0] ?? "branch-1",
  }),
}));

vi.mock("@/server/rekaz/reconcile", () => ({
  reconcileReservation: async () => ({ ok: true, value: { outcome: "absent" } }),
  reconcileSubscription: async () => ({ ok: true, value: { outcome: "absent" } }),
}));

vi.mock("@/server/rekaz/reservations", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/rekaz/reservations")>();
  return {
    ...actual,
    // The REAL range filter over a fixed catalogue of windows. This is the point
    // of the file: the service's only input to the filter is the day it asks
    // for, so the day is what gets tested.
    getSlots: async (query: { startDate: string; endDate: string }) => ({
      ok: true,
      value: actual.filterSlotsToRange(RAW_SLOTS, query.startDate, query.endDate),
    }),
  };
});

vi.mock("@/server/rekaz/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rekaz/booking")>();
  return {
    ...actual,
    // ⚠️ `CustomerMatch`, not a bare customer-or-null. The lookup gained a
    // THIRD outcome (`ambiguous`) on 2026-07-28; a `null` here now reaches
    // `lookup.kind` and throws rather than reading as "no such customer".
    findCustomerByMobile: async () => ({ ok: true, value: { kind: "none" } }),
    createReservation: (input: Record<string, unknown>) => createReservation(input),
    createSubscription: vi.fn(),
  };
});

const { createBooking } = await import("@/server/services/booking");

const BASE = {
  space: "event-hall",
  priceImmutableId: "stable-price-id",
  customer: { name: "Test Person", mobile: "0534600488" },
  ip: { ip: "203.0.113.9", attested: true },
};

beforeEach(() => {
  createReservation.mockClear();
});

describe("the write-path slot re-check works in Riyadh days", () => {
  it("🔴 accepts a window starting at 21:00 UTC, which is midnight in Al Khobar", async () => {
    const result = await createBooking({
      ...BASE,
      slotFrom: "2026-08-10T21:00:00Z",
      slotTo: "2026-08-10T23:00:00Z",
      idempotencyKey: "k-late-window",
    });

    expect(
      result.ok,
      "a valid late window was refused by its own availability re-check"
    ).toBe(true);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("still accepts an ordinary evening window", async () => {
    const result = await createBooking({
      ...BASE,
      slotFrom: "2026-08-10T17:00:00Z",
      slotTo: "2026-08-10T19:00:00Z",
      idempotencyKey: "k-evening",
    });

    expect(result.ok).toBe(true);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("still refuses a window Rekaz is no longer offering", async () => {
    // The re-check has to keep biting. Without this the fix above could be
    // "achieved" by never filtering at all, which is the race the re-check
    // exists to lose safely.
    const result = await createBooking({
      ...BASE,
      slotFrom: "2026-08-10T07:00:00Z",
      slotTo: "2026-08-10T09:00:00Z",
      idempotencyKey: "k-window-gone",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("conflict");
      // 🔴 And it stays the UNMARKED conflict, so the page keeps rendering "that
      // time was just taken" for the one case where that sentence is true.
      expect(result.error.fields?.booking).toBeUndefined();
    }
    expect(createReservation).not.toHaveBeenCalled();
  });
});
