import "server-only";

import type { AppError } from "../core/errors";
import type { Result } from "../core/result";
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
 * Finds an existing customer by mobile number.
 *
 * 🔴 The result must NEVER reach the browser. This runs behind a public,
 * unauthenticated booking form, and echoing anything found here (a name, an
 * email, even "we recognised you") turns the form into a lookup tool: type a
 * number, learn who it belongs to. Under PDPL that is a disclosure, and the
 * fact that the number was typed by whoever asked is not consent.
 *
 * The match exists solely so the booking attaches to the right Rekaz record
 * rather than creating a 285th duplicate of a regular. The caller sends
 * `customerId` instead of `customerDetails` and says nothing.
 *
 * ⚠️ Unlike `/reservations`, this filter genuinely works: 284 customers narrow
 * to 1. Verified. Filtering is implemented on some Rekaz endpoints and not
 * others, with nothing in the docs to tell them apart.
 */
export async function findCustomerByMobile(
  mobileNumber: string
): Promise<Result<RekazCustomer | null, AppError>> {
  const result = await rekazRequest<RekazPage<RekazCustomer>>({
    path: "/customers",
    query: { mobileNumber, maxResultCount: 2 },
  });

  if (!result.ok) return result;

  // Exactly one match, or nothing. Two customers sharing a number means the
  // data is ambiguous, and guessing which one to bill is worse than creating a
  // new record: a booking attached to the wrong person's account is a support
  // problem that looks like fraud.
  const items = result.value.items ?? [];
  const match = items.length === 1 ? items[0]! : null;

  return { ok: true, value: match ?? null };
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
  invoiceId: string;
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
  return new URL(link, origin).toString();
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
