import "server-only";

import { errors, type AppError } from "../core/errors";
import {
  abandonIdempotent,
  beginIdempotent,
  completeIdempotent,
} from "../core/idempotency";
import { hashIdentifier, hashIp } from "../core/hash";
import { log } from "../core/logger";
import { checkRateLimits, rateLimitedError } from "../core/rate-limit";
import { err, ok, type Result } from "../core/result";
import type { ClientIdentity } from "../core/request";
import { recordBooking } from "../db/bookings";
import { normalizePhone } from "../domain/phone";
import { riyadhDate, riyadhToday } from "../domain/riyadh-time";
import { spaceBySlug, type SpaceMapping } from "../domain/spaces";
import { cleanFreeText, looksLikeEmail } from "../domain/text";
import { env } from "../env";
import {
  absolutePaymentLink,
  createReservation,
  createSubscription,
  findCustomerByMobile,
  type CustomerMatch,
  type RekazBookingReceipt,
  type RekazCustomerDetails,
} from "../rekaz/booking";
import { listProducts, resolveBranchId } from "../rekaz/catalog";
import {
  reconcileReservation,
  reconcileSubscription,
  type Reconciled,
} from "../rekaz/reconcile";
import { getSlots } from "../rekaz/reservations";
import {
  chargedAmount,
  type RekazPrice,
  type RekazProduct,
} from "../rekaz/types";

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

/**
 * Bookings permitted per MOBILE NUMBER per window.
 *
 * Deliberately looser than it could be. A real person books once, occasionally
 * twice after a mistake; five is far above that and far below the hundreds
 * needed to squat a calendar. Set it tighter and the first person to book a
 * meeting room, cancel and rebook twice is refused by their own venue.
 *
 * ⚠️ It does mean a determined attacker can burn a specific number's allowance
 * and stop that person booking for an hour. That is a real cost and it is the
 * better half of the trade: the alternative is no ceiling on how many slots one
 * number can hold.
 */
const PER_MOBILE_LIMIT = 5;

/**
 * Longest customer name forwarded to Rekaz.
 *
 * Generous for a real name in either script, and far below "a stranger pasted a
 * novel into your operations dashboard".
 */
const MAX_NAME_LENGTH = 120;

/** RFC 5321's maximum path length. */
const MAX_EMAIL_LENGTH = 254;

/**
 * Longest custom-field value forwarded to Rekaz.
 *
 * Generous for "tell us about the event", which is the longest thing this form
 * legitimately collects, and far below "a stranger pasted a novel into your
 * operations dashboard". Same reasoning as `MAX_NAME_LENGTH`, different budget.
 */
const MAX_CUSTOM_FIELD_LENGTH = 500;

/**
 * Rekaz's custom-field `type` for a file upload.
 *
 * Named because the bare number is unreadable at a call site, and because this
 * particular value carries a behavioural consequence: Rekaz publishes no upload
 * endpoint, so a file field cannot be collected through this form at all.
 * `components/booking/BookingFlow.tsx` excludes it from the rendered inputs for
 * exactly the same reason.
 */
const REKAZ_FILE_FIELD = 10;

/** How far ahead a subscription may be scheduled to start. */
const MAX_START_DAYS_AHEAD = 365;

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
  /**
   * Events hall only. Keyed by the Rekaz custom field's `name` GUID.
   *
   * 🔴 Whatever arrives here is a SUGGESTION, like everything else on this
   * type. `validateCustomFields` narrows it to the keys the product actually
   * declares before any of it reaches Rekaz; nothing below this line reads the
   * raw map.
   */
  customFields?: Record<string, string>;
  customer: BookingCustomer;
  /** Client-generated, stable across retries of the same booking. */
  idempotencyKey: string;
  /** Client address plus whether the platform vouches for it. See `clientIp`. */
  ip: ClientIdentity;
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
      // NOT `key` or `keyPrefix`: both match the logger's denylist and would be
      // written as "[redacted]", leaving this alarm with nothing to act on.
      idemPrefix: key.slice(0, 12),
      reason: stored.error.message,
    });
  }
}

/**
 * A conflict that is NOT "that slot just went".
 *
 * 🔴 THE DISTINCTION IS WORTH MONEY, and the error CODE cannot carry it.
 * `errors.conflict` is what `prepareReservation` returns when the slot re-check
 * finds the window gone, and the page renders that as "That time was just taken.
 * Please choose another." Four other outcomes on this path are also `conflict`,
 * and none of them means that:
 *
 *   - a first attempt still in flight under the same idempotency key;
 *   - a write we dispatched and could not confirm;
 *   - a stored idempotency result we could not read back;
 *   - a replay of a key that was closed as indeterminate.
 *
 * Telling a customer whose booking may ALREADY EXIST to go and choose another
 * time is an invitation to buy the room twice. On the open desk and the private
 * office, which have no time slot at all, it is not even a sentence about
 * anything on their screen.
 *
 * 🔴 THE INVARIANT THIS ESTABLISHES, and the one thing to preserve if this is
 * ever refactored: `upstream_unavailable` means NOTHING WAS DISPATCHED and a
 * retry is safe, while these two mean SOMETHING MAY HAVE BEEN and a retry is
 * not. Copy that invites a retry may only ever be attached to the first.
 *
 * The marker travels in `fields`, the same carrier the confirmed-booking
 * reference already uses, and `app/[locale]/spaces/_lib/actions.ts` turns it
 * into a code the page has copy for. It is deliberately NOT a new `ErrorCode`:
 * that list is a shared contract in `core/errors.ts` with its own HTTP status
 * table, and both of these map to the same 409 as `conflict` anyway.
 */
function bookingConflict(
  state: "in_flight" | "unconfirmed",
  message: string
): AppError {
  return errors.conflict(message, { fields: { booking: state } });
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

  // 🔴 Cleaned and BOUNDED, not merely trimmed.
  //
  // Since bookings stopped adopting an existing Rekaz customer id, this value is
  // written to MAZJ's operations records on every booking and rendered in the
  // admin dashboard's Customer column. The form is public and unauthenticated,
  // so an unbounded string here is a stranger writing arbitrary length into an
  // internal screen, and a control character is a 503 blaming our database for
  // their input. See `domain/text.ts`.
  const name = cleanFreeText(request.customer.name, MAX_NAME_LENGTH);
  if (name.length < 2) {
    return err(
      errors.validation("Please enter your name.", { name: "required" })
    );
  }

  // Rate limited before anything expensive. Booking creates real records in
  // MAZJ's operations system and real invoices, so an unbounded endpoint here
  // is an unbounded way to fill their dashboard with rubbish.
  // Computed once and reused by the audit log below, so the bucket a request
  // was counted against and the line recording what it did carry the SAME
  // pseudonym. Two independent hashes of the same address would be two numbers
  // nobody could join. Null when no address reached us at all, which is now
  // distinguishable from "we saw one": the old code hashed the literal string
  // "unknown" into a single bucket shared by every such request on the site.
  const originHash = request.ip.ip
    ? hashIp(request.ip.ip, env().IP_HASH_SALT)
    : null;

  // 🔴 TWO dimensions, checked at TWO DIFFERENT POINTS. The split is the whole
  // point and the ordering is load-bearing.
  //
  // The address bounds how much one network peer can do. The mobile number
  // bounds how much can be done TO one number, which is what actually stops the
  // calendar being walked: an attacker with a pool of genuine residential IPs
  // defeats the first ceiling entirely and still cannot squat every slot under
  // one number.
  //
  // 🔴 The mobile bucket is keyed on a VICTIM, not on the caller, and that makes
  // it a weapon if it is charged too early. Checked here, alongside the address,
  // it would let five throwaway requests carrying a stranger's number (and
  // nothing else valid) exhaust that number's allowance and lock the real owner
  // out of booking for an hour. The counter increments before it decides, so a
  // request that was always going to be rejected still spends the allowance.
  //
  // So: the SELF-keyed bucket is charged here and short-circuits, and the
  // RESOURCE-keyed bucket is charged further down, after the price, the branch
  // and the idempotency replay have all been resolved. A request that cannot
  // book anything now cannot spend anybody else's allowance. The cost is that a
  // caller already over their address limit never touches the mobile counter,
  // which is the correct trade: a small free allowance beats an unbounded
  // targeted lockout.
  if (originHash) {
    const byOrigin = await checkRateLimits([
      {
        scope: "booking:create",
        identity: originHash,
        limit: LIMIT,
        windowSeconds: WINDOW_SECONDS,
      },
    ]);
    if (!byOrigin.ok) return err(byOrigin.error);
    if (!byOrigin.value.allowed) {
      log.warn("booking.rate_limited", {
        space: space.slug,
        scope: "booking:create",
        originHash,
        originAttested: request.ip.attested,
      });
      return err(rateLimitedError(byOrigin.value));
    }
  }

  // 🔴 Resolve the product and the CURRENT price from the live catalog. The
  // browser named a price; it did not get to say what that price costs, which
  // slot ids are valid, or which branch to bill.
  const resolved = await resolveProductAndPrice(space, request.priceImmutableId);
  if (!resolved.ok) return resolved;
  const { product, price } = resolved.value;

  // 🔴 CUSTOM FIELDS ARE VALIDATED AGAINST THE PRODUCT, NOT FORWARDED.
  //
  // The Server Action accepts any `cf:`-prefixed form key and only trims it, and
  // this service used to pass the whole map straight into the Rekaz item.
  // Nothing checked the GUIDs against the product's own `customFields`, which
  // the server is already holding; nothing bounded the values; and the free-text
  // cleaner that guards the name and the email was never applied to them. A
  // crafted POST could therefore put unbounded text, or a control character,
  // into MAZJ's operations records under a key we never declared.
  //
  // `isRequired` was a CLIENT attribute only, which means the browser's
  // `required` was the entire enforcement. The events hall's two required fields
  // (how many are coming, and what the event is) would otherwise reach Rekaz
  // missing and come back as a 400, which `rekaz/client.ts` maps to `internal`
  // and the page renders as "Something went wrong on our side": our fault, on
  // their side, for something the visitor could have fixed in a second.
  //
  // Checked HERE, before the idempotency claim, so a fixable mistake never
  // holds a key.
  const customFields = validateCustomFields(product, request.customFields);
  if (!customFields.ok) return customFields;

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
  if (!begin.ok) {
    // 🔴 A `conflict` from `beginIdempotent` is `in_flight` or `retry`, and
    // NEITHER is "that slot just went". Both mean an identical request is
    // already being handled and this one dispatched nothing, so the honest
    // advice is to wait rather than to pick a different time or to book again.
    //
    // The two cannot be told apart here: `core/idempotency.ts` maps both to
    // `conflict` and only the message differs, and parsing a message to branch
    // on it is exactly what `core/errors.ts` forbids. They take the same copy
    // because they take the same action.
    return err(
      begin.error.code === "conflict"
        ? bookingConflict("in_flight", begin.error.message)
        : begin.error
    );
  }

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
          : bookingConflict(
              "unconfirmed",
              "We could not confirm that booking. Please contact us before trying again."
            )
      );
    }

    const replayed = asBookingResult(begin.value.body);
    if (!replayed) {
      // The stored row is not a shape we recognise. Refusing beats handing back
      // a malformed payment link built from an unchecked cast.
      // 🔴 Marked unconfirmed, not "start again", and the difference matters.
      // A COMPLETED row exists, and `completeIdempotent` is only ever called
      // after a successful receipt or with the indeterminate sentinel, so a row
      // we cannot read back is far more likely to be a booking that HAPPENED
      // than one that did not. "Please start that booking again" was the more
      // dangerous of the two readings.
      log.error("booking.replay_corrupt", { space: space.slug });
      return err(
        bookingConflict(
          "unconfirmed",
          "Stored idempotency result was not a usable booking shape."
        )
      );
    }

    log.info("booking.replayed", { space: space.slug });
    return ok(replayed);
  }

  // The RESOURCE-keyed ceiling, charged here rather than beside the address one.
  //
  // Everything above this line can reject a request without it ever having been
  // a real booking attempt: an unknown space, an invalid number, a price that no
  // longer exists, an unreachable branch, or a replayed idempotency key. None of
  // those may spend the allowance of whoever owns the submitted number, because
  // the submitter does not have to be that person. By the time control reaches
  // here the request is well-formed, priced, and not a replay, so charging the
  // number it names is charging a genuine attempt to book against it.
  //
  // 🔴 If you move this call upward, read the comment beside the address bucket
  // first. Its position IS the mitigation.
  const byMobile = await checkRateLimits([
    {
      scope: "booking:mobile",
      identity: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
      limit: PER_MOBILE_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    },
  ]);
  if (!byMobile.ok) {
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    return err(byMobile.error);
  }
  if (!byMobile.value.allowed) {
    // Released, not held: the caller never dispatched anything, so a retry after
    // the window must be able to reuse the same key rather than meeting a
    // permanently claimed one.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    log.warn("booking.rate_limited", {
      space: space.slug,
      scope: "booking:mobile",
      originHash,
      originAttested: request.ip.attested,
      submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
    });
    return err(rateLimitedError(byMobile.value));
  }

  const submittedEmail = cleanFreeText(
    request.customer.email ?? "",
    MAX_EMAIL_LENGTH
  ).toLowerCase();
  const email = looksLikeEmail(submittedEmail) ? submittedEmail : null;

  // 🔴 A RETURNING CUSTOMER MUST BE SENT AS `customerId`. REKAZ ENFORCES IT.
  //
  // ⚠️ Read this before "fixing" the impersonation risk described below by
  // removing the lookup. That was tried on 2026-07-28 and it took booking down
  // for every returning customer on both flows.
  //
  // MEASURED against the live API on 2026-07-28, same credential, same headers:
  //
  //   customerDetails whose mobileNumber already belongs to a customer
  //     -> HTTP 403, "رقم الجوال مسجل مسبقاً لعميل آخر"
  //        ("the mobile number is already registered to another customer")
  //   customerDetails with a mobile Rekaz has never seen  -> accepted
  //   customerId                                          -> accepted
  //
  // So Rekaz neither deduplicates nor creates a second record: it REFUSES. There
  // is exactly one way to book for somebody already in the tenant, and this is
  // it. 284 of our customers are already in there.
  //
  // 🔴 WHAT THIS COSTS, STATED PLAINLY. The form is public and unauthenticated
  // and the number is not verified, because Rekaz exposes no way to verify one.
  // So a single match silently binds the booking to that customer's account, and
  // anyone who knows a member's mobile number can file a real booking against it.
  // We cannot close that here. It is closed by proving possession of the number,
  // which needs an OTP primitive the API does not have (see REK-029 in
  // `docs/MAZJ-Rekaz-API-Report.pdf`).
  //
  // WHAT IS MITIGATED INSTEAD, none of which existed before 2026-07-28:
  //   - a per-mobile rate limit, so one number cannot be used to walk the
  //     calendar (see PER_MOBILE_LIMIT and the two-stage check above);
  //   - an audit trail that actually records something, so an impersonated
  //     booking is attributable afterwards rather than invisible (the log below
  //     used to write "[redacted]" into every field that mattered);
  //   - the submitted name and email are NEVER written onto a matched account,
  //     so a stranger cannot repoint an existing customer's contact details.
  //
  // 🔴 THREE OUTCOMES, NOT TWO. "We asked and there is no such customer" and "we
  // could not ask" used to collapse into the same `undefined`, and they lead to
  // OPPOSITE payloads. On a failed lookup the code below sends `customerDetails`
  // for a number Rekaz already owns, which is the one payload Rekaz refuses:
  // HTTP 403, `رقم الجوال مسجل مسبقاً لعميل آخر`, mapped to `internal` and
  // rendered to the buyer as "Something went wrong on our side". A returning
  // customer turned away by a lookup blip rather than by anything about their
  // booking, and silently: the sibling helper logs this distinction and this
  // path did not.
  const lookup = await lookupCustomer(mobile, "pre_write");

  if (lookup.kind === "unavailable") {
    // Nothing has been dispatched, so the key is RELEASED and the same one can
    // be retried. Reported as retryable rather than proceeding to a payload we
    // can already predict Rekaz will refuse.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    return err(
      errors.upstreamUnavailable(
        `Rekaz customer lookup unavailable: ${lookup.reason}`
      )
    );
  }

  if (lookup.kind === "ambiguous") {
    // 🔴 TWO customer records share this number, so there is no representable
    // payload. `customerDetails` is refused because Rekaz already owns the
    // number; picking one of the two ids bills a person who may not be the
    // buyer, which is a support problem that looks like fraud. Only a human
    // merging the duplicate in the Rekaz dashboard can unblock it.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    log.warn("booking.customer_ambiguous", {
      space: space.slug,
      count: lookup.count,
      originHash,
      submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
    });
    return err(errors.forbidden("That number matches more than one account."));
  }

  if (lookup.kind === "found" && lookup.customer.isBlocked) {
    // 🔴 `isBlocked` was typed on the customer and read NOWHERE, so a booking
    // against an account MAZJ had deliberately blocked adopted that account's id
    // and billed it exactly like any other. Blocking somebody in the Rekaz
    // dashboard has to mean something on the site that sells to them.
    //
    // ⚠️ The copy this maps to must NOT confirm the block. The form is public
    // and the number is unverified, so a message reading "your account is
    // blocked" would tell anyone who knows a member's number that the member is
    // blocked. `Booking.error.forbidden` routes them to WhatsApp instead, which
    // is also the right instruction for the ambiguous case above: one code, one
    // sentence, and both are resolved by a person rather than by retrying.
    //
    // Also released: nothing was dispatched, and a key held here would wedge the
    // number rather than the person.
    await abandonIdempotent({ scope, key: request.idempotencyKey });
    log.warn("booking.customer_blocked", {
      space: space.slug,
      originHash,
      submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
    });
    return err(errors.forbidden("That account cannot book online."));
  }

  const customerId = lookup.kind === "found" ? lookup.customer.id : undefined;

  // Exclusive by construction: Rekaz rejects a payload carrying both, and
  // `customerDetails` is what creates a genuinely new customer record.
  const customerDetails = customerId
    ? undefined
    : {
        name,
        mobileNumber: mobile,
        // Optional, and DROPPED rather than forwarded when it is not shaped like
        // an address. It is written onto a customer record that a human will
        // later try to contact, so rubbish here is worse than an absent field.
        ...(email ? { email } : {}),
      };
  //
  // 🔴 This log used to be unable to answer that question, in two separate ways.
  //
  // First it did not survive: it carried `submittedName` and `mobileSuffix`, and
  // `core/logger.ts` redacts every key whose name CONTAINS "name" or "mobile",
  // so both were written as "[redacted]" on every line. The compensating control
  // this comment relies on had never once recorded anything.
  //
  // Second, and less obvious, hashing the submitted MOBILE cannot by itself
  // distinguish an impersonator from the account holder: both typed the same
  // number, so both produce the same value. `originHash` is what separates them,
  // and it is the field that was missing. `submitterHash` answers "the same
  // number was used across these bookings"; `originHash` answers "and they came
  // from somewhere the real owner never books from".
  //
  // Neither is reversible without `IP_HASH_SALT`, so the trail is a set of
  // pseudonyms rather than a customer list sitting in a third-party log store.
  // `test/booking-audit-log.test.ts` asserts both survive redaction, because
  // "the field name happens not to match the denylist" is not a guarantee.
  //
  // ⚠️ `originHash` is EVIDENCE, never proof, and nothing automated may act on
  // it. It descends from `x-forwarded-for`, which this codebase already records
  // as client-forgeable, and CGNAT plus shared office wifi collapse many
  // unrelated people onto one value. It is for a human reading a trail after a
  // complaint, not for a rule that blocks somebody.
  log.info("booking.attempt", {
    space: space.slug,
    flow: space.flow,
    priceImmutableId: price.immutableId,
    originHash,
    // Whether the PLATFORM vouched for that address, or we merely read it out of
    // a header the caller wrote. Without this the trail cannot tell an address
    // worth following from one the attacker chose, and `originHash` is the field
    // that is supposed to separate an impersonator from an account holder.
    originAttested: request.ip.attested,
    submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
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
      ? await prepareReservation(
          request,
          price,
          branch.value,
          customerId,
          customerDetails,
          customFields.value
        )
      : await prepareSubscription(
          request,
          price,
          branch.value,
          customerId,
          customerDetails
        );

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
        : await reconcileSubscriptionForMobile(
            mobile,
            customerId,
            request.startAt!
          );

    const outcome = found.ok ? found.value.outcome : "unknown";

    if (outcome === "absent") {
      // Confidently not created, so the customer may simply try again. This is
      // the common case: a timeout usually means the request never completed.
      log.warn("booking.timeout_not_created", {
        space: space.slug,
        originHash,
        submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
      });
      await abandonIdempotent({ scope, key: request.idempotencyKey });
      return receipt;
    }

    // Either the booking EXISTS, or we could not ask. Both must hold the key: a
    // retry would duplicate a real booking in the first case, and might in the
    // second. The difference is only what the customer is told.
    const reference = found.ok && found.value.outcome === "found" ? found.value.reference : null;

    // 🔴 THE CODE, NEVER THE MESSAGE, and this is the SECOND of two independent
    // defences rather than the only one. `AppError.message` on this path is
    // assembled in `rekaz/client.ts` from up to 300 characters of raw upstream
    // body, and Rekaz runs ASP.NET Core, whose model-binding errors echo the
    // submitted value back verbatim. Every booking POST carries the name, mobile
    // and email the visitor typed, so a validation failure on any of them put
    // those values on this line under a key (`reason`) the logger's substring
    // denylist does not match, and `markIndeterminate` then wrote the same
    // string into `idempotency_keys.response_body` in Supabase, where it
    // outlives the log and sits in a table nobody thinks of as holding personal
    // data.
    //
    // `core/logger.ts` now runs `scrubValue` over every string value and
    // `rekaz/client.ts` applies it before the message is built, which closes it
    // at the source. Keeping the CODE here anyway costs one word of diagnostics
    // and does not depend on a pattern list matching a format nobody has seen
    // yet: a scrubber recognises the numbers it was taught, and this recognises
    // nothing because there is nothing to recognise.
    //
    // ⚠️ Rekaz's `traceId` is the first thing their support asks for and it is
    // NOT available here: it is parsed in `rekaz/client.ts` and not carried on
    // `AppError`, which has only `code`, `message`, `fields`, `retryAfterSeconds`
    // and `cause`. That client already logs the traceId on the same request
    // under `rekaz.request_failed`, so the pair is joinable by timestamp and
    // path. Carrying it here would mean adding a field in `core/errors.ts`.
    log.error("booking.indeterminate", {
      space: space.slug,
      outcome,
      reference,
      originHash,
      submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
      reason: receipt.error.code,
    });

    await markIndeterminate(scope, request.idempotencyKey, {
      space: space.slug,
      reason: receipt.error.code,
      reference,
    });

    // 🔴 THIS ROW MATTERS MORE THAN THE HAPPY-PATH ONE. The customer has just
    // been told to stop and contact MAZJ about a booking that may or may not
    // exist, and the `idempotency_keys` row holding the same fact DELETES ITSELF
    // after 24 hours. Without this, somebody ringing on Monday about Friday is
    // unfindable from our side.
    //
    // `reference` is set HERE and nowhere else, because reconciliation is the
    // only thing in the whole flow that ever learns one: a non-null value in
    // that column means exactly "this is the booking whose customer was told we
    // could not open payment".
    //
    // No payment link, because there is not one. That is the entire problem.
    //
    // Best effort, like every other write after the point of no return: a
    // failure here must not change what the customer is told, which is already
    // the most careful sentence on the path.
    const noted = await recordBooking({
      flow: space.flow,
      spaceSlug: space.slug,
      priceImmutableId: price.immutableId,
      // Recorded on this branch too, and it matters MORE here for the same
      // reason the row does: this is the booking somebody will ring about, and
      // "what was I charged" is the second question after "does it exist". The
      // price was resolved server-side long before the dispatch, so it is as
      // known here as on the happy path. Same `chargedAmount` as the happy path,
      // for the same reason: the desk must read the figure the buyer saw.
      amountSnapshot: chargedAmount(price),
      startsAt:
        space.flow === "reservation" ? request.slotFrom! : request.startAt!,
      reference,
      mobileHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
      originHash,
      status: "indeterminate",
    });

    if (!noted.ok) {
      log.error("booking.record_failed", {
        space: space.slug,
        outcome,
        reason: noted.error.message,
      });
    }

    return err(
      reference
        ? // 🔴 Confirmed created but unpayable: Rekaz exposes no payment link on
          // a fetched booking, so it CANNOT be recovered automatically. The
          // reference is what lets MAZJ finish this by hand.
          errors.conflict(
            `Your booking was created (reference ${reference}) but we could not open payment. Please contact us with that reference.`,
            { fields: { reference } }
          )
        : // 🔴 NOT `receipt.error`. That is `upstream_unavailable`, whose copy is
          // "Please try again in a moment", and the key has just been closed
          // PERMANENTLY: the same key now replays into the refusal above, and a
          // page refresh mints a NEW key that would create a second booking on a
          // write that may already have landed. The one code that must never
          // appear here is the one that invites a retry.
          bookingConflict(
            "unconfirmed",
            `Booking dispatched and unconfirmed: ${receipt.error.code}`
          )
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
      // response and a pointer to the customer go in the log, or the booking is
      // unfindable when someone calls to ask what happened.
      //
      // 🔴 This field CANNOT be called `receipt`. The word contains "ip", which
      // the logger's substring denylist matches, so the entire Rekaz response
      // was written as "[redacted]" on the exact path where somebody may have
      // been charged and we cannot tell them what for.
      rekazResponse: receipt.value,
      originHash,
      submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
    });
    await markIndeterminate(scope, request.idempotencyKey, {
      space: space.slug,
      reason: "no payment link",
    });
    // 🔴 Same reasoning as the indeterminate branch above: Rekaz answered 2xx,
    // so the booking almost certainly EXISTS, and the key has just been closed
    // permanently. `upstream_unavailable` reads as "try again in a moment",
    // which is the one thing this customer must not do. The full response is on
    // the `booking.no_payment_link` line above, so nothing diagnostic is lost by
    // dropping the cause.
    return err(
      bookingConflict("unconfirmed", "Rekaz answered 2xx with no payment link")
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
    // ⚠️ Rekaz documents `invoiceId` as always present and a real reservation
    // came back without it, so the receipt type now says `string | undefined`.
    // Collapsed to `""` here rather than made optional, matching what
    // `asBookingResult` already stores for a replayed key, so both routes to a
    // `BookingResult` produce the same shape. Everything downstream that cares
    // (the log line, the booking record) treats `""` as absent.
    invoiceId: receipt.value.invoiceId ?? "",
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

  // 🔴 BEST EFFORT, exactly like the idempotency store above it, and for the
  // same reason. The booking EXISTS, the invoice EXISTS and the buyer has a
  // payment link in hand. A bookkeeping failure here must NEVER turn that into a
  // reported failure, or somebody who has already been sold a room is told to
  // book it again.
  //
  // What it buys: an interrupted checkout can be resumed, and staff can answer
  // "I booked yesterday and never paid" without going digging in a Rekaz
  // dashboard that has no way to search by anything we know.
  //
  // 🔴 THE MOBILE IS STORED HASHED. This row is a marketing site's copy of a
  // booking, not the system of record: Rekaz holds the real customer file, and a
  // second raw phone book in our database is PDPL exposure bought for nothing.
  // The hash is the same pseudonym the audit trail already uses, so "is this row
  // the caller on the phone?" is answerable by hashing the number they read out.
  //
  // ⚠️ NO `reference` IS PASSED, and that is a rule rather than an omission.
  // Rekaz's create responses carry no human booking number at all, so any value
  // here would have come from somewhere that cannot know it. Learning the real
  // one would cost an extra sequential Rekaz call (measured 1.2s to 10.8s) on
  // the money path, after the payment link is already in hand. Staff resolve a
  // booking from the customer's MOBILE instead: measured 2026-07-28,
  // `GET /reservations?customerMobile=` genuinely filters, narrowing 562 rows to
  // 7 and reaching January 2025. That costs the buyer nothing, and the row below
  // is findable by the same number.
  //
  // 🔴 The two flows return DIFFERENT shapes and the record has a column for
  // each. A reservation carries `reservationIds`; a subscription carries its own
  // `id` and, on the live tenant, nothing under `reservationIds` at all despite
  // the shared type saying otherwise (see `createSubscription`). Sending both is
  // what stops the two subscription products storing a row with no Rekaz handle
  // on it, which would defeat the point of storing the row.
  const recorded = await recordBooking({
    flow: space.flow,
    spaceSlug: space.slug,
    priceImmutableId: price.immutableId,
    // 🔴 WHAT WE CHARGED, FROZEN, and the line above cannot substitute for it.
    // `immutableId` is a POINTER into a catalog the owner edits: resolving it
    // next month answers what that price costs next month, never what this buyer
    // was asked for. The day a price is corrected in the Rekaz dashboard, every
    // row here re-prices itself silently, and that edit is not a commit so no
    // diff would ever show it. Display-only: never a receipt, never with tax.
    //
    // 🔴 `chargedAmount`, NOT `price.amount`. The booking page renders
    // `discountedAmount` when it is set, so reading the list amount here would
    // record a number the buyer never saw the moment any price carries a
    // discount, which is the same dashboard edit this column exists to survive.
    // One function, both callers, so they cannot drift apart again.
    amountSnapshot: chargedAmount(price),
    // One column for both flows: the slot's `from` verbatim for a reservation,
    // the `YYYY-MM-DD` start for a subscription, which is all Rekaz was given.
    // Non-null by construction: `prepareReservation` refuses without a slot and
    // `prepareSubscription` refuses without a start date, and we are past both.
    startsAt: space.flow === "reservation" ? request.slotFrom! : request.startAt!,
    rekazReservationIds: receipt.value.reservationIds ?? null,
    rekazSubscriptionId: receipt.value.id ?? null,
    // `""` when Rekaz omitted it, which `recordBooking` stores as null.
    invoiceId: result.invoiceId,
    mobileHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
    originHash,
    // Already absolutised. `recordBooking` REFUSES a relative link, because a
    // stored relative path is a payment page nobody can reopen.
    paymentLink: result.paymentLink,
  });

  if (!recorded.ok) {
    // Our OWN database's error text, not Rekaz's, so it is safe to log verbatim.
    // The REK-019 rule above is about upstream bodies echoing what a visitor
    // typed; nothing here has been near the visitor's input.
    log.error("booking.record_failed", {
      space: space.slug,
      invoiceId: result.invoiceId,
      reason: recorded.error.message,
    });
  }

  return ok(result);
}

/**
 * A dispatch that has been fully validated but NOT yet sent.
 *
 * Returning a thunk is what lets the caller know, with certainty, that nothing
 * has reached Rekaz yet. Everything before this point can fail safely; the
 * moment it is invoked, a duplicate becomes possible.
 *
 * ⚠️ The optional `id` is the SUBSCRIPTION's own identifier. The two Rekaz
 * writes return different shapes (`createSubscription` returns the subscription
 * object, `createReservation` returns a receipt), and this type used to erase
 * that difference, which meant a subscription's only Rekaz handle was
 * unreachable from here. Optional rather than a second type because every
 * consumer wants the shared fields and only the booking record wants this one.
 */
type Dispatch = () => Promise<
  Result<RekazBookingReceipt & { id?: string }, AppError>
>;

async function prepareReservation(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  /** Set for a customer Rekaz already knows. Mutually exclusive with details. */
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined,
  /**
   * Already narrowed to the keys the product declares, cleaned and bounded.
   * 🔴 Never `request.customFields`: that is whatever the browser posted.
   */
  customFields: Record<string, string>
): Promise<Result<Dispatch, AppError>> {
  const { slotFrom, slotTo } = request;
  if (!slotFrom || !slotTo) {
    return err(errors.validation("Please choose a time.", { slot: "required" }));
  }

  // 🔴 Re-check availability server-side. The browser's view of the calendar is
  // as old as whenever it was fetched, and two people looking at the same
  // Tuesday morning is the ordinary case, not the edge case. Without this the
  // loser of that race gets an invoice for a room that is already taken.
  //
  // 🔴 THE RIYADH DAY, NOT `slotFrom.slice(0, 10)`.
  //
  // `slotFrom` is UTC, and `getSlots` runs everything it fetches through
  // `filterSlotsToRange`, which compares each window's RIYADH date against the
  // range asked for. The two disagree for every window starting at or after
  // 21:00 UTC, because that instant is already midnight in Al Khobar: the
  // customer's own slot is filtered out of its own re-check, `stillFree` comes
  // back false, and a perfectly valid booking is refused with "That time was
  // just taken."
  //
  // The events hall sells exactly those late windows, so this was a live refusal
  // waiting on a 9pm booking rather than a theoretical one. Pinned by
  // `booking.slotRecheck.test.ts`.
  //
  // ⚠️ It also changes the `StartDate`/`EndDate` we ask Rekaz for, and no test
  // can prove Rekaz still returns a 21:00Z window when asked about the following
  // Riyadh day. Rekaz PADS ranges rather than honouring them (see
  // `filterSlotsToRange`), so it returns more than the day requested, not less,
  // which is why this is the safe direction. Confirm against the live tenant
  // before treating it as settled.
  const day = riyadhDate(slotFrom);
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
          // Omitted entirely rather than sent empty: a product with no declared
          // fields must not gain a `customFields` key it never asked for.
          ...(Object.keys(customFields).length ? { customFields } : {}),
        },
      ],
    })
  );
}

async function prepareSubscription(
  request: BookingRequest,
  price: RekazPrice,
  branchId: string,
  /** Set for a customer Rekaz already knows. Mutually exclusive with details. */
  customerId: string | undefined,
  customerDetails: RekazCustomerDetails | undefined
): Promise<Result<Dispatch, AppError>> {
  const startAt = request.startAt;
  if (!startAt || !/^\d{4}-\d{2}-\d{2}$/.test(startAt)) {
    return err(
      errors.validation("Please choose a start date.", { startAt: "required" })
    );
  }

  // 🔴 BOUNDED, in both directions. A shape check alone accepted `2020-01-01`,
  // and the browser is the only thing that was stopping it: the date input's
  // `min` is a UI hint a crafted POST simply omits. A backdated subscription is
  // a paid membership whose term is already spent, which Rekaz has no reason to
  // reject and MAZJ has every reason to.
  //
  // The lower bound is TODAY IN RIYADH, not UTC. Between midnight and 3am local,
  // a UTC "today" is still yesterday, so a customer booking at 1am would have
  // their own current date refused as being in the past.
  const today = riyadhToday();
  if (startAt < today) {
    return err(
      errors.validation("That start date has already passed.", {
        startAt: "past",
      })
    );
  }

  // An upper bound too, so a typo in the year cannot create a subscription that
  // starts in 2126 and sits in the operations dashboard forever.
  const horizon = riyadhDate(new Date(Date.now() + MAX_START_DAYS_AHEAD * 86_400_000));
  if (startAt > horizon) {
    return err(
      errors.validation("Please choose a start date within the next year.", {
        startAt: "too_far",
      })
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
 * What Rekaz can tell us about the number on this booking. THREE answers.
 *
 * 🔴 "There is no such customer" and "we could not ask" are opposite facts, and
 * collapsing them into one `null` was the shape of two separate defects.
 *
 * On the WRITE path it decided the PAYLOAD. A failed lookup produced no
 * `customerId`, so the booking went out carrying `customerDetails` for a number
 * Rekaz already owns, which is the one payload Rekaz refuses (403,
 * `رقم الجوال مسجل مسبقاً لعميل آخر`). The buyer read "Something went wrong on
 * our side" and MAZJ lost a sale to a lookup blip. 284 customers are already in
 * that tenant, so this is the common case failing, not a rare one.
 *
 * On the RECONCILE path it dead-ended a FIRST-TIME buyer. `reconcileSubscription`
 * answers `unknown` for a null id, `unknown` is not `absent`, so the key was
 * marked indeterminate and closed forever. The browser holds one key for the
 * whole mounted form, so the customer's second press hit the replay branch and
 * was told to stop and contact MAZJ about a booking that had never existed.
 *
 * ⚠️ That reconcile call runs only AFTER a booking write already returned
 * `upstream_unavailable`, i.e. immediately after Rekaz proved it is unwell, and
 * it is a second call to the same upstream under the same ceiling. It is the
 * most likely moment in the whole flow for a lookup to fail, not an edge case.
 *
 * The log line is the only evidence separating the two afterwards, which is why
 * it carries `phase`: the same failure means different things at the two call
 * sites and a human reading the trail needs to know which one they are looking
 * at.
 *
 * `CustomerMatch` already carries three of the four answers, `ambiguous`
 * included, so this only ADDS the one the transport layer cannot express.
 * Restating the other three here would be a second copy of a vocabulary that
 * belongs to `rekaz/booking.ts`, free to drift.
 */
type CustomerLookup = CustomerMatch | { kind: "unavailable"; reason: string };

async function lookupCustomer(
  mobile: string,
  phase: "pre_write" | "reconcile"
): Promise<CustomerLookup> {
  const found = await findCustomerByMobile(mobile);

  if (found.ok) return found.value;

  log.warn("booking.customer_lookup_failed", {
    phase,
    reason: found.error.code,
    submitterHash: hashIdentifier(mobile, env().IP_HASH_SALT, "mobile"),
  });
  return { kind: "unavailable", reason: found.error.code };
}

/**
 * Did the subscription we just attempted actually get created?
 *
 * `reconcileSubscription` needs a `customerId`, which a first-time buyer does
 * not have on our side: the write itself was going to create the customer. So
 * the customer is looked up again, and which of the three answers comes back
 * decides everything.
 *
 * 🔴 CONFIRMED ABSENT IS A REAL ANSWER, and it is the one that rescues the
 * common case. A subscription created from `customerDetails` would necessarily
 * have created the customer too, so no customer means no subscription: the write
 * did not land, the key is safe to release, and the visitor simply tries again.
 * Reporting `unknown` there, which is what a null id produced, closed the key
 * permanently and sent somebody who had never been booked to "contact us".
 *
 * ⚠️ That rests entirely on "a subscription cannot exist without its customer",
 * which is the one claim here with real money behind it and no way to test it
 * against Rekaz without writing to the live tenant. The converse trap is
 * recorded in `reconcileSubscription`'s own doc: a customer EXISTING proves
 * nothing, because the write creates the customer first. Only this direction is
 * sound.
 */
async function reconcileSubscriptionForMobile(
  mobile: string,
  customerId: string | undefined,
  startAt: string
): Promise<Result<Reconciled, AppError>> {
  if (customerId) return reconcileSubscription({ customerId, startAt });

  const lookup = await lookupCustomer(mobile, "reconcile");

  if (lookup.kind === "found") {
    return reconcileSubscription({ customerId: lookup.customer.id, startAt });
  }

  if (lookup.kind === "none") return ok({ outcome: "absent" });

  // Either we could not ask (`unavailable`) or two records share the number
  // (`ambiguous`), and neither permits a conclusion: searching one of two
  // customers can prove a subscription exists but never that it does not. The
  // key is held and a human looks. This is the outcome the branch above exists
  // to stop being the ONLY outcome.
  return ok({ outcome: "unknown" });
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
 * Narrows the submitted custom fields to what the product actually declares.
 *
 * 🔴 THREE JOBS, and the browser was doing none of them.
 *
 * **Only declared keys survive.** The Server Action accepts any `cf:`-prefixed
 * form key, so an undeclared one used to ride into the Rekaz item untouched.
 * Unknown keys are DROPPED rather than refused: our own form cannot produce one,
 * so a refusal would only ever fire on a crafted post, and dropping keeps a
 * dashboard edit from breaking a live booking.
 *
 * **Values are cleaned and bounded**, the same treatment the name already gets.
 * A control character here reaches Postgres as `unsupported Unicode escape
 * sequence`, which this codebase maps to `upstream_unavailable`: a 503 blaming
 * our own database for a stranger's input. See `domain/text.ts`.
 *
 * **`isRequired` is enforced HERE.** It was a client attribute only, so the
 * browser's `required` was the entire enforcement and a crafted post skipped it.
 * The events hall declares two required fields; omitting either returns a Rekaz
 * 400, which becomes `internal` and reads to the visitor as our failure rather
 * than as a field they forgot.
 *
 * 🔴 A FILE FIELD IS SKIPPED ENTIRELY, INCLUDING ITS `isRequired`. Rekaz
 * publishes no upload endpoint, so this form cannot collect one at all, and
 * `components/booking/BookingFlow.tsx` does not render it. Enforcing it here
 * would refuse every events-hall booking on OUR side rather than theirs. Today
 * the tenant's only file field is optional (`docs/rekaz-api-findings.md`), so
 * this is a guard against somebody ticking a box in the Rekaz dashboard, not a
 * live workaround. `booking.customFields.test.ts` pins it with a file field
 * deliberately marked required.
 *
 * ⚠️ The mirror of that exemption: if the dashboard ever marks a required field
 * of any OTHER type, this refuses every booking for that product naming a
 * control the visitor cannot see. That is the correct alarm, and the fix is to
 * render the field, not to widen the exemption.
 */
function validateCustomFields(
  product: RekazProduct,
  submitted: Record<string, string> | undefined
): Result<Record<string, string>, AppError> {
  const clean: Record<string, string> = {};

  for (const field of product.customFields ?? []) {
    if (field.type === REKAZ_FILE_FIELD) continue;

    // Keyed by `name`, which is the GUID Rekaz expects back, NOT by `id`. They
    // differ, and sending the wrong one produces a field Rekaz silently ignores.
    const value = cleanFreeText(
      submitted?.[field.name] ?? "",
      MAX_CUSTOM_FIELD_LENGTH
    );

    if (!value) {
      if (field.isRequired) {
        // Named as the form input names it (`cf:<guid>`), so the page can point
        // at the control the visitor actually has to fix.
        return err(
          errors.validation("Please complete every field.", {
            [`cf:${field.name}`]: "required",
          })
        );
      }
      continue;
    }

    clean[field.name] = value;
  }

  return ok(clean);
}

// `resolveBranchId` moved to `server/rekaz/catalog.ts` on 2026-07-28, when event
// tickets became a second caller. Its behaviour is unchanged; see the comment
// there for why the events hall forces the fallback.
