import { describe, expect, it, vi } from "vitest";

/**
 * Subscription start dates must be bounded in BOTH directions.
 *
 * 🔴 The original check was a shape test (`/^\d{4}-\d{2}-\d{2}/`), which happily
 * accepted `2020-01-01`. The only thing stopping a backdated subscription was
 * the date input's `min` attribute, and an attribute is a UI hint that a crafted
 * POST simply omits. A backdated subscription is a paid membership whose term is
 * already spent: Rekaz has no reason to reject it and MAZJ has every reason to.
 */

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

const createSubscription = vi.fn(async () => ({
  ok: true as const,
  value: { invoiceId: "i", reservationIds: [], paymentLink: "/orders/pay/X" },
}));

vi.mock("@/server/rekaz/catalog", () => ({
  listProducts: async () => ({
    ok: true,
    value: {
      totalCount: 1,
      items: [
        {
          id: "p",
          slug: "adwyh-almsahh-almshtrkh",
          nameAr: "x",
          nameEn: "x",
          name: "x",
          type: 1,
          typeString: "Subscription",
          pricing: [
            {
              id: "live",
              immutableId: "stable",
              order: 1,
              name: "One month",
              duration: null,
              billingPeriod: 30,
              amount: 980,
              discountedAmount: 980,
              depositAmount: 0,
              hasDeposit: false,
            },
          ],
          customFields: [],
          productProviders: [],
          branchIds: ["b1"],
          isOutOfStock: false,
          amount: 980,
          duration: null,
          description: null,
          shortDescription: null,
          maximumQuantityPerOrder: 1,
        },
      ],
    },
  }),
  listBranches: async () => ({ ok: true, value: [{ id: "b1" }] }),
}));
vi.mock("@/server/rekaz/reconcile", () => ({
  reconcileReservation: async () => ({ ok: true, value: { outcome: "absent" } }),
  reconcileSubscription: async () => ({ ok: true, value: { outcome: "absent" } }),
}));
vi.mock("@/server/rekaz/reservations", () => ({ getSlots: async () => ({ ok: true, value: [] }) }));
vi.mock("@/server/rekaz/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rekaz/booking")>();
  return {
    ...actual,
    findCustomerByMobile: async () => ({ ok: true, value: null }),
    createReservation: vi.fn(),
    createSubscription: (...a: unknown[]) => createSubscription(...(a as [])),
  };
});

const { createBooking } = await import("@/server/services/booking");

function riyadhDay(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(
    new Date(Date.now() + offsetDays * 86_400_000)
  );
}

const BASE = {
  space: "coworking",
  priceImmutableId: "stable",
  customer: { name: "Test Person", mobile: "0534600488" },
  ip: { ip: "203.0.113.9", attested: true },
};

describe("subscription start date", () => {
  it("🔴 refuses a backdated start", async () => {
    const result = await createBooking({
      ...BASE,
      startAt: "2020-01-01",
      idempotencyKey: "k-past",
    });

    expect(result.ok, "a 2020 start was accepted").toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("validation_failed");
      expect(result.error.fields?.startAt).toBe("past");
    }
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("🔴 refuses yesterday", async () => {
    const result = await createBooking({
      ...BASE,
      startAt: riyadhDay(-1),
      idempotencyKey: "k-yday",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts TODAY, judged in Riyadh", async () => {
    // The boundary that matters. Between midnight and 3am local, a UTC-derived
    // "today" is still yesterday, so a customer booking at 1am would have their
    // own current date refused.
    const result = await createBooking({
      ...BASE,
      startAt: riyadhDay(0),
      idempotencyKey: "k-today",
    });
    expect(result.ok, "today was refused as past").toBe(true);
  });

  it("accepts a date later this year", async () => {
    const result = await createBooking({
      ...BASE,
      startAt: riyadhDay(60),
      idempotencyKey: "k-soon",
    });
    expect(result.ok).toBe(true);
  });

  it("refuses a start beyond a year, so a mistyped year cannot linger forever", async () => {
    const result = await createBooking({
      ...BASE,
      startAt: "2126-01-01",
      idempotencyKey: "k-far",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.fields?.startAt).toBe("too_far");
  });

  it("refuses a malformed date rather than passing it upstream", async () => {
    for (const startAt of ["not-a-date", "2026-13-45extra", "", "2026-1-1"]) {
      const result = await createBooking({
        ...BASE,
        startAt,
        idempotencyKey: `k-${startAt || "empty"}`,
      });
      expect(result.ok, JSON.stringify(startAt)).toBe(false);
    }
  });
});
