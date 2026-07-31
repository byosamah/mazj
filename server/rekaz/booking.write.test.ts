import { beforeEach, describe, expect, it, vi } from "vitest";

import { createReservation, createSubscription } from "./booking";

/**
 * The exact JSON MAZJ posts to the two endpoints that take money.
 *
 * 🔴 WHY A TEST IS THE ONLY PLACE THIS CAN BE CHECKED. There is no Rekaz
 * sandbox, so the body these two functions build can never be tried against a
 * test tenant: every POST creates a real booking and a real invoice in the
 * tenant operations works from. And Rekaz has no idempotency, so a wrong body
 * discovered in production cannot be safely re-sent while somebody works out
 * what changed. The request shape has to be pinned before it leaves.
 *
 * ⚠️ NOT the same job as `server/services/booking.customer.test.ts` and
 * `booking.customFields.test.ts`, which mock these two functions away and assert
 * on the ARGUMENTS the service hands them. Those pin what the service decides.
 * This file pins what the transport then EMITS, which is a separate step with
 * its own rules: `createReservation` collapses the two identity fields, and it
 * adds a field of its own that no caller passes.
 *
 * ⚠️ `./client` is mocked, so nothing here reaches the network. Do not "improve"
 * that into a real request under any condition, credentials included: there is
 * no tenant these two functions can be pointed at that is not the live one. See
 * the file header of `./booking.ts`.
 */

const rekazRequest = vi.fn();

vi.mock("./client", () => ({
  rekazRequest: (...args: unknown[]) => rekazRequest(...args),
}));

const RECEIPT = {
  ok: true as const,
  value: {
    invoiceId: "inv-1",
    reservationIds: ["r-1"],
    paymentLink: "/orders/pay/RMogHOPQc47FStqK",
  },
};

const BRANCH = "branch-1";

/**
 * A fixture number, deliberately not a real MAZJ line.
 *
 * ⚠️ Do not paste `+966534600488` in here: that is MAZJ's OWN WhatsApp number
 * (`lib/contact.ts`), and a test using it reads as though the business were its
 * own customer.
 */
const DETAILS = { name: "First Timer", mobileNumber: "+966512345678" };
const CUSTOMER_ID = "known-customer-id";

/**
 * One hour of the meeting room. `from` and `to` are the shape a chosen slot
 * reports, in UTC, and they are meant to survive this function untouched:
 * recomputing them locally is the timezone bug the slot response already solved.
 */
const ITEM = {
  priceId: "live-price-id",
  quantity: 1,
  from: "2026-08-10T17:00:00Z",
  to: "2026-08-10T18:00:00Z",
};

/**
 * What actually goes down the wire.
 *
 * `client.ts` serialises the body with `JSON.stringify`, which DROPS a key whose
 * value is `undefined`. So "is the key there" has to be asked of the serialised
 * form, not of the object: `{customerDetails: undefined}` reads as present in
 * JavaScript and is absent by the time Rekaz sees it, and the assertions below
 * are about what Rekaz sees.
 */
function wireBody(): Record<string, unknown> {
  const call = rekazRequest.mock.calls[0]![0] as { body: unknown };
  return JSON.parse(JSON.stringify(call.body)) as Record<string, unknown>;
}

beforeEach(() => {
  rekazRequest.mockReset();
  rekazRequest.mockResolvedValue(RECEIPT);
});

describe("createReservation", () => {
  /**
   * The whole call in one assertion, which is the point of writing it this way:
   * `toHaveBeenCalledWith` fails on a key ADDED to the body as well as on one
   * changed, so a field somebody slips into this POST cannot arrive silently.
   * A per-field test would pass straight through the addition.
   */
  it("emits exactly this request and nothing else", async () => {
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerDetails: DETAILS,
    });

    expect(rekazRequest).toHaveBeenCalledTimes(1);
    expect(rekazRequest).toHaveBeenCalledWith({
      path: "/reservations/bulk",
      method: "POST",
      body: {
        branchId: BRANCH,
        customerDetails: DETAILS,
        items: [ITEM],
        respectPackageUsageLimits: true,
      },
    });
  });

  /**
   * 🔴 `respectPackageUsageLimits` is server-side enforcement of package usage
   * limits, and it appears exactly ONCE in this entire tree: the line in
   * `booking.ts` that builds this body. Nothing else references it, so if it
   * were dropped in a refactor there would be no second occurrence to notice,
   * no type error, and no failing assertion anywhere. Rekaz would simply stop
   * enforcing the limit, and the only remaining check on how much of a package
   * a customer spends would be a quantity the browser sent us.
   *
   * Asserted on BOTH identity branches because the identity spread sits between
   * `branchId` and `items` in the same object literal, so an edit to the spread
   * is an edit adjacent to this field.
   */
  it("🔴 keeps package usage limits enforced server-side, on both identity branches", async () => {
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerDetails: DETAILS,
    });
    expect(wireBody().respectPackageUsageLimits).toBe(true);

    rekazRequest.mockClear();
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerId: CUSTOMER_ID,
    });
    expect(wireBody().respectPackageUsageLimits).toBe(true);
  });

  /**
   * 🔴 The payload Rekaz refuses. MEASURED 2026-07-28 against the live tenant:
   * `customerDetails` carrying a mobile Rekaz already holds returns HTTP 403,
   * `رقم الجوال مسجل مسبقاً لعميل آخر`, and that took booking down for every
   * returning customer on the day it shipped.
   *
   * `CreateReservationInput` declares both fields optional, so a caller passing
   * both is representable and `tsc` says nothing about it. What stops it
   * reaching Rekaz is this function's ternary spread, and that is the thing
   * being pinned: the service having only ever passed one is pinned separately
   * in `server/services/booking.customer.test.ts` and is not the same guarantee.
   */
  it("🔴 never lets both identities onto the wire, even when handed both", async () => {
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerId: CUSTOMER_ID,
      customerDetails: DETAILS,
    });

    const keys = Object.keys(wireBody());
    expect(keys).toContain("customerId");
    expect(
      keys,
      "sent customerDetails alongside customerId: Rekaz answers 403"
    ).not.toContain("customerDetails");
  });

  it("sends the details alone when there is no id to send", async () => {
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerDetails: DETAILS,
    });

    const keys = Object.keys(wireBody());
    expect(keys).toContain("customerDetails");
    expect(keys).not.toContain("customerId");
  });

  /**
   * The items array is forwarded verbatim, and this pins that the transport
   * invents nothing on the way past.
   *
   * ⚠️ Which keys the SERVICE puts on an item, including that a product with no
   * declared custom fields gets no `customFields` key at all, belongs to
   * `server/services/booking.customFields.test.ts`. The complementary half is
   * here: an item that arrived without the key must not gain an empty one, and
   * an item that arrived with it must not have its GUIDs touched.
   */
  it("forwards items verbatim and adds no customFields of its own", async () => {
    await createReservation({
      branchId: BRANCH,
      items: [ITEM],
      customerDetails: DETAILS,
    });

    const items = wireBody().items as Record<string, unknown>[];
    expect(items).toEqual([ITEM]);
    expect(Object.keys(items[0]!)).not.toContain("customFields");
  });

  it("passes custom fields through under the field's own name GUID", async () => {
    // Keyed by the custom field's `name`, which is a GUID and not its label.
    const customFields = { "3a14ba65-3e22-d2f1-b556-5b32d8ca8be6": "40" };

    await createReservation({
      branchId: BRANCH,
      items: [{ ...ITEM, customFields }],
      customerDetails: DETAILS,
    });

    const items = wireBody().items as { customFields?: unknown }[];
    expect(items[0]!.customFields).toEqual(customFields);
  });
});

describe("createSubscription", () => {
  const START_AT = "2026-08-10";

  /**
   * Whole-call again, and it is the one place the two write bodies are written
   * down side by side: this one carries `startAt` and does NOT carry
   * `respectPackageUsageLimits`. Stated as an assertion rather than as prose so
   * a change in either direction shows up as a failure rather than as a
   * paragraph somebody has to remember to update.
   */
  it("emits exactly this request and nothing else", async () => {
    await createSubscription({
      branchId: BRANCH,
      startAt: START_AT,
      items: [{ priceId: "live-price-id", quantity: 1 }],
      customerDetails: DETAILS,
    });

    expect(rekazRequest).toHaveBeenCalledTimes(1);
    expect(rekazRequest).toHaveBeenCalledWith({
      path: "/subscriptions",
      method: "POST",
      body: {
        branchId: BRANCH,
        startAt: START_AT,
        customerDetails: DETAILS,
        items: [{ priceId: "live-price-id", quantity: 1 }],
      },
    });
  });

  /**
   * The same pair of fields with the same exclusivity, and the same returning
   * customers: two of MAZJ's four products are sold on this endpoint, so a
   * refusal here is half the catalogue rather than an edge of it.
   */
  it("🔴 never lets both identities onto the wire, even when handed both", async () => {
    await createSubscription({
      branchId: BRANCH,
      startAt: START_AT,
      items: [{ priceId: "live-price-id", quantity: 1 }],
      customerId: CUSTOMER_ID,
      customerDetails: DETAILS,
    });

    const keys = Object.keys(wireBody());
    expect(keys).toContain("customerId");
    expect(
      keys,
      "sent customerDetails alongside customerId: Rekaz answers 403"
    ).not.toContain("customerDetails");
  });
});
