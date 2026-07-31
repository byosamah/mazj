import "server-only";

import type { AppError } from "../core/errors";
import { log } from "../core/logger";
import { ok, type Result } from "../core/result";
import { listReservations, REKAZ_PAGE_MAX } from "./reservations";
import { listSubscriptions } from "./subscriptions";
import type { RekazReservation, RekazSubscription } from "./types";

/**
 * Answering "did that write actually land?" after Rekaz stops responding.
 *
 * 🔴 THE PROBLEM THIS SOLVES. Rekaz has no idempotency and no way to ask about a
 * request by id, so when a POST times out (routine: measured 1.2s to 10.8s
 * against a 10s ceiling) the booking may or may not exist and we cannot tell.
 * Assuming it failed duplicates a real customer's booking and invoice. Assuming
 * it succeeded strands someone who was never booked.
 *
 * So we go and look. Rekaz cannot answer "did request X succeed", but it can
 * answer "does a booking matching this description exist", and the second
 * question is good enough because we know exactly what we just tried to create.
 *
 * WHY THIS IS RELIABLE, measured against the live tenant:
 * - `GET /reservations` genuinely honours **`customerMobile`** (562 rows to 7,
 *   reaching records from January 2025), so the booking we just attempted is
 *   found by ASKING for it rather than by hoping it is still near the top of a
 *   creation-ordered list. ⚠️ The filter is a SUBSTRING match and tolerates the
 *   leading plus, so every returned row's own mobile is still compared against
 *   ours before anything is concluded.
 * - The unfiltered list is ordered **`creationTime` DESC**, so something created
 *   seconds ago is at the very top of page one. That is why it remains the
 *   second look: 🔴 the filtered call is an OPTIMISATION and never the sole
 *   evidence, because an empty filtered response is indistinguishable from the
 *   filter having quietly changed on an API with no versioning and no
 *   changelog. Nothing is ever reported ABSENT on the strength of one call.
 * - `GET /subscriptions` genuinely honours **`customerId`** (98 rows to 1),
 *   which is the one working filter on that resource. `customerMobile` does
 *   NOT work there (101 rows either way, measured 2026-07-28). The two
 *   endpoints disagree about which of their own filters they implement, so
 *   "it works on the other resource" is not evidence about this one.
 *
 * ⚠️ WHAT IT CANNOT DO. Neither response carries a payment link. So a
 * reconciled booking can be confirmed to EXIST and handed to operations with its
 * reference number, but the customer cannot be sent to checkout automatically.
 * That is a Rekaz limitation, not a design choice.
 */

/**
 * How recent a record must be to be attributable to the attempt we just made.
 *
 * Generous enough to cover a slow Rekaz commit after our own timeout, tight
 * enough that it cannot collide with an unrelated booking the same person made
 * earlier. The write in question was dispatched seconds ago.
 */
const WINDOW_MS = 5 * 60 * 1000;

/**
 * Compares two mobile numbers as Rekaz stores them versus as we send them.
 *
 * 🔴 Rekaz stores `966500000000`; we send E.164 `+966500000000`. A direct
 * comparison never matches, which would make reconciliation silently always
 * report "not found" and hand every timeout back as a duplicate-safe dead end.
 * Verified against real rows.
 */
function sameMobile(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const strip = (v: string) => v.replace(/[^0-9]/g, "");
  return strip(a) === strip(b) && strip(a).length > 0;
}

/**
 * Whether Rekaz gave us a mobile to compare at all.
 *
 * 🔴 NOT the same question as `sameMobile` returning false, and conflating the
 * two charges somebody twice. `customerMobile` comes back as an EMPTY STRING on
 * some older records (`docs/rekaz-api-findings.md`), so a row carrying our exact
 * `startAt`, created seconds ago, can still fail the mobile test for a reason
 * that says nothing at all about whose booking it is. Reporting that as
 * `absent`, which is the CONFIDENT answer, releases the idempotency key and
 * invites the customer to book again on top of a booking that already exists.
 */
function hasMobile(value: string | null | undefined): boolean {
  return !!value && /[0-9]/.test(value);
}

function isRecent(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t <= WINDOW_MS && t <= now + 60_000;
}

export type Reconciled =
  /** The booking exists upstream. Do NOT retry. */
  | { outcome: "found"; reference: string }
  /**
   * Confidently absent. Safe to let the customer try again.
   *
   * 🔴 The expensive answer, and the reason this module is written the way it
   * is. `absent` RELEASES the idempotency key, so a wrong one is a second real
   * reservation and a second real invoice for a real person. It is only ever
   * returned when every look we could take came back empty AND unambiguous.
   */
  | { outcome: "absent" }
  /**
   * Nothing may be concluded, so the caller must HOLD the idempotency key.
   *
   * 🔴 Three ways to land here and they must not be collapsed back into
   * `absent`: we could not ask at all, one of the two looks failed so the
   * evidence is incomplete, or we asked and the field we match on was blank on
   * a record that otherwise looks exactly like ours. The last one is rare, and
   * its cost is a duplicate booking and a duplicate invoice.
   */
  | { outcome: "unknown" };

/**
 * Did the reservation we just attempted actually get created?
 *
 * Matched on mobile AND exact start time AND recency, all three. Mobile alone
 * would match a different booking by the same person; start time alone would
 * match a different person in the same slot.
 *
 * 🔴 TWO LOOKS, AND `absent` NEEDS BOTH OF THEM TO AGREE.
 *
 * The first look is a QUERY: `customerMobile` is the one filter
 * `GET /reservations` honours, and it reaches the whole table rather than the
 * first page, so a match no longer depends on our row still being near the top
 * of a creation-ordered list of 562. That makes finding a booking exact and
 * cheap.
 *
 * The second look is the old unfiltered creation-ordered scan, and it is not
 * legacy weight. An empty FILTERED response is indistinguishable from the
 * filter having changed: Rekaz publishes no version and no changelog, we send
 * E.164 with a leading plus, and one exact-match tightening upstream would turn
 * every filtered call into a successful zero. `absent` is the outcome that
 * RELEASES the idempotency key and invites the customer to book again, so that
 * single upstream change would silently issue a second real reservation and a
 * second real invoice per affected customer. The unfiltered scan structurally
 * cannot fail that way, which is why nothing is ever called absent on the
 * strength of the query alone.
 *
 * So: `found` as soon as either look finds it, and `absent` only when BOTH
 * looked and both came back empty and unambiguous. Anything else is `unknown`,
 * which holds the key. The cost is one extra read on a path that only runs
 * after a Rekaz timeout in the first place.
 */
export async function reconcileReservation(input: {
  mobile: string;
  slotFrom: string;
  now?: Date;
}): Promise<Result<Reconciled, AppError>> {
  const now = (input.now ?? new Date()).getTime();

  const filtered = await listReservations({
    customerMobile: input.mobile,
    maxResultCount: REKAZ_PAGE_MAX,
  });

  if (!filtered.ok) {
    // Worth its own line. A reconcile that fell back to the scan is still
    // correct, but somebody should hear that the filter is failing before it
    // fails on a row the scan cannot reach either.
    log.warn("booking.reconcile_filter_failed", {
      kind: "reservation",
      reason: filtered.error.code,
    });
  }

  const asked: Reconciled = filtered.ok
    ? matchReservation(filtered.value.items, input.mobile, input.slotFrom, now)
    : { outcome: "unknown" };

  if (asked.outcome === "found") return ok(asked);

  // The scan works BECAUSE the unfiltered list is ordered by creation, so
  // something created seconds ago is at the top of page one. That property is
  // pinned by `test/rekaz.integration.test.ts`.
  const scanned = await listReservations({ maxResultCount: REKAZ_PAGE_MAX });
  if (!scanned.ok) {
    log.warn("booking.reconcile_failed", {
      kind: "reservation",
      reason: scanned.error.code,
    });
    return ok({ outcome: "unknown" });
  }

  const seen = matchReservation(scanned.value.items, input.mobile, input.slotFrom, now);
  if (seen.outcome === "found") return ok(seen);

  // 🔴 The one place `absent` can be produced, and it takes two clean looks.
  // If either was blocked or ambiguous the answer is `unknown`, which holds the
  // idempotency key: a held key costs a customer one conversation, a wrong
  // `absent` costs them a second invoice.
  return ok(
    asked.outcome === "absent" && seen.outcome === "absent"
      ? { outcome: "absent" }
      : { outcome: "unknown" }
  );
}

/**
 * Which of the returned rows, if any, is the one we just tried to create.
 *
 * Pure, so the substring near-miss and the blank-mobile case can be exercised
 * without a network, and so both looks in `reconcileReservation` are judged by
 * exactly the same rule. Exported for those two reasons and no other.
 */
export function matchReservation(
  items: RekazReservation[],
  mobile: string,
  slotFrom: string,
  now: number
): Reconciled {
  let blankIdentity = false;

  for (const r of items) {
    // Cheap, exact, and independent of anything Rekaz filtered, so it runs
    // first. A row for another slot tells us nothing either way.
    if (r.startAt !== slotFrom) continue;
    if (!isRecent(r.creationTime, now)) continue;

    // 🔴 `customerMobile` is a SUBSTRING filter upstream: asking for a number
    // also returns rows whose number merely CONTAINS it. Without this equality
    // check a stranger's booking in the same slot could be handed back to our
    // customer as their own reference number.
    if (sameMobile(r.customerMobile, mobile)) {
      return { outcome: "found", reference: String(r.reservationNumber) };
    }

    // Right slot, right moment, no mobile to compare. See `hasMobile`: this is
    // the one case that must NOT be reported as confidently absent.
    if (!hasMobile(r.customerMobile)) blankIdentity = true;
  }

  return blankIdentity ? { outcome: "unknown" } : { outcome: "absent" };
}

/**
 * Did the subscription we just attempted actually get created?
 *
 * Needs the customer first, because `startAt` alone is far too weak a signal on
 * subscriptions: many people start on the same day. `customerId` is the one
 * filter this endpoint genuinely honours.
 *
 * ⚠️ If the write created a NEW customer, that customer exists now even though
 * the subscription may not, so a customer lookup succeeding proves nothing on
 * its own. Only the subscription row counts.
 */
export async function reconcileSubscription(input: {
  customerId: string | null;
  startAt: string;
  now?: Date;
}): Promise<Result<Reconciled, AppError>> {
  const now = (input.now ?? new Date()).getTime();

  if (!input.customerId) {
    // No handle to search by. Refusing to guess is the whole point.
    return ok({ outcome: "unknown" });
  }

  const page = await listSubscriptions({
    customerId: input.customerId,
    maxResultCount: 100,
  });
  if (!page.ok) {
    log.warn("booking.reconcile_failed", { kind: "subscription", reason: page.error.code });
    return ok({ outcome: "unknown" });
  }

  const day = input.startAt.slice(0, 10);
  const match = page.value.items.find(
    (s: RekazSubscription) =>
      s.startAt?.slice(0, 10) === day && isRecent(s.creationTime, now)
  );

  if (match) {
    return ok({ outcome: "found", reference: match.subscriptionCode });
  }
  return ok({ outcome: "absent" });
}
