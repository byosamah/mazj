import "server-only";

import type { AppError } from "../core/errors";
import { ok, type Result } from "../core/result";
import { rekazRequest } from "./client";
import type { RekazPage } from "./types";

/**
 * The write side of Rekaz: the two calls that take MAZJ's money.
 *
 * 🔴 THERE IS NO SANDBOX. Every function here creates a real record in the
 * tenant MAZJ's operations team works from, and a real invoice. Nothing in this
 * file may be called from a test that runs unattended.
 *
 * 🔴 AND REKAZ HAS NO IDEMPOTENCY. There is no `Idempotency-Key` header and no
 * equivalent, so a retried POST creates a SECOND booking and a SECOND invoice.
 * Never call these directly from a route: go through
 * `server/services/booking.ts`, which wraps them in `idempotency_begin()`.
 */

export type RekazCustomerDetails = {
  name: string;
  mobileNumber: string;
  email?: string;
};

export type RekazCustomer = {
  id: string;
  name: string;
  customerNumber: string | null;
  mobileNumber: string;
  email: string | null;
  isBlocked: boolean;
};

/**
 * The outcome of a customer lookup.
 *
 * 🔴 `ambiguous` is a THIRD outcome, not a flavour of `none`, and separating
 * them is the point of this type. Two customers sharing a number means the data
 * is ambiguous, and guessing which one to bill is worse than creating a new
 * record: a booking attached to the wrong person's account is a support problem
 * that looks like fraud. Both outcomes therefore decline to bind, which is
 * correct and unchanged. What changes is that the caller can now SEE which
 * happened. "Nobody has this number" ends in a new customer record and is
 * routine; "two people do" is a data problem somebody has to clean up in the
 * Rekaz dashboard, and while both came back as `null` the second was invisible
 * everywhere, including in the log.
 */
export type CustomerMatch =
  | { kind: "found"; customer: RekazCustomer }
  | { kind: "none" }
  | { kind: "ambiguous"; count: number };

/**
 * Finds an existing customer by mobile number.
 *
 * 🔴 The result must NEVER reach the browser. This runs behind a public,
 * unauthenticated booking form, and echoing anything found here (a name, an
 * email, even "we recognised you") turns the form into a lookup tool: type a
 * number, learn who it belongs to. Under PDPL that is a disclosure, and the
 * fact that the number was typed by whoever asked is not consent.
 *
 * The match exists solely so the booking attaches to the right Rekaz record
 * rather than creating a duplicate of a regular. The caller sends `customerId`
 * instead of `customerDetails` and says nothing.
 *
 * ⚠️ **Unlike `/reservations`, this filter genuinely works. Measured against the
 * live tenant on 2026-07-28, when it held 287 customers:** a known number
 * narrows 287 rows to exactly 1, and an unknown one returns none. On
 * `/reservations` almost the opposite holds: `keyword`, `customerId`,
 * `branchId`, `statuses`, `upcoming`, `dateMin` and `dateMax` are ignored
 * outright, and the one that does work, `customerMobile`, matches as a
 * SUBSTRING. 🔴 That substring caveat does NOT transfer here: `/customers` was
 * measured returning exactly the matching row, which is why this function may
 * bind a booking on the answer while a `/reservations` caller must re-check
 * what came back. Filtering is implemented per endpoint on this API with nothing
 * in the documentation to tell them apart, which is why the measurement and its
 * date are written down here rather than remembered.
 *
 * ⚠️ **The digits-only fallback below is belt and braces, NOT a fix for a known
 * break, and it should not be described as one.** Measured the same day: the
 * filter returns the identical single row whether the argument carries the
 * leading plus or not. So today the first query always answers and the fallback
 * never runs. What it buys is independence from an undocumented upstream
 * tolerance that could be withdrawn in a Rekaz deploy nobody tells us about,
 * where the symptom would be every returning customer suddenly unable to book.
 *
 * The E.164 form is sent FIRST, and that order is the load-bearing part. Ours is
 * the shape `domain/phone.ts` normalises to, and dropping the plus makes the
 * query strictly less specific; on an endpoint whose matching rule is
 * undocumented, a less specific query can return MORE rows, which this function
 * reads as ambiguity and refuses to act on. Sending the specific form first
 * keeps today's measured behaviour as the primary path.
 *
 * ⚠️ **The fallback costs one extra round trip, and only where it is cheapest to
 * pay.** It fires exactly when the first query found nobody, i.e. on a customer
 * we are about to CREATE, on the submit path, against an API measured between
 * 1.2s and 10.8s. That is a real second or two added to a first-time buyer's
 * submit. It is accepted because the 287 customers already in the tenant never
 * reach it, and because the outcome it guards against is a returning customer
 * hitting Rekaz's 403 and losing the sale.
 *
 * ⚠️ **The returned row's own mobile is NOT re-compared against ours**, and that
 * is a decision rather than an omission. Rekaz's customer records were typed by
 * whoever created them and carry `05…`, `966…` and `+966…` interchangeably, so a
 * strict comparison would turn genuine matches into misses; the booking would
 * then send `customerDetails` and Rekaz would answer 403
 * `رقم الجوال مسجل مسبقاً لعميل آخر`. Weakening this lookup once already took
 * booking down for every returning customer (2026-07-28, pinned by
 * `server/services/booking.customer.test.ts`), and a check that false-negatives
 * is that same outage wearing a different hat.
 */
export async function findCustomerByMobile(
  mobileNumber: string
): Promise<Result<CustomerMatch, AppError>> {
  const primary = await queryCustomers(mobileNumber);
  if (!primary.ok || primary.value.kind !== "none") return primary;

  const digitsOnly = mobileNumber.replace(/\D/g, "");
  if (!digitsOnly || digitsOnly === mobileNumber) return primary;

  return queryCustomers(digitsOnly);
}

async function queryCustomers(
  mobileNumber: string
): Promise<Result<CustomerMatch, AppError>> {
  const result = await rekazRequest<RekazPage<RekazCustomer>>({
    path: "/customers",
    // Two is exactly enough to tell "one match" from "more than one" without
    // pulling a page of somebody else's customers into memory to count them.
    query: { mobileNumber, maxResultCount: 2 },
  });

  if (!result.ok) return result;

  const items = result.value.items ?? [];
  if (items.length === 0) return ok<CustomerMatch>({ kind: "none" });
  if (items.length === 1) {
    return ok<CustomerMatch>({ kind: "found", customer: items[0]! });
  }

  // `totalCount` is the honest number; `items.length` is capped at 2 by the
  // query above, so it is only a floor and is used solely for the case where
  // Rekaz omits the envelope field it documents as always present.
  return ok<CustomerMatch>({
    kind: "ambiguous",
    count: result.value.totalCount ?? items.length,
  });
}

/** One line of a reservation request. */
export type RekazReservationItem = {
  priceId: string;
  quantity: number;
  /** ISO 8601 UTC, taken verbatim from the chosen slot's `from`. */
  from: string;
  to: string;
  providerIds?: string[];
  /** Keyed by the custom field's `name`, which is a GUID, not its label. */
  customFields?: Record<string, string>;
};

export type CreateReservationInput = {
  branchId: string;
  items: RekazReservationItem[];
  customerId?: string;
  customerDetails?: RekazCustomerDetails;
};

export type RekazBookingReceipt = {
  /**
   * ⚠️ **OPTIONAL, and the type is now telling the truth rather than the
   * documentation.** Rekaz documents `invoiceId` as always present; the real
   * reservation created on 2026-07-27 came back with it UNDEFINED.
   *
   * Declared as a required string, `tsc` would cheerfully accept
   * `receipt.invoiceId.slice(0, 8)` in a receipt email or an admin table, and
   * the crash would land on the one path where a customer has already paid. The
   * type is the only thing that can stop that, because the value is right most
   * of the time and nothing local reproduces the case.
   */
  invoiceId?: string;
  reservationIds: string[];
  /**
   * The Rekaz-hosted checkout link.
   *
   * 🔴 **IT ARRIVES AS A RELATIVE PATH**, e.g. `/orders/pay/RMogHOPQc47FStqK`,
   * NOT the absolute `https://platform.rekaz.io/i/NcRo` the documentation
   * promises. Verified against a real booking on 2026-07-27.
   *
   * That difference is a live payment outage waiting to happen. Redirecting a
   * browser to a relative path sends the customer to OUR origin, so the final
   * click of the purchase lands on our own 404 instead of a card form. Measured:
   * `platform.rekaz.io/orders/pay/<id>` answers 200, `mazj.sa/orders/pay/<id>`
   * answers 404, so the host cannot be guessed from the store domain either.
   *
   * `absolutePaymentLink` resolves it. Never use this field raw.
   */
  paymentLink: string;
};

/**
 * Turns Rekaz's payment link into something a browser can actually follow.
 *
 * Absolute URLs are passed through untouched, so if Rekaz ever starts returning
 * one (as their docs claim) this keeps working without a change.
 */
export function absolutePaymentLink(link: string, apiBase: string): string {
  if (/^https?:\/\//i.test(link)) return link;

  // `apiBase` is `https://platform.rekaz.io/api/public`; the checkout lives at
  // the origin, not under the API path.
  const origin = new URL(apiBase).origin;

  // 🔴 Forced onto a single leading slash BEFORE it is resolved, and that is the
  // whole of the hardening.
  //
  // A protocol-relative value like the two characters slash-slash followed by
  // `other.host/orders/pay/x` is not an absolute URL, so it falls past the
  // scheme test above, and `new URL()` reads the double slash as "keep the
  // scheme, replace the host": it resolves to `https://other.host/orders/pay/x`.
  // We would then hand that to a same-tab redirect for a customer on their way
  // to type a card number. A pair of backslashes is a second spelling of the
  // same escape, because WHATWG treats a backslash as a slash inside an http
  // URL, so the character class has to cover both.
  //
  // This has never been observed and is not expected to be: the value arrives
  // over TLS on a connection authenticated with our own credential, so it is
  // upstream trust rather than attacker input. It is closed anyway because it is
  // one line and the failure it prevents is a MAZJ customer entering card
  // details on somebody else's page. Collapsed rather than refused because this
  // function has no way to report a refusal that its caller could act on: a
  // hostile value becomes a path on Rekaz's own origin, which 404s in front of
  // the customer instead of redirecting them silently.
  const path = `/${link.replace(/^[/\\]+/, "")}`;
  return new URL(path, origin).toString();
}

/**
 * Creates one or more reservations and returns the payment link.
 *
 * ⚠️ Rekaz caps this at 5 items per call.
 *
 * `from` and `to` are passed through exactly as the chosen slot reported them.
 * Recomputing them from a local date would reintroduce the timezone bug the
 * slot response already solved: the venue is UTC+3 and the API speaks UTC.
 */
export function createReservation(
  input: CreateReservationInput
): Promise<Result<RekazBookingReceipt, AppError>> {
  return rekazRequest<RekazBookingReceipt>({
    path: "/reservations/bulk",
    method: "POST",
    body: {
      branchId: input.branchId,
      ...(input.customerId
        ? { customerId: input.customerId }
        : { customerDetails: input.customerDetails }),
      items: input.items,
      // Server-side enforcement of package usage limits. On by default because
      // the alternative is trusting a number the browser sent us.
      respectPackageUsageLimits: true,
    },
  });
}

export type CreateSubscriptionInput = {
  branchId: string;
  /** ISO 8601. The day the subscription begins. */
  startAt: string;
  items: { priceId: string; quantity: number }[];
  customerId?: string;
  customerDetails?: RekazCustomerDetails;
};

/**
 * Creates a subscription (shared seat, private office).
 *
 * ⚠️ Returns a different shape from `createReservation`: the subscription
 * object rather than a receipt. The payment link is reached the same way in the
 * end, but do not assume the two responses match.
 */
export function createSubscription(
  input: CreateSubscriptionInput
): Promise<Result<RekazBookingReceipt & { id?: string }, AppError>> {
  return rekazRequest<RekazBookingReceipt & { id?: string }>({
    path: "/subscriptions",
    method: "POST",
    body: {
      branchId: input.branchId,
      startAt: input.startAt,
      ...(input.customerId
        ? { customerId: input.customerId }
        : { customerDetails: input.customerDetails }),
      items: input.items,
    },
  });
}
