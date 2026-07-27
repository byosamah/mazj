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
import { reconcileReservation, reconcileSubscription } from "../rekaz/reconcile";
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

/**
 * Marks an idempotency key as "we dispatched a write and never learned whether
 * it landed".
 *
 * 🔴 This exists because "hold the key" is not achievable by simply declining to
 * release it. `idempotency_begin` reclaims any `in_progress` row older than 90
 * seconds, by design, so that a request which died mid-flight cannot wedge a key
 * forever. That reclaim is correct for its purpose and fatal for ours: a hold
 * that expires after 90 seconds is a hold that turns into a duplicate booking
 * for anyone who retries two minutes later, which is exactly what a person does
 * after reading an error.
 *
 * So the key is COMPLETED with a sentinel instead. A completed row replays
 * forever and is never reclaimed, and the replay branch recognises the sentinel
 * and refuses rather than handing back a payment link that may not exist.
 */
const INDETERMINATE_MARKER = "__mazj_booking_indeterminate__";

type IndeterminateRecord = {
  [INDETERMINATE_MARKER]: true;
  space: string;
  reason: string;
  at: string;
  /** Rekaz's own reference, when reconciliation confirmed the booking exists. */
  reference: string | null;
};

function isIndeterminate(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>)[INDETERMINATE_MARKER] === true
  );
}

/**
 * Narrows a stored idempotency body to a real result.
 *
 * The previous `as BookingResult` cast trusted whatever was in the row. A
 * malformed row would have been handed to the browser as a payment link, i.e. a
 * redirect to `undefined`.
 */
function asBookingResult(body: unknown): BookingResult | null {
  if (typeof body !== "object" || body === null) return null;
  const candidate = body as Partial<BookingResult>;
  return typeof candidate.paymentLink === "string" && candidate.paymentLink
    ? { paymentLink: candidate.paymentLink, invoiceId: candidate.invoiceId ?? "" }
    : null;
}

async function markIndeterminate(
  scope: string,
  key: string,
  detail: { space: string; reason: string; reference?: string | null }
): Promise<void> {
  const record: IndeterminateRecord = {
    [INDETERMINATE_MARKER]: true,
    space: detail.space,
    reason: detail.reason,
    at: new Date().toISOString(),
    reference: detail.reference ?? null,
  };

  const stored = await completeIdempotent({ scope, key, status: 409, body: record });

  if (!stored.ok) {
    // Worth shouting about: the row stays `in_progress`, so the 90-second
    // reclaim applies again and the duplicate this function exists to prevent
    // becomes possible after all.
    log.error("booking.indeterminate_mark_failed", {
      key: key.slice(0, 12),
      reason: stored.error.message,
    });
  }
}

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
    // 🔴 A replayed key has TWO possible meanings, and conflating them is how a
    // customer gets charged twice.
    if (isIndeterminate(begin.value.body)) {
      // A previous attempt reached Rekaz and never got a definitive answer. The
      // booking may exist. Retrying would create a second one, so this key is
      // terminally closed and a human has to look.
      const stored = begin.value.body as Partial<IndeterminateRecord>;
      log.warn("booking.replayed_indeterminate", {
        space: space.slug,
        reference: stored.reference ?? null,
      });
      return err(
        stored.reference
          ? errors.conflict(
              `Your booking was created (reference ${stored.reference}) but we could not open payment. Please contact us with that reference.`,
              { fields: { reference: stored.reference } }
            )
          : errors.conflict(
              "We could not confirm that booking. Please contact us before trying again."
            )
      );
    }

    const replayed = asBookingResult(begin.value.body);
    if (!replayed) {
      // The stored row is not a shape we recognise. Refusing beats handing back
      // a malformed payment link built from an unchecked cast.
      log.error("booking.replay_corrupt", { space: space.slug });
      return err(errors.conflict("Please start that booking again."));
    }

    log.info("booking.replayed", { space: space.slug });
    return ok(replayed);
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

  // 🔴 The submitter is recorded even when the booking is attached to someone
  // else's Rekaz record.
  //
  // The mobile number is NOT verified (owner decision: no OTP, since Rekaz
  // exposes no way to do it). So a single match silently switches the payload
  // from `customerDetails` to `customerId`, and the name and email typed into
  // the form are discarded and never transmitted. Rekaz then shows a booking
  // indistinguishable from one the account holder made themselves.
  //
  // That is mostly benign (no money moves until the payer follows their own
  // payment link, and it dedupes MAZJ's 284-customer list, which is the point),
  // but a shared office number, a family number or one mistyped digit makes it
  // wrong, and without this log there is no way to answer "who actually booked
  // this?". Only the last three digits of the number are kept, consistent with
  // this codebase never storing a raw identifier.
  log.info("booking.attempt", {
    space: space.slug,
    flow: space.flow,
    priceImmutableId: price.immutableId,
    submittedName: name,
    mobileSuffix: mobile.slice(-3),
    matchedCustomerId: customerId ?? null,
    attachedToExistingCustomer: Boolean(customerId),
  });

  // 🔴 PREPARE, then DISPATCH. The split is the whole point.
  //
  // Everything that can reject a booking without contacting Rekaz (a missing
  // slot, a bad start date, a slot that was just taken) happens in `prepare`,
  // which returns a thunk it has NOT yet called. Only after that does anything
  // leave this machine. That is what makes "nothing was sent" distinguishable
  // from "sent, no answer", and the whole duplicate-booking defence rests on
  // telling those two apart.
  const prepared =
    space.flow === "reservation"
      ? await prepareReservation(request, price, branch.value, customerId, customerDetails)
      : await prepareSubscription(request, price, branch.value, customerId, customerDetails);

  if (!prepared.ok) {
    // Nothing was dispatched, so nothing can exist upstream. Release the key so
    // the visitor can correct the problem and retry with the same one.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    return prepared;
  }

  const receipt = await prepared.value();

  if (!receipt.ok) {
    // 🔴 THE WRITE WAS DISPATCHED. Whether the key may be released now depends
    // entirely on whether Rekaz gave a definitive answer.
    //
    // `upstream_unavailable` is produced by exactly three things: our own 10s
    // client timeout, a network failure, and a Rekaz 5xx. In all three Rekaz may
    // already have committed the booking and the invoice; we simply never heard.
    // Releasing the key there is precisely how a retry (which carries the same
    // key by design) creates a SECOND real booking and a SECOND real invoice.
    // Rekaz is measured between 1.2s and 10.8s on this tenant, so this is a
    // routine Tuesday, not a freak event.
    //
    // Any other code is a definitive refusal from Rekaz: nothing was created,
    // and the key is safe to release.
    if (receipt.error.code !== "upstream_unavailable") {
      await abandonIdempotent({ scope, key: request.idempotencyKey });
      return receipt;
    }

    // 🔴 Indeterminate. Rather than dead-end the customer, GO AND LOOK.
    //
    // Rekaz cannot answer "did request X succeed", but it can answer "does a
    // booking matching this description exist", and we know exactly what we just
    // tried to create. Reservations are ordered by creation, so ours would be at
    // the top; subscriptions are findable by the one filter that endpoint
    // honours. See `server/rekaz/reconcile.ts`.
    const found =
      space.flow === "reservation"
        ? await reconcileReservation({ mobile, slotFrom: request.slotFrom! })
        : await reconcileSubscription({
            customerId: customerId ?? (await lookupCustomerId(mobile)),
            startAt: request.startAt!,
          });

    const outcome = found.ok ? found.value.outcome : "unknown";

    if (outcome === "absent") {
      // Confidently not created, so the customer may simply try again. This is
      // the common case: a timeout usually means the request never completed.
      log.warn("booking.timeout_not_created", { space: space.slug, mobileSuffix: mobile.slice(-3) });
      await abandonIdempotent({ scope, key: request.idempotencyKey });
      return receipt;
    }

    // Either the booking EXISTS, or we could not ask. Both must hold the key: a
    // retry would duplicate a real booking in the first case, and might in the
    // second. The difference is only what the customer is told.
    const reference = found.ok && found.value.outcome === "found" ? found.value.reference : null;

    log.error("booking.indeterminate", {
      space: space.slug,
      outcome,
      reference,
      mobileSuffix: mobile.slice(-3),
      submittedName: name,
      reason: receipt.error.message,
    });

    await markIndeterminate(scope, request.idempotencyKey, {
      space: space.slug,
      reason: receipt.error.message,
      reference,
    });

    return err(
      reference
        ? // 🔴 Confirmed created but unpayable: Rekaz exposes no payment link on
          // a fetched booking, so it CANNOT be recovered automatically. The
          // reference is what lets MAZJ finish this by hand.
          errors.conflict(
            `Your booking was created (reference ${reference}) but we could not open payment. Please contact us with that reference.`,
            { fields: { reference } }
          )
        : receipt.error
    );
  }

  if (!receipt.value.paymentLink) {
    // Rekaz answered 2xx without the one field the whole journey depends on, so
    // the booking almost certainly EXISTS and is unpayable.
    //
    // 🔴 Marked indeterminate rather than merely left `in_progress`. An
    // `in_progress` row is reclaimed by `idempotency_begin` after 90 seconds,
    // so "hold the key" would have silently expired into "create the duplicate"
    // for anyone who retried a minute and a half later. Completing the key with
    // a sentinel closes it permanently.
    log.error("booking.no_payment_link", {
      space: space.slug,
      // ⚠️ `invoiceId` is documented but came back UNDEFINED on a real
      // reservation, so it cannot be the operator's only pointer. The whole
      // receipt and the customer's number go in the log, or the booking is
      // unfindable when someone calls to ask what happened.
      receipt: receipt.value,
      mobile,
      matchedCustomerId: customerId ?? null,
    });
    await markIndeterminate(scope, request.idempotencyKey, {
      space: space.slug,
      reason: "no payment link",
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

/**
 * A dispatch that has been fully validated but NOT yet sent.
 *
 * Returning a thunk is what lets the caller know, with certainty, that nothing
 * has reached Rekaz yet. Everything before this point can fail safely; the
 * moment it is invoked, a duplicate becomes possible.
 */
type Dispatch = () => Promise<Result<RekazBookingReceipt, AppError>>;

async function prepareReservation(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined
): Promise<Result<Dispatch, AppError>> {
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

  return ok(() =>
    createReservation({
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
    })
  );
}

async function prepareSubscription(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined
): Promise<Result<Dispatch, AppError>> {
  const startAt = request.startAt;
  if (!startAt || !/^\d{4}-\d{2}-\d{2}/.test(startAt)) {
    return err(
      errors.validation("Please choose a start date.", { startAt: "required" })
    );
  }

  return ok(() =>
    createSubscription({
      branchId,
      startAt,
      customerId,
      customerDetails,
      items: [{ priceId: price.id, quantity: 1 }],
    })
  );
}

/**
 * The customer's Rekaz id, looked up after a write we could not confirm.
 *
 * Needed because a booking for a NEW customer has no `customerId` on our side,
 * yet the failed write may have created one. Without this, subscription
 * reconciliation has nothing to search by and every timeout would report
 * "unknown" and dead-end the customer.
 */
async function lookupCustomerId(mobile: string): Promise<string | null> {
  const found = await findCustomerByMobile(mobile);
  return found.ok ? (found.value?.id ?? null) : null;
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
