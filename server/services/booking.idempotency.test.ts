import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rule that stops a customer being billed twice.
 *
 * 🔴 An idempotency key may be released ONLY when the write provably never
 * reached Rekaz. Rekaz has no idempotency of its own and is measured between
 * 1.2s and 10.8s on this tenant against a 10s client timeout, so "we asked and
 * never heard back" is a routine outcome, not a freak one. In that state the
 * booking and its invoice may well exist, and releasing the key lets the retry
 * (which carries the same key by design) create a second of each.
 *
 * These tests exist because the original code released the key on EVERY
 * failure, which reads as obviously reasonable and is wrong precisely in the
 * case that costs money. An adversarial review found it. Do not "simplify" the
 * branch back.
 *
 * 🔴 THE SECOND HALF, added 2026-07-29: WHAT reconciliation is asked. Every
 * branch above turns on the answer, and the answer is only as good as the
 * question. Reconciliation matches on the exact slot start and on the mobile as
 * REKAZ stores it, so a call handed `slotTo` instead of `slotFrom`, or the
 * digits the visitor typed instead of the E.164 form, matches nothing and comes
 * back `absent`. `absent` is the confident answer: it releases the key and
 * invites the customer to book again, on top of a booking that already exists.
 * That drift changes no outcome any of the tests above assert, so it would pass
 * the whole file green while producing a second real invoice per timed-out
 * booking in production. Hence the argument assertions at the bottom.
 */

const abandonIdempotent = vi.fn(async () => undefined);
const completeIdempotent = vi.fn(async () => ({ ok: true as const, value: undefined }));
const beginIdempotent = vi.fn(async () => ({
  ok: true as const,
  value: { kind: "proceed" as const },
}));

const createReservation = vi.fn();
const createSubscription = vi.fn();

/**
 * A customer Rekaz already knows, needed only by the subscription branch.
 *
 * 🔴 `reconcileSubscription` searches by `customerId`, which is the one filter
 * `GET /subscriptions` honours, so the subscription arm cannot reach that call
 * at all unless the lookup found somebody: a first-time buyer short-circuits to
 * `absent` without asking Rekaz anything. That is why this file's lookup became
 * controllable rather than a fixed "no such customer".
 *
 * ⚠️ Carries `REQUEST`'s number deliberately, in the E.164 form Rekaz stores it
 * in rather than the `05…` form the visitor types. This is the record the
 * lookup hands back for that number, so the two must agree or the fixture is
 * describing somebody else.
 */
const MEMBER = {
  id: "member-customer-id",
  name: "A Real Member",
  customerNumber: null,
  mobileNumber: "+966534600488",
  email: null,
  isBlocked: false,
};

// Typed against the real union, or `vi.fn(async () => X)` narrows to X and tsc
// rejects every other outcome while vitest itself passes.
type CustomerLookup =
  | {
      ok: true;
      value:
        | { kind: "found"; customer: typeof MEMBER }
        | { kind: "none" }
        | { kind: "ambiguous"; count: number };
    }
  | { ok: false; error: { code: string; message: string } };

const NO_SUCH_CUSTOMER: CustomerLookup = { ok: true, value: { kind: "none" } };

const findCustomerByMobile = vi.fn(
  async (): Promise<CustomerLookup> => NO_SUCH_CUSTOMER
);

vi.mock("@/server/core/idempotency", () => ({
  beginIdempotent: (...a: unknown[]) => beginIdempotent(...(a as [])),
  completeIdempotent: (...a: unknown[]) => completeIdempotent(...(a as [])),
  abandonIdempotent: (...a: unknown[]) => abandonIdempotent(...(a as [])),
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
// the service. Stubbed to a success so nothing here depends on a database, and
// so a failure of it could never be mistaken for a failure of the idempotency
// rules this file exists to pin.
vi.mock("@/server/db/bookings", () => ({
  recordBooking: async () => ({ ok: true, value: undefined }),
}));

const PRICE = {
  id: "live-price-id",
  immutableId: "stable-price-id",
  order: 1,
  name: "One hour",
  duration: 60,
  billingPeriod: null,
  amount: 110,
  discountedAmount: 110,
  depositAmount: 0,
  hasDeposit: false,
};

const product = (slug: string, typeString: string) => ({
  id: "p1",
  slug,
  nameAr: "x",
  nameEn: "x",
  name: "x",
  type: 0,
  typeString,
  pricing: [PRICE],
  customFields: [],
  productProviders: [],
  branchIds: ["branch-1"],
  isOutOfStock: false,
  amount: 110,
  duration: 60,
  description: null,
  shortDescription: null,
  maximumQuantityPerOrder: 1,
});

vi.mock("@/server/rekaz/catalog", () => ({
  listProducts: async () => ({
    ok: true,
    value: {
      totalCount: 2,
      items: [
        product("ghrfh-alajtmaaat-almlqa", "Reservation"),
        // The subscription flow reaches a DIFFERENT reconcile function through a
        // different branch, so the catalog has to be able to sell both.
        product("adwyh-almsahh-almshtrkh", "Subscription"),
      ],
    },
  }),
  listBranches: async () => ({ ok: true, value: [{ id: "branch-1" }] }),
  // `resolveBranchId` moved into `catalog.ts` on 2026-07-28 when event tickets
  // became a second caller, so it is now a cross-module dependency of
  // `booking.ts` and has to be declared here. Mirrors the real function: the
  // product's own branch, falling back to the tenant's only one.
  resolveBranchId: async (product: { branchIds?: string[] }) => ({
    ok: true,
    value: product.branchIds?.[0] ?? "branch-1",
  }),
}));

// Typed against the real union, or TypeScript narrows the mock to whatever the
// initial implementation happens to return and rejects every other outcome.
type ReconcileResult = {
  ok: true;
  value:
    | { outcome: "found"; reference: string }
    | { outcome: "absent" }
    | { outcome: "unknown" };
};

const ABSENT: ReconcileResult = { ok: true, value: { outcome: "absent" } };

const reconcileReservation = vi.fn(async (): Promise<ReconcileResult> => ABSENT);
const reconcileSubscription = vi.fn(async (): Promise<ReconcileResult> => ABSENT);

vi.mock("@/server/rekaz/reconcile", () => ({
  reconcileReservation: (...a: unknown[]) => reconcileReservation(...(a as [])),
  reconcileSubscription: (...a: unknown[]) => reconcileSubscription(...(a as [])),
}));

vi.mock("@/server/rekaz/reservations", () => ({
  // The slot the request names is always still free, so the only failure under
  // test is the write itself.
  getSlots: async () => ({
    ok: true,
    value: [{ from: "2026-08-10T17:00:00Z", to: "2026-08-10T18:00:00Z" }],
  }),
}));

vi.mock("@/server/rekaz/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rekaz/booking")>();
  return {
    ...actual,
    // ⚠️ `CustomerMatch`, not a bare customer-or-null. The lookup gained a
    // THIRD outcome (`ambiguous`) on 2026-07-28; a `null` here now reaches
    // `lookup.kind` and throws rather than reading as "no such customer".
    findCustomerByMobile: (...a: unknown[]) => findCustomerByMobile(...(a as [])),
    createReservation: (...a: unknown[]) => createReservation(...(a as [])),
    createSubscription: (...a: unknown[]) => createSubscription(...(a as [])),
  };
});

const { createBooking } = await import("@/server/services/booking");

const REQUEST = {
  space: "meeting-room",
  priceImmutableId: "stable-price-id",
  slotFrom: "2026-08-10T17:00:00Z",
  slotTo: "2026-08-10T18:00:00Z",
  customer: { name: "Test Person", mobile: "0534600488" },
  idempotencyKey: "key-abc-123",
  ip: { ip: "203.0.113.9", attested: true },
};

/** The E.164 form `0534600488` normalises to before anything upstream sees it. */
const NORMALISED_MOBILE = "+966534600488";

/**
 * Computed rather than written down, because the service refuses a start date
 * in the past: a literal would pass until the day it did not.
 */
function riyadhDay(offsetDays: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(
    new Date(Date.now() + offsetDays * 86_400_000)
  );
}

const SUBSCRIPTION_REQUEST = {
  space: "coworking",
  priceImmutableId: "stable-price-id",
  startAt: riyadhDay(7),
  customer: { name: "Test Person", mobile: "0534600488" },
  idempotencyKey: "key-sub-recon-1",
  ip: { ip: "203.0.113.9", attested: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  beginIdempotent.mockResolvedValue({ ok: true, value: { kind: "proceed" } });
  completeIdempotent.mockResolvedValue({ ok: true, value: undefined });
  reconcileReservation.mockResolvedValue({ ok: true, value: { outcome: "absent" } });
  reconcileSubscription.mockResolvedValue({ ok: true, value: { outcome: "absent" } });
  findCustomerByMobile.mockResolvedValue(NO_SUCH_CUSTOMER);
});

describe("releasing the idempotency key", () => {
  it("🔴 does NOT release it when a timed-out write turns out to EXIST", async () => {
    // The case that bills twice. Rekaz committed; we never heard the answer.
    createReservation.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "Rekaz did not respond within 10000ms" },
    });
    reconcileReservation.mockResolvedValue({
      ok: true,
      value: { outcome: "found", reference: "15284726" },
    });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    expect(
      abandonIdempotent,
      "released the key on a booking that exists: a retry now creates a second one"
    ).not.toHaveBeenCalled();
    // Terminally closed, so the 90s in_progress reclaim cannot resurrect it.
    expect(completeIdempotent).toHaveBeenCalledTimes(1);
    // The customer is given Rekaz's reference, which is the only way this gets
    // resolved: a fetched booking exposes no payment link.
    if (!result.ok) expect(result.error.fields?.reference).toBe("15284726");
  });

  it("🔴 does NOT release it when reconciliation could not answer", async () => {
    // Unknown is not absent. Retrying might duplicate, so the key is held.
    createReservation.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "timeout" },
    });
    reconcileReservation.mockResolvedValue({ ok: true, value: { outcome: "unknown" } });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    expect(abandonIdempotent).not.toHaveBeenCalled();
    expect(completeIdempotent).toHaveBeenCalledTimes(1);
  });

  it("DOES release it when the timed-out write provably did NOT land", async () => {
    // The common case. Going and looking is what turns a dead end into an
    // ordinary retry instead of stranding the customer at "contact us".
    createReservation.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "timeout" },
    });
    reconcileReservation.mockResolvedValue({ ok: true, value: { outcome: "absent" } });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    expect(abandonIdempotent).toHaveBeenCalledTimes(1);
    expect(completeIdempotent).not.toHaveBeenCalled();
  });

  it("🔴 does NOT release it when Rekaz answers 2xx with no payment link", async () => {
    // The booking exists and is unpayable. Holding the key is the whole point.
    createReservation.mockResolvedValue({
      ok: true,
      value: { invoiceId: "inv-1", reservationIds: ["r1"], paymentLink: "" },
    });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    expect(abandonIdempotent).not.toHaveBeenCalled();
    expect(completeIdempotent).toHaveBeenCalledTimes(1);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it("DOES release it when Rekaz definitively refused", async () => {
    // A 400 means nothing was created, so the visitor must be able to fix the
    // problem and retry with the same key.
    createReservation.mockResolvedValue({
      ok: false,
      error: { code: "internal", message: "Rekaz 400 on POST /reservations/bulk" },
    });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    expect(abandonIdempotent).toHaveBeenCalledTimes(1);
  });

  it("DOES release it when nothing was ever dispatched", async () => {
    // A missing slot is rejected before any HTTP call. Holding the key here
    // would wedge a visitor who simply forgot to pick a time.
    const result = await createBooking({
      ...REQUEST,
      slotFrom: undefined,
      slotTo: undefined,
    });

    expect(result.ok).toBe(false);
    expect(createReservation).not.toHaveBeenCalled();
    expect(abandonIdempotent).toHaveBeenCalledTimes(1);
  });

  it("stores the result on success so a retry replays it", async () => {
    createReservation.mockResolvedValue({
      ok: true,
      value: { invoiceId: "inv-1", reservationIds: ["r1"], paymentLink: "/orders/pay/AAA" },
    });

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(true);
    expect(abandonIdempotent).not.toHaveBeenCalled();
    if (result.ok) {
      // Absolutised, or the buyer lands on our own 404 at the payment step.
      expect(result.value.paymentLink).toBe(
        "https://platform.rekaz.io/orders/pay/AAA"
      );
    }
  });
});

describe("replaying a key", () => {
  it("returns the ORIGINAL payment link rather than booking again", async () => {
    beginIdempotent.mockResolvedValue({
      ok: true,
      value: {
        kind: "replay",
        status: 201,
        body: { paymentLink: "https://platform.rekaz.io/orders/pay/FIRST", invoiceId: "inv-1" },
      },
    } as never);

    const result = await createBooking({ ...REQUEST });

    expect(createReservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.paymentLink).toContain("FIRST");
  });

  it("🔴 refuses when the earlier attempt was indeterminate", async () => {
    // A previous try reached Rekaz and never got an answer. Handing back a
    // payment link would be a guess; booking again would be a duplicate.
    beginIdempotent.mockResolvedValue({
      ok: true,
      value: {
        kind: "replay",
        status: 409,
        body: {
          __mazj_booking_indeterminate__: true,
          space: "meeting-room",
          reason: "timeout",
          at: "2026-07-27T19:00:00Z",
          reference: "15284726",
        },
      },
    } as never);

    const result = await createBooking({ ...REQUEST });

    expect(createReservation).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("conflict");
      // The reference survives the replay, so a customer who reloads and tries
      // again still gets the number they need to ring MAZJ with.
      expect(result.error.fields?.reference).toBe("15284726");
    }
  });

  it("refuses a stored body that is not a usable result", async () => {
    // Previously an unchecked cast, so a malformed row became a redirect to
    // `undefined`.
    beginIdempotent.mockResolvedValue({
      ok: true,
      value: { kind: "replay", status: 201, body: { nonsense: true } },
    } as never);

    const result = await createBooking({ ...REQUEST });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("conflict");
  });
});

/**
 * 🔴 The question, not the answer.
 *
 * Everything above asserts what the service DOES with each reconciliation
 * outcome. Nothing above asserts what it ASKED, and the two are not the same
 * risk: a mocked reconcile returns whatever the test says regardless of its
 * arguments, so every branch above stays green while the real call goes out
 * describing a booking nobody made.
 *
 * ⚠️ Then it comes back `absent`, because nothing matches. `absent` is the
 * CONFIDENT answer: the key is released and the customer is invited to try
 * again, on top of a booking that already exists. So a silent drift in either
 * argument does not degrade this machinery, it INVERTS it, on the one path that
 * exists to stop a second invoice.
 */
describe("what reconciliation is asked", () => {
  const TIMED_OUT = {
    ok: false as const,
    error: {
      code: "upstream_unavailable",
      message: "Rekaz did not respond within 10000ms",
    },
  };

  it("🔴 names THIS slot's start and the number as Rekaz stores it", async () => {
    // `slotFrom` and `slotTo` are both in scope at the call site and either
    // compiles. `reconcileReservation` matches a row on `startAt` equality, so
    // `slotTo` finds nothing, ever. The mobile is the same kind of trap from the
    // other direction: it is both the upstream filter and the equality check
    // against what Rekaz stored, which is `966534600488`. The national `05…`
    // form the visitor types is neither a substring of that nor equal to it, so
    // it matches nothing on either look.
    createReservation.mockResolvedValue(TIMED_OUT);

    await createBooking({ ...REQUEST });

    expect(reconcileReservation).toHaveBeenCalledWith({
      mobile: NORMALISED_MOBILE,
      slotFrom: REQUEST.slotFrom,
    });
    // A reservation reconciled through the subscription seam would search by
    // customer id and answer about a different resource entirely.
    expect(reconcileSubscription).not.toHaveBeenCalled();
  });

  it("🔴 names THIS customer and THIS start date on the subscription flow", async () => {
    // The subscription arm reaches Rekaz only through the customer it found
    // before the write, so the lookup argument is load-bearing twice: it decides
    // the payload, and then it decides what reconciliation can see.
    findCustomerByMobile.mockResolvedValue({
      ok: true,
      value: { kind: "found", customer: MEMBER },
    });
    createSubscription.mockResolvedValue(TIMED_OUT);

    await createBooking({ ...SUBSCRIPTION_REQUEST });

    expect(findCustomerByMobile).toHaveBeenCalledWith(NORMALISED_MOBILE);
    expect(reconcileSubscription).toHaveBeenCalledWith({
      customerId: MEMBER.id,
      startAt: SUBSCRIPTION_REQUEST.startAt,
    });
    expect(reconcileReservation).not.toHaveBeenCalled();
  });
});
