import { describe, expect, it } from "vitest";

import type { AppError } from "@/server/core/errors";
import { scrubValue } from "@/server/core/logger";
import type { Result } from "@/server/core/result";
import { findCustomerByMobile, type RekazCustomer } from "@/server/rekaz/booking";
import { rekazRequest } from "@/server/rekaz/client";
import { listSubscriptions } from "@/server/rekaz/subscriptions";
import type { RekazPage } from "@/server/rekaz/types";

import { hasRekazCredentials } from "./setup";

/**
 * The two Rekaz filters this codebase actually bets on.
 *
 * Filtering is implemented on some Rekaz endpoints and not others, with nothing
 * in the documentation to tell them apart, and the ones that do not work fail
 * SILENTLY: they return the unfiltered list wearing the shape of a filtered one.
 * So every filter we rely on has to be verified against the live tenant rather
 * than read about. Two of them hold up real money:
 *
 *   `/customers?mobileNumber=`   decides whether a returning customer is booked
 *                                as `customerId`. Rekaz answers a booking that
 *                                sends `customerDetails` for a mobile it already
 *                                knows with a hard 403, so the day this filter
 *                                stops narrowing, EVERY returning customer's
 *                                booking fails, on both flows, at the last step.
 *   `/subscriptions?customerId=` is the only way to find a subscription created
 *                                by a POST that timed out. Without it,
 *                                reconciliation answers "unknown", the
 *                                idempotency key is held, and the customer is
 *                                told to contact us about a booking that very
 *                                likely never existed.
 *
 * 🔴 The mobile filter must tolerate the leading `+`. We hold numbers as E.164
 * and Rekaz stores them WITHOUT the plus, which is the shape of a comparison
 * that never matches and reports "not found" forever, in the safe-looking
 * direction, which is why it survives review.
 *
 * 🔴 EVERY ASSERTION HERE IS ABOUT DIRECTION, NOT ABOUT A COUNT. This is live
 * tenant data on a running business: rows are added hourly and one duplicate
 * record would turn an exact-count assertion red for a reason that has nothing
 * to do with the filter. What must hold is that the filter NARROWS and that
 * every row it returns really carries the value we asked for. A count is a fact
 * about Tuesday; those two are the properties the booking path depends on.
 *
 * ⚠️ READ-ONLY. This imports `server/rekaz/booking.ts`, which also exports the
 * two write calls that take MAZJ's money. Nothing here may call them. There is
 * no Rekaz sandbox, so every request below hits the tenant the operations team
 * works from.
 *
 * ⚠️ Skipped without credentials, so it does NOT run on a fresh clone or in CI.
 * That gap is upstream, not ours: Rekaz publishes no sandbox and no test tenant.
 *
 * 🔴 NO PHONE NUMBER IS HARDCODED HERE, AND NONE MAY BE PRINTED. The probe value
 * is read out of the live tenant and used only within the run. Committing a
 * customer's mobile into a repository to test a filter would be a PDPL
 * disclosure made to fix a correctness bug, which is a bad trade at any price,
 * and a failure message that echoes one turns every CI log into the same
 * disclosure. See `expectOk` below.
 */

/**
 * `unwrap()` with the customer's number taken back out of the failure.
 *
 * 🔴 Why not `unwrap`: it throws `JSON.stringify(error)`, and `AppError.message`
 * on a Rekaz 4xx is built from a bounded slice of the raw upstream body. Rekaz
 * runs ASP.NET Core, whose model binding echoes the submitted value verbatim, so
 * a failing `/customers?mobileNumber=<a real number>` prints that number into
 * the terminal and into any CI log holding the run. That is the same leak class
 * `test/booking-audit-log.test.ts` exists to pin, arriving through the test
 * harness instead of through the logger.
 *
 * `scrubValue` is the codebase's own control, reused rather than reimplemented,
 * so a shape it learns to catch is caught here too.
 */
function expectOk<T>(result: Result<T, AppError>, what: string): T {
  if (result.ok) return result.value;
  throw new Error(
    `${what} failed [${result.error.code}]: ${scrubValue(result.error.message)}`
  );
}

/** Digits only, so a stored `05…` and a sent `+966…` are comparable. */
function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

describe.skipIf(!hasRekazCredentials)("the Rekaz filters we bet on", () => {
  it("🔴 narrows /customers by mobileNumber, and tolerates the leading plus", async () => {
    const all = expectOk(
      await rekazRequest<RekazPage<RekazCustomer>>({
        path: "/customers",
        query: { maxResultCount: 20 },
      }),
      "unfiltered /customers"
    );

    // Whatever the tenant offers, rather than a record we created:
    // `mobileNumber` comes back empty on some older rows, hence a length check
    // on the digits rather than a bare truthiness test.
    const sample = all.items.find((c) => digitsOf(c.mobileNumber).length >= 9);
    expect(
      sample,
      "no customer on page 1 carries a mobile number to probe with"
    ).toBeDefined();

    const digits = digitsOf(sample!.mobileNumber);

    // Sent WITH the plus, which is the form this codebase holds numbers in.
    // Rekaz stores them without it, so this call is the whole question.
    const filtered = expectOk(
      await rekazRequest<RekazPage<RekazCustomer>>({
        path: "/customers",
        query: { mobileNumber: `+${digits}`, maxResultCount: 5 },
      }),
      "filtered /customers"
    );

    expect(
      filtered.totalCount,
      `the mobileNumber filter returned the whole customer list (${all.totalCount} ` +
        "rows). It has stopped filtering, and every returning customer's booking " +
        "now fails with a Rekaz 403"
    ).toBeLessThan(all.totalCount);

    // 🔴 The property `findCustomerByMobile` binds a booking on: a row that came
    // back really does carry the number we asked about. Stated as containment
    // rather than equality because the same parameter name on `/reservations`
    // is a substring match, and a caller must never assume which kind it got.
    expect(filtered.items.length).toBeGreaterThan(0);
    for (const customer of filtered.items) {
      expect(digitsOf(customer.mobileNumber)).toContain(digits);
    }

    // And the same question through the function the booking path calls, which
    // declines to bind on anything other than exactly one match rather than
    // guessing which customer to bill. `none` for a number read straight out of
    // the tenant means the lookup is blind, which is the outage.
    const match = expectOk(
      await findCustomerByMobile(`+${digits}`),
      "findCustomerByMobile"
    );
    expect(
      match.kind,
      "a number read out of this tenant looked up as no customer at all, so " +
        "every returning customer is about to be sent as customerDetails and " +
        "refused with a 403"
    ).not.toBe("none");
    if (match.kind === "found") {
      expect(match.customer.id).toBe(sample!.id);
      expect(digitsOf(match.customer.mobileNumber)).toBe(digits);
    }
  });

  it("narrows /subscriptions by customerId, which timeout recovery depends on", async () => {
    // Sequential, never parallel, and `vitest.config.ts` keeps the FILES
    // sequential too. Six concurrent requests once made an endpoint hang past
    // two minutes that had answered in 1.5s moments earlier, and this API also
    // serves mazj.sa's live checkout.
    const baseline = expectOk(
      await listSubscriptions({ maxResultCount: 100 }),
      "unfiltered /subscriptions"
    );

    const sample = baseline.items.find((s) => s.customerId);
    expect(
      sample,
      "no subscription on page 1 carries a customerId to probe with"
    ).toBeDefined();

    const filtered = expectOk(
      await listSubscriptions({
        customerId: sample!.customerId!,
        maxResultCount: 100,
      }),
      "filtered /subscriptions"
    );

    expect(
      filtered.totalCount,
      `customerId returned the whole subscription list (${baseline.totalCount} ` +
        "rows). Subscription timeout recovery is now blind: it will answer " +
        "'unknown' on every retry and dead-end the customer"
    ).toBeLessThan(baseline.totalCount);

    expect(filtered.items.length).toBeGreaterThan(0);
    for (const subscription of filtered.items) {
      expect(subscription.customerId).toBe(sample!.customerId);
    }
  });
});
