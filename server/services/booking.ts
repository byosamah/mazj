import "server-only";

import { errors, type AppError } from "../core/errors";
import {
  abandonIdempotent,
  beginIdempotent,
  completeIdempotent,
} from "../core/idempotency";
import { hashIp } from "../core/hash";
import { log } from "../core/logger";
import { checkRateLimit, rateLimitedError } from "../core/rate-limit";
import { err, ok, type Result } from "../core/result";
import { normalizePhone } from "../domain/phone";
import { spaceBySlug, type SpaceMapping } from "../domain/spaces";
import { env } from "../env";
import {
  absolutePaymentLink,
  createReservation,
  createSubscription,
  findCustomerByMobile,
  type RekazBookingReceipt,
  type RekazCustomerDetails,
} from "../rekaz/booking";
import { listBranches, listProducts } from "../rekaz/catalog";
import { getSlots } from "../rekaz/reservations";
import type { RekazPrice, RekazProduct } from "../rekaz/types";

/**
 * Turning a booking form into a Rekaz booking.
 *
 * Everything security-relevant about the booking flow lives here, because
 * everything the browser sent is a suggestion. The three rules:
 *
 *   1. **The price is resolved server-side, always.** The client names a price
 *      by its immutable id; this looks up what that price currently COSTS from
 *      the live catalog. It never accepts an amount.
 *   2. **The slot is re-checked server-side, always.** A slot the browser saw
 *      thirty seconds ago may be gone.
 *   3. **The write is idempotent**, because Rekaz's is not.
 */

/** Bookings permitted per client per window. */
const LIMIT = 8;
const WINDOW_SECONDS = 3600;

export type BookingCustomer = {
  name: string;
  mobile: string;
  email?: string;
};

export type BookingRequest = {
  /** Our space slug, e.g. `meeting-room`. */
  space: string;
  /**
   * The chosen price, named by `immutableId`.
   *
   * 🔴 NOT `id`. Price ids rotate whenever someone edits a price in the Rekaz
   * dashboard, so a page rendered before an edit would submit an id that no
   * longer exists. `immutableId` survives, and the live `id` is resolved here.
   */
  priceImmutableId: string;
  /** Reservations only. ISO 8601 UTC, exactly as the slot reported it. */
  slotFrom?: string;
  slotTo?: string;
  /** Subscriptions only. ISO 8601. */
  startAt?: string;
  /** Events hall only. Keyed by the Rekaz custom field's `name` GUID. */
  customFields?: Record<string, string>;
  customer: BookingCustomer;
  /** Client-generated, stable across retries of the same booking. */
  idempotencyKey: string;
  ip: string;
};

export type BookingResult = {
  paymentLink: string;
  invoiceId: string;
};

export async function createBooking(
  request: BookingRequest
): Promise<Result<BookingResult, AppError>> {
  const space = spaceBySlug(request.space);
  if (!space) return err(errors.notFound("Unknown space."));

  const mobile = normalizePhone(request.customer.mobile);
  if (!mobile) {
    return err(
      errors.validation("Please enter a valid mobile number.", {
        mobile: "invalid",
      })
    );
  }

  const name = request.customer.name.trim();
  if (name.length < 2) {
    return err(
      errors.validation("Please enter your name.", { name: "required" })
    );
  }

  // Rate limited before anything expensive. Booking creates real records in
  // MAZJ's operations system and real invoices, so an unbounded endpoint here
  // is an unbounded way to fill their dashboard with rubbish.
  const limit = await checkRateLimit({
    scope: "booking:create",
    identity: hashIp(request.ip, env().IP_HASH_SALT),
    limit: LIMIT,
    windowSeconds: WINDOW_SECONDS,
  });
  if (!limit.ok) return err(limit.error);
  if (!limit.value.allowed) return err(rateLimitedError(limit.value));

  // 🔴 Resolve the product and the CURRENT price from the live catalog. The
  // browser named a price; it did not get to say what that price costs, which
  // slot ids are valid, or which branch to bill.
  const resolved = await resolveProductAndPrice(space, request.priceImmutableId);
  if (!resolved.ok) return resolved;
  const { product, price } = resolved.value;

  const branch = await resolveBranchId(product);
  if (!branch.ok) return branch;

  // 🔴 The idempotency claim, and the reason this service exists rather than the
  // route calling Rekaz directly.
  //
  // Rekaz has no idempotency of its own, so a double-tapped button, a flaky
  // connection retried by the browser, or an impatient second tap while the
  // first request is still in flight each create a SECOND real booking and a
  // SECOND invoice. The customer then pays once and MAZJ's operations team has
  // a phantom reservation holding a room.
  //
  // Claimed BEFORE the write and released on failure, so a genuine retry with
  // the same key can proceed rather than being told "already processing"
  // forever.
  const scope = `booking:${space.flow}`;
  const begin = await beginIdempotent({
    scope,
    key: request.idempotencyKey,
    request: {
      space: space.slug,
      price: price.immutableId,
      from: request.slotFrom ?? null,
      startAt: request.startAt ?? null,
      mobile,
    },
  });
  if (!begin.ok) return err(begin.error);

  if (begin.value.kind === "replay") {
    // The same booking was already made with this key. Return the ORIGINAL
    // payment link rather than creating a twin.
    log.info("booking.replayed", { space: space.slug });
    return ok(begin.value.body as BookingResult);
  }

  // Silent customer matching. The result is used and never mentioned: this form
  // is public, so echoing "welcome back" would turn it into a phone-number
  // lookup tool. See findCustomerByMobile.
  const existing = await findCustomerByMobile(mobile);
  const customerId = existing.ok ? (existing.value?.id ?? undefined) : undefined;

  const customerDetails = customerId
    ? undefined
    : {
        name,
        mobileNumber: mobile,
        ...(request.customer.email?.trim()
          ? { email: request.customer.email.trim().toLowerCase() }
          : {}),
      };

  log.info("booking.attempt", {
    space: space.slug,
    flow: space.flow,
    priceImmutableId: price.immutableId,
    matchedExistingCustomer: Boolean(customerId),
  });

  const receipt =
    space.flow === "reservation"
      ? await bookReservation(request, price, branch.value, customerId, customerDetails)
      : await bookSubscription(request, price, branch.value, customerId, customerDetails);

  if (!receipt.ok) {
    // Release the key so the visitor can fix the problem and try again with the
    // same one. Holding it would turn "that slot just went" into a permanently
    // wedged key that answers 409 forever.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    return receipt;
  }

  if (!receipt.value.paymentLink) {
    // Rekaz answered without the one field the whole journey depends on.
    //
    // ⚠️ The booking may well EXIST at this point, so the key is deliberately
    // NOT released: retrying would create a second one. The visitor sees an
    // error and MAZJ can find the reservation in Rekaz, which is the recoverable
    // failure. A silent duplicate is not.
    log.error("booking.no_payment_link", {
      space: space.slug,
      invoiceId: receipt.value.invoiceId,
      reservationIds: receipt.value.reservationIds,
    });
    return err(
      errors.upstreamUnavailable("Rekaz returned no payment link", {
        cause: receipt.value,
      })
    );
  }

  const result: BookingResult = {
    // 🔴 Absolutised. Rekaz returns a RELATIVE path, so redirecting to it raw
    // sends the buyer to our own origin and 404s the payment step. See
    // `absolutePaymentLink`.
    paymentLink: absolutePaymentLink(
      receipt.value.paymentLink,
      env().REKAZ_API_BASE
    ),
    invoiceId: receipt.value.invoiceId,
  };

  // Stored so a retry with the same key returns THIS payment link rather than
  // booking again. Best effort: a booking that succeeded must not be reported
  // as failed because the bookkeeping afterwards did not.
  const stored = await completeIdempotent({
    scope,
    key: request.idempotencyKey,
    status: 201,
    body: result,
  });
  if (!stored.ok) {
    log.error("booking.idempotency_store_failed", {
      invoiceId: result.invoiceId,
      reason: stored.error.message,
    });
  }

  log.info("booking.created", {
    space: space.slug,
    invoiceId: result.invoiceId,
  });

  return ok(result);
}

async function bookReservation(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined
): Promise<Result<RekazBookingReceipt, AppError>> {
  const { slotFrom, slotTo } = request;
  if (!slotFrom || !slotTo) {
    return err(errors.validation("Please choose a time.", { slot: "required" }));
  }

  // 🔴 Re-check availability server-side. The browser's view of the calendar is
  // as old as whenever it was fetched, and two people looking at the same
  // Tuesday morning is the ordinary case, not the edge case. Without this the
  // loser of that race gets an invoice for a room that is already taken.
  const day = slotFrom.slice(0, 10);
  const slots = await getSlots({
    priceId: price.id,
    startDate: day,
    endDate: day,
  });
  if (!slots.ok) return slots;

  const stillFree = slots.value.some((s) => s.from === slotFrom && s.to === slotTo);
  if (!stillFree) {
    return err(
      errors.conflict("That time was just taken. Please choose another.")
    );
  }

  return createReservation({
    branchId,
    customerId,
    customerDetails,
    items: [
      {
        priceId: price.id,
        quantity: 1,
        from: slotFrom,
        to: slotTo,
        ...(request.customFields && Object.keys(request.customFields).length
          ? { customFields: request.customFields }
          : {}),
      },
    ],
  });
}

async function bookSubscription(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined
): Promise<Result<RekazBookingReceipt, AppError>> {
  const startAt = request.startAt;
  if (!startAt || !/^\d{4}-\d{2}-\d{2}/.test(startAt)) {
    return err(
      errors.validation("Please choose a start date.", { startAt: "required" })
    );
  }

  return createSubscription({
    branchId,
    startAt,
    customerId,
    customerDetails,
    items: [{ priceId: price.id, quantity: 1 }],
  });
}

/**
 * Finds the product for a space and the price the client named.
 *
 * 🔴 The lookup is by `immutableId`, and it is the reason a stale page cannot
 * book at yesterday's price: whatever `id` that immutable handle maps to TODAY
 * is what gets billed.
 */
async function resolveProductAndPrice(
  space: SpaceMapping,
  priceImmutableId: string
): Promise<Result<{ product: RekazProduct; price: RekazPrice }, AppError>> {
  const catalog = await listProducts();
  if (!catalog.ok) return catalog;

  const product = catalog.value.items.find((p) => p.slug === space.rekazSlug);
  if (!product) {
    return err(
      errors.notFound(`No Rekaz product with slug ${space.rekazSlug}`)
    );
  }

  const price = product.pricing.find((p) => p.immutableId === priceImmutableId);
  if (!price) {
    return err(
      errors.validation("That option is no longer available.", {
        price: "unknown",
      })
    );
  }

  if (product.isOutOfStock) {
    return err(errors.conflict("That space is not bookable right now."));
  }

  return ok({ product, price });
}

/**
 * The branch to bill against.
 *
 * ⚠️ Falls back to the tenant's only branch when the product names none. The
 * events hall carries an empty `branchIds` while the other three name the
 * branch, so reading it straight off the product would break the single most
 * valuable product in the catalog.
 */
async function resolveBranchId(
  product: RekazProduct
): Promise<Result<string, AppError>> {
  const fromProduct = product.branchIds?.[0];
  if (fromProduct) return ok(fromProduct);

  const branches = await listBranches();
  if (!branches.ok) return branches;

  const only = branches.value[0]?.id;
  if (!only) return err(errors.internal("Rekaz returned no branches"));
  return ok(only);
}
