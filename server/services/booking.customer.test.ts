import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * How a booking is bound to a Rekaz customer, and why it is bound that way.
 *
 * 🔴 THIS TEST ENCODES A CONSTRAINT WE DO NOT CONTROL. Read the whole comment
 * before changing an assertion.
 *
 * The obvious way to stop the impersonation risk on a public booking form is to
 * stop adopting an existing customer id and always send the submitted details.
 * We shipped exactly that on 2026-07-28 and it took booking down for every
 * returning customer, because Rekaz refuses it.
 *
 * MEASURED against the live API, same credential, same headers:
 *
 *   customerDetails whose mobileNumber already belongs to a customer
 *     -> HTTP 403, "رقم الجوال مسجل مسبقاً لعميل آخر"
 *   customerDetails with an unknown mobile  -> accepted
 *   customerId                              -> accepted
 *
 * Rekaz neither deduplicates nor creates a second record. It refuses. So for a
 * customer already in the tenant there is exactly ONE representable payload, and
 * these tests pin it so the well-intentioned "fix" cannot be reapplied blind.
 *
 * The impersonation risk is therefore NOT closed here, and cannot be: closing it
 * needs proof that the submitter holds the number, and Rekaz exposes no way to
 * verify one. What IS enforced below is the half we control: a matched account
 * never has the submitter's name or email written onto it.
 */

const VICTIM = {
  id: "victim-customer-id",
  name: "A Real Member",
  mobileNumber: "+966534357169",
  email: "member@example.com",
  // 🔴 Stated rather than omitted. This field is now READ on the booking path,
  // and a fixture that simply left it off would exercise the ordinary branch by
  // accident while looking like it had made a choice.
  isBlocked: false,
};

/** The same account after MAZJ blocked it in the Rekaz dashboard. */
const BLOCKED = { ...VICTIM, id: "blocked-customer-id", isBlocked: true };

const createReservation = vi.fn(async (_input: Record<string, unknown>) => ({
  ok: true as const,
  value: { invoiceId: "inv-1", reservationIds: ["r-1"], paymentLink: "/orders/pay/X" },
}));
const createSubscription = vi.fn(async (_input: Record<string, unknown>) => ({
  ok: true as const,
  value: { invoiceId: "inv-2", reservationIds: ["r-2"], paymentLink: "/orders/pay/Y" },
}));
// Annotated against the real union, not inferred: `vi.fn(async () => X)` narrows
// its return type to X, so `mockResolvedValueOnce(...)` for any other outcome
// would fail tsc while vitest itself passed. Documented trap in server/CLAUDE.md.
//
// 🔴 FOUR OUTCOMES, and the shape mirrors `CustomerMatch` in `rekaz/booking.ts`
// deliberately. A mock that still answered "a customer or null" would be
// asserting against an interface that no longer exists: `null` now reaches
// `lookup.kind` and throws, rather than reading as "no such customer".
type Match =
  | { kind: "found"; customer: typeof VICTIM }
  | { kind: "none" }
  | { kind: "ambiguous"; count: number };
type CustomerLookup =
  | { ok: true; value: Match }
  | { ok: false; error: { code: string; message: string } };
const findCustomerByMobile = vi.fn(
  async (): Promise<CustomerLookup> => ({
    ok: true,
    value: { kind: "found", customer: VICTIM },
  })
);

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

vi.mock("@/server/rekaz/reservations", () => ({
  getSlots: async () => ({
    ok: true,
    value: [{ from: "2026-08-10T17:00:00Z", to: "2026-08-10T18:00:00Z" }],
  }),
}));

vi.mock("@/server/rekaz/reconcile", () => ({
  reconcileReservation: async () => ({ ok: true, value: { outcome: "absent" } }),
  reconcileSubscription: async () => ({ ok: true, value: { outcome: "absent" } }),
}));

vi.mock("@/server/rekaz/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/rekaz/booking")>();
  return {
    ...actual,
    findCustomerByMobile: (...a: unknown[]) => findCustomerByMobile(...(a as [])),
    createReservation: (input: Record<string, unknown>) => createReservation(input),
    createSubscription: (input: Record<string, unknown>) => createSubscription(input),
  };
});

const { createBooking } = await import("@/server/services/booking");

const IP = { ip: "81.10.0.1", attested: true } as const;

/** An attacker: their own name and email, the victim's number. */
const ATTACKER = {
  name: "Someone Else",
  mobile: "0534357169",
  email: "attacker@example.com",
};

const RESERVATION_REQUEST = {
  space: "meeting-room",
  priceImmutableId: "stable-price-id",
  slotFrom: "2026-08-10T17:00:00Z",
  slotTo: "2026-08-10T18:00:00Z",
  customer: ATTACKER,
  idempotencyKey: "key-abc-12345",
  ip: IP,
};

const SUBSCRIPTION_REQUEST = {
  space: "coworking",
  priceImmutableId: "stable-price-id",
  startAt: "2026-08-10",
  customer: ATTACKER,
  idempotencyKey: "key-def-12345",
  ip: IP,
};

beforeEach(() => {
  createReservation.mockClear();
  createSubscription.mockClear();
});

describe("a returning customer is bound by customerId, because Rekaz requires it", () => {
  it("sends customerId and NOT the submitted details when the number matches", async () => {
    const result = await createBooking(RESERVATION_REQUEST);
    expect(result.ok).toBe(true);

    const payload = createReservation.mock.calls[0]![0];

    // Forced by the API: customerDetails with this mobile returns 403.
    expect(payload.customerId).toBe(VICTIM.id);

    // The half we DO control. A stranger who books against someone else's number
    // must not be able to repoint that customer's name or contact details.
    expect(payload.customerDetails).toBeUndefined();
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("Someone Else");
    expect(serialised).not.toContain("attacker@example.com");
  });

  it("does the same on the subscription flow", async () => {
    const result = await createBooking(SUBSCRIPTION_REQUEST);
    expect(result.ok).toBe(true);

    const payload = createSubscription.mock.calls[0]![0];

    expect(payload.customerId).toBe(VICTIM.id);
    expect(payload.customerDetails).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("attacker@example.com");
  });

  /**
   * Rekaz rejects a payload carrying both, so the exclusivity is not a style
   * preference. Asserting on the wire format keeps it true through a refactor.
   */
  it("never sends both identities at once", async () => {
    await createBooking(RESERVATION_REQUEST);
    const payload = createReservation.mock.calls[0]![0];

    const hasId = payload.customerId !== undefined;
    const hasDetails = payload.customerDetails !== undefined;
    expect(hasId !== hasDetails).toBe(true);
  });
});

describe("an unknown number creates a customer from what was typed", () => {
  beforeEach(() =>
    findCustomerByMobile.mockResolvedValueOnce({ ok: true, value: { kind: "none" } })
  );

  it("sends customerDetails carrying the submitted values", async () => {
    await createBooking({ ...RESERVATION_REQUEST, idempotencyKey: "key-new-12345" });
    const payload = createReservation.mock.calls[0]![0];

    expect(payload.customerId).toBeUndefined();
    expect(payload.customerDetails).toEqual({
      name: "Someone Else",
      mobileNumber: "+966534357169",
      email: "attacker@example.com",
    });
  });

  it("omits email entirely rather than inventing one when none was typed", async () => {
    await createBooking({
      ...RESERVATION_REQUEST,
      customer: { name: "No Email", mobile: "0534357169" },
      idempotencyKey: "key-noemail-123",
    });
    const details = createReservation.mock.calls[0]![0].customerDetails as Record<
      string,
      unknown
    >;
    expect(Object.keys(details)).not.toContain("email");
  });

  it("drops an email that is not shaped like an address", async () => {
    await createBooking({
      ...RESERVATION_REQUEST,
      customer: { name: "Bad Email", mobile: "0534357169", email: "not-an-email" },
      idempotencyKey: "key-bademail-12",
    });
    const details = createReservation.mock.calls[0]![0].customerDetails as Record<
      string,
      unknown
    >;
    expect(Object.keys(details)).not.toContain("email");
  });
});

describe("an account MAZJ has blocked cannot buy", () => {
  /**
   * 🔴 `isBlocked` was typed on the Rekaz customer and read nowhere, so a
   * booking against a blocked account adopted that account's id and billed it
   * exactly like any other. Blocking somebody in the Rekaz dashboard has to mean
   * something on the site that sells to them.
   */
  it("refuses before anything is dispatched", async () => {
    findCustomerByMobile.mockResolvedValueOnce({
      ok: true,
      value: { kind: "found", customer: BLOCKED },
    });

    const result = await createBooking({
      ...RESERVATION_REQUEST,
      idempotencyKey: "key-blocked-123",
    });

    expect(result.ok, "a blocked account was sold a room").toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
    expect(createReservation).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ The COPY behind `forbidden` must not confirm the block. The form is
   * public and the number is unverified, so "your account is blocked" would tell
   * anyone who knows a member's number that the member is blocked. The action
   * returns a code and the page renders its own sentence, which is what makes
   * that a copy decision rather than a code one. Asserted here because the code
   * is the only part of it this layer controls.
   */
  it("says so with a CODE and never with a message the browser could read", async () => {
    findCustomerByMobile.mockResolvedValueOnce({
      ok: true,
      value: { kind: "found", customer: BLOCKED },
    });

    const result = await createBooking({
      ...RESERVATION_REQUEST,
      idempotencyKey: "key-blocked-456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // No field-level detail, so the form cannot highlight the mobile input and
      // turn the refusal into a hint about whose number this is.
      expect(result.error.fields).toBeUndefined();
    }
  });
});

describe("two accounts sharing one number cannot be billed", () => {
  /**
   * 🔴 There is no representable payload. `customerDetails` is refused because
   * Rekaz already owns the number; choosing one of the two ids bills somebody
   * who may not be the buyer, which is a support problem that looks like fraud.
   * Only a human merging the duplicate upstream can unblock it, which is exactly
   * what `forbidden`'s "message us" copy asks for.
   */
  it("refuses rather than guessing which customer to charge", async () => {
    findCustomerByMobile.mockResolvedValueOnce({
      ok: true,
      value: { kind: "ambiguous", count: 2 },
    });

    const result = await createBooking({
      ...RESERVATION_REQUEST,
      idempotencyKey: "key-ambiguous-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("forbidden");
    expect(createReservation).not.toHaveBeenCalled();
  });
});

describe("a lookup we could not make is not the same as no such customer", () => {
  /**
   * 🔴 The two used to collapse into the same `undefined`, and they lead to
   * OPPOSITE payloads. On a failed lookup the booking went out carrying
   * `customerDetails` for a number Rekaz may already own, which is the one
   * payload Rekaz refuses: 403, mapped to `internal`, rendered to the buyer as
   * "Something went wrong on our side". 284 customers are already in that
   * tenant, so that is the common case failing.
   *
   * ⚠️ THE COST OF THIS FIX, stated plainly because it is a trade and not a free
   * win: a genuinely NEW customer, whose number Rekaz has never seen, would
   * previously have booked successfully straight through a lookup blip and is
   * now told to try again in a moment. That is the deliberate half. The error is
   * retryable, the idempotency key is released, and the same key works on the
   * retry, which is not true of the 403 it replaces.
   */
  it("refuses retryably rather than sending a payload Rekaz would reject", async () => {
    findCustomerByMobile.mockResolvedValueOnce({
      ok: false,
      error: { code: "upstream_unavailable", message: "Rekaz did not respond" },
    });

    const result = await createBooking({
      ...RESERVATION_REQUEST,
      idempotencyKey: "key-lookupdown-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("upstream_unavailable");
    expect(
      createReservation,
      "dispatched a booking on a payload we could already predict Rekaz refuses"
    ).not.toHaveBeenCalled();
  });
});
