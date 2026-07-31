import { beforeEach, describe, expect, it, vi } from "vitest";

import { matchReservation, reconcileReservation } from "./reconcile";
import type { RekazReservation } from "./types";

/**
 * "Did the booking we never got an answer to actually land?"
 *
 * This runs only after a Rekaz POST times out, which on this tenant is a
 * routine Tuesday (measured 1.2s to 10.8s against a 10s ceiling). Getting it
 * wrong is not a rendering bug: `absent` releases the idempotency key and lets
 * the customer book again, so a wrong `absent` is a second real reservation and
 * a second real invoice.
 *
 * 🔴 THE PROPERTY THIS SUITE DEFENDS. `customerMobile` is the one filter
 * `GET /reservations` honours, and using it makes finding a booking exact and
 * cheap. But an empty FILTERED response cannot be told apart from the filter
 * having quietly changed upstream, on an API with no version and no changelog,
 * while we send E.164 with a leading plus that one exact-match tightening would
 * stop matching. So the filtered call is an optimisation and never the sole
 * evidence: several cases below pin that `absent` requires the unfiltered
 * creation-ordered scan to agree. Deleting the fallback would pass every other
 * test in the repository and invoice people twice.
 *
 * ⚠️ `./client` is mocked rather than `./reservations`, for the reason spelled
 * out in `catalog.test.ts`: `reconcileReservation` reaches Rekaz through a
 * sibling module's local binding, so intercepting the layer underneath is what
 * actually works.
 */

type RekazCall = { path: string; query?: Record<string, unknown> };

/** E.164, as this site sends it. Not a real number. */
const MOBILE = "+966512345678";
/** The same number as Rekaz STORES it: no plus. Verified on real rows. */
const STORED = "966512345678";
const SLOT = "2026-09-12T15:00:00Z";
const NOW = new Date("2026-07-28T10:01:00Z");
/** Inside the 5-minute attribution window. */
const JUST_NOW = "2026-07-28T10:00:30Z";

const rekazRequest = vi.fn();

vi.mock("./client", () => ({
  rekazRequest: (...args: unknown[]) => rekazRequest(...args),
}));

function reservation(
  overrides: Partial<RekazReservation> = {}
): RekazReservation {
  return {
    id: "res-1",
    startAt: SLOT,
    endAt: "2026-09-12T18:00:00Z",
    status: "Pending",
    customStatus: null,
    customerId: "cus-1",
    customerName: "",
    customerMobile: STORED,
    reservationNumber: 4211,
    productName: "Events hall",
    priceName: "Evening",
    quantity: 1,
    providers: null,
    branchId: "b1",
    branchName: "MAZJ",
    orderPaymentStatusString: "Unpaid",
    reservationTotalAmount: 690,
    remainingAmount: 690,
    cancellationReason: null,
    creationTime: JUST_NOW,
    source: null,
    ...overrides,
  };
}

function page(items: RekazReservation[]) {
  return { ok: true, value: { totalCount: items.length, items } };
}

const UPSTREAM_DOWN = {
  ok: false,
  error: { code: "upstream_unavailable", message: "Rekaz timed out" },
};

/** True for the `customerMobile` query, false for the unfiltered scan. */
function isFiltered(options: RekazCall): boolean {
  return options.query?.customerMobile !== undefined;
}

/**
 * Serves a different answer to the filtered query and to the unfiltered scan,
 * which is the only way to tell the two looks apart in an assertion.
 */
function serve(filtered: unknown, unfiltered: unknown): void {
  rekazRequest.mockImplementation(async (options: RekazCall) =>
    isFiltered(options) ? filtered : unfiltered
  );
}

beforeEach(() => {
  rekazRequest.mockReset();
});

describe("matchReservation", () => {
  it("matches on mobile, exact start and recency together", () => {
    expect(matchReservation([reservation()], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "found",
      reference: "4211",
    });
  });

  it("🔴 refuses a longer number that merely CONTAINS ours", () => {
    // Rekaz's `customerMobile` filter is a SUBSTRING match, measured
    // 2026-07-28: a four-digit fragment matched real rows. So the filtered
    // response can legitimately contain other people. Treating one as ours
    // hands a stranger's reservation number to our customer and tells them
    // their booking exists when it does not.
    const stranger = reservation({
      id: "someone-else",
      customerMobile: `${STORED}7`,
      reservationNumber: 9999,
    });

    expect(matchReservation([stranger], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "absent",
    });
  });

  it("🔴 answers unknown, never absent, when the matching row's mobile is blank", () => {
    // `customerMobile` comes back as an empty string on some older records.
    // `sameMobile` correctly refuses to match it, and falling through to
    // `absent` from there is the CONFIDENT answer: it releases the idempotency
    // key and invites the customer to book on top of a booking that exists.
    const blank = reservation({ customerMobile: "" });

    expect(matchReservation([blank], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "unknown",
    });
  });

  it("prefers a real match over a blank-mobile row in the same slot", () => {
    const rows = [
      reservation({ id: "blank", customerMobile: "", reservationNumber: 1 }),
      reservation({ id: "ours", reservationNumber: 4211 }),
    ];

    expect(matchReservation(rows, MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "found",
      reference: "4211",
    });
  });

  it("is absent when someone else holds the same slot", () => {
    // A different person, a real number, no substring relationship. Nothing
    // ambiguous here, so the customer may safely try again.
    const other = reservation({ customerMobile: "966500000001" });

    expect(matchReservation([other], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "absent",
    });
  });

  it("is absent when our own earlier booking is too old to be this attempt", () => {
    // Same person, same slot, created an hour ago: that is a booking they
    // already made, not the write we just dispatched.
    const earlier = reservation({ creationTime: "2026-07-28T09:00:00Z" });

    expect(matchReservation([earlier], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "absent",
    });
  });

  it("is absent when the same person booked a different slot", () => {
    const otherSlot = reservation({ startAt: "2026-09-12T16:00:00Z" });

    expect(matchReservation([otherSlot], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "absent",
    });
  });

  it("is absent on an empty list", () => {
    expect(matchReservation([], MOBILE, SLOT, NOW.getTime())).toEqual({
      outcome: "absent",
    });
  });
});

describe("reconcileReservation", () => {
  it("🔴 asks Rekaz for our own number instead of scanning page one", async () => {
    // Measured 2026-07-28: `customerMobile` takes 562 rows to 7 and reaches
    // records from January 2025. That is what makes this exact rather than
    // dependent on our row still being near the top of a creation-ordered list.
    serve(page([reservation()]), page([]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      value: { outcome: "found", reference: "4211" },
    });
    // A hit on the query needs no second look, which is the whole point of
    // using it: one request, no dependency on the list ordering.
    expect(rekazRequest).toHaveBeenCalledTimes(1);
    expect(rekazRequest).toHaveBeenCalledWith({
      path: "/reservations",
      query: { maxResultCount: 100, customerMobile: MOBILE },
    });
  });

  it("🔴 never answers absent on the strength of the filtered call alone", async () => {
    // THE MONEY-PATH ASSERTION. If Rekaz tightens `customerMobile` to an exact
    // match on its own stored format, our leading plus stops matching and every
    // filtered call returns a successful zero. Concluding `absent` there
    // releases the idempotency key and issues a second real reservation and a
    // second real invoice for every affected customer.
    serve(page([]), page([]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, value: { outcome: "absent" } });
    expect(rekazRequest).toHaveBeenCalledTimes(2);
    // The second look carries no filter at all, so it cannot inherit whatever
    // made the first one come back empty.
    expect(rekazRequest).toHaveBeenNthCalledWith(2, {
      path: "/reservations",
      query: { maxResultCount: 100 },
    });
  });

  it("🔴 finds the booking in the unfiltered scan when the filter returns nothing", async () => {
    // The failure the fallback exists for, shown end to end: the query says
    // there is nothing, the creation-ordered scan has our row at the top, and
    // the customer is correctly told their booking exists.
    serve(page([]), page([reservation()]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      value: { outcome: "found", reference: "4211" },
    });
    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });

  it("falls back to the unfiltered list when the filtered call fails", async () => {
    // The old behaviour, kept: the unfiltered list is ordered `creationTime`
    // DESC, so a booking created seconds ago is at the top of page one.
    serve(UPSTREAM_DOWN, page([reservation()]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      value: { outcome: "found", reference: "4211" },
    });
    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });

  it("🔴 holds the key when the filter FAILED and the scan found nothing", async () => {
    // Only one of the two looks actually happened, so the evidence is
    // incomplete. `absent` is a confident claim and this is not the moment to
    // make one: an incomplete look costs a conversation, a wrong absent costs
    // an invoice.
    serve(UPSTREAM_DOWN, page([]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, value: { outcome: "unknown" } });
    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });

  it("🔴 holds the key when a blank-mobile row survives an otherwise clean scan", async () => {
    // The query found a row in our slot, created seconds ago, carrying no
    // mobile to compare. The scan then found nothing at all. One ambiguous look
    // is enough to refuse the confident answer.
    serve(page([reservation({ customerMobile: "" })]), page([]));

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, value: { outcome: "unknown" } });
  });

  it("🔴 reports unknown, as a SUCCESS, when it cannot ask at all", async () => {
    // Not a failed Result: the caller must be able to act on "nothing may be
    // concluded", which means holding the idempotency key rather than
    // surfacing another upstream error.
    rekazRequest.mockResolvedValue(UPSTREAM_DOWN);

    const result = await reconcileReservation({
      mobile: MOBILE,
      slotFrom: SLOT,
      now: NOW,
    });

    expect(result).toEqual({ ok: true, value: { outcome: "unknown" } });
    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });
});
