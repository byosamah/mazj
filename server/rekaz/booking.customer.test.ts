import { beforeEach, describe, expect, it, vi } from "vitest";

import { findCustomerByMobile } from "./booking";

/**
 * The customer lookup at the REKAZ CLIENT layer, which nothing pinned until
 * 2026-07-28.
 *
 * ⚠️ Not to be confused with `server/services/booking.customer.test.ts`, which
 * has a similar name and a different job: that one owns the BOOKING SERVICE's
 * use of this function (whether a booking binds to a stranger's account), and it
 * is the regression pin on a real outage. This file owns the query itself: what
 * goes out to Rekaz, and how each of the three answers is read.
 *
 * 🔴 One call decides whether a booking binds to a Rekaz account that already
 * exists or creates a new one, and getting it wrong is not cosmetic: Rekaz
 * REFUSES a `customerDetails` payload carrying a number it already holds, with a
 * 403 and an Arabic message. So a missed match is a booking that dies at the
 * last step for exactly the customers who have bought before, surfacing as the
 * generic `internal` copy.
 *
 * ⚠️ `./client` is mocked rather than hit: there is no Rekaz sandbox, and
 * `GET /customers` on the live tenant returns MAZJ's entire customer list.
 */

const rekazRequest = vi.fn();

vi.mock("./client", () => ({
  rekazRequest: (...args: unknown[]) => rekazRequest(...args),
}));

/**
 * A fixture number, deliberately not a real MAZJ line.
 *
 * ⚠️ Do not paste `+966534600488` in here. That is MAZJ's OWN WhatsApp number
 * (`lib/contact.ts`), and a test that uses it reads as though the business were
 * its own customer, which is exactly the confusion this function exists to
 * avoid.
 */
const E164 = "+966512345678";
/** The same line without the plus, which Rekaz was measured to accept too. */
const DIGITS = "966512345678";

function customer(id: string) {
  return {
    id,
    name: "MAZJ member",
    customerNumber: null,
    mobileNumber: E164,
    email: null,
    isBlocked: false,
  };
}

beforeEach(() => {
  rekazRequest.mockReset();
});

describe("findCustomerByMobile", () => {
  it("sends the E.164 form first, plus and all", async () => {
    rekazRequest.mockResolvedValue({
      ok: true,
      value: { totalCount: 1, items: [customer("c1")] },
    });

    const result = await findCustomerByMobile(E164);

    expect(rekazRequest).toHaveBeenCalledTimes(1);
    expect(rekazRequest).toHaveBeenCalledWith({
      path: "/customers",
      query: { mobileNumber: E164, maxResultCount: 2 },
    });
    expect(result).toEqual({
      ok: true,
      value: { kind: "found", customer: customer("c1") },
    });
  });

  it("falls back to the digits-only form when the plus finds nobody", async () => {
    // ⚠️ Belt and braces, not a fix for a known break. Measured 2026-07-28: the
    // live filter tolerates both forms and returns the same single row, so this
    // second query does not fire today. The test is what makes the tolerance a
    // property of OUR code rather than of theirs, because an upstream tolerance
    // can be withdrawn in a deploy nobody tells us about and the symptom would
    // be returning customers suddenly unable to book.
    rekazRequest
      .mockResolvedValueOnce({ ok: true, value: { totalCount: 0, items: [] } })
      .mockResolvedValueOnce({
        ok: true,
        value: { totalCount: 1, items: [customer("c2")] },
      });

    const result = await findCustomerByMobile(E164);

    expect(rekazRequest).toHaveBeenCalledTimes(2);
    expect(rekazRequest).toHaveBeenLastCalledWith({
      path: "/customers",
      query: { mobileNumber: DIGITS, maxResultCount: 2 },
    });
    expect(result).toEqual({
      ok: true,
      value: { kind: "found", customer: customer("c2") },
    });
  });

  it("🔴 costs exactly one call when the first form matches", async () => {
    // The fallback must never become a second round trip on the common path.
    // This runs inside a booking submit, against an API measured between 1.2s
    // and 10.8s, and 287 of MAZJ's customers were already in that tenant on
    // 2026-07-28. Every one of them takes this path.
    rekazRequest.mockResolvedValue({
      ok: true,
      value: { totalCount: 1, items: [customer("c1")] },
    });

    await findCustomerByMobile(E164);

    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });

  it("reports nobody as `none`, and does not retry a form it already sent", async () => {
    rekazRequest.mockResolvedValue({
      ok: true,
      value: { totalCount: 0, items: [] },
    });

    const result = await findCustomerByMobile(DIGITS);

    expect(result).toEqual({ ok: true, value: { kind: "none" } });
    // Digits in, digits out: there is no other form left to try, so the
    // fallback must not fire and double the wait for nothing.
    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });

  it("🔴 reports two customers sharing a number as ambiguous, distinctly from none", async () => {
    // Both outcomes refuse to bind the booking, and that is correct: guessing
    // which of two accounts to bill is worse than creating a new record. What
    // the caller MUST be able to see is which of the two happened. "Nobody has
    // this number" ends in a new customer and is routine; "two people do" is a
    // data problem somebody has to fix in the Rekaz dashboard, and it was
    // invisible while both came back as null.
    rekazRequest.mockResolvedValue({
      ok: true,
      value: { totalCount: 2, items: [customer("c1"), customer("c2")] },
    });

    const result = await findCustomerByMobile(E164);

    expect(result).toEqual({
      ok: true,
      value: { kind: "ambiguous", count: 2 },
    });
    // No fallback: the answer was not "nobody", so there is nothing to retry.
    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });

  it("passes an upstream failure through rather than reporting nobody", async () => {
    // 🔴 The distinction the booking service depends on. A failed lookup read as
    // "no such customer" sends `customerDetails` for someone Rekaz already
    // holds, and Rekaz answers 403.
    rekazRequest.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "Rekaz timed out" },
    });

    const result = await findCustomerByMobile(E164);

    expect(result.ok).toBe(false);
    // A failed call is not a miss, so the fallback must not turn one outage into
    // two requests against an upstream that has just proven it is unwell.
    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });
});
