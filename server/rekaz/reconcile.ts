import "server-only";

import type { AppError } from "../core/errors";
import { log } from "../core/logger";
import { ok, type Result } from "../core/result";
import { listReservations } from "./reservations";
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
 * - `GET /reservations` is ordered **`creationTime` DESC**, so something created
 *   seconds ago is at the very top of page one. No paging, no filters (which
 *   Rekaz ignores anyway).
 * - `GET /subscriptions` genuinely honours **`customerId`** (98 rows to 1),
 *   which is the one working filter on that resource.
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

function isRecent(iso: string | null | undefined, now: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return Number.isFinite(t) && now - t <= WINDOW_MS && t <= now + 60_000;
}

export type Reconciled =
  /** The booking exists upstream. Do NOT retry. */
  | { outcome: "found"; reference: string }
  /** Confidently absent. Safe to let the customer try again. */
  | { outcome: "absent" }
  /** We could not ask. Nothing may be concluded. */
  | { outcome: "unknown" };

/**
 * Did the reservation we just attempted actually get created?
 *
 * Matched on mobile AND exact start time AND recency, all three. Mobile alone
 * would match a different booking by the same person; start time alone would
 * match a different person in the same slot.
 */
export async function reconcileReservation(input: {
  mobile: string;
  slotFrom: string;
  now?: Date;
}): Promise<Result<Reconciled, AppError>> {
  const now = (input.now ?? new Date()).getTime();

  // One page is enough BECAUSE the ordering is by creation. If Rekaz ever
  // changes that, this quietly stops finding anything, which is why
  // `test/rekaz.integration.test.ts` pins the ordering.
  const page = await listReservations({ maxResultCount: 100 });
  if (!page.ok) {
    log.warn("booking.reconcile_failed", { kind: "reservation", reason: page.error.code });
    return ok({ outcome: "unknown" });
  }

  const match = page.value.items.find(
    (r: RekazReservation) =>
      sameMobile(r.customerMobile, input.mobile) &&
      r.startAt === input.slotFrom &&
      isRecent(r.creationTime, now)
  );

  if (match) {
    return ok({ outcome: "found", reference: String(match.reservationNumber) });
  }
  return ok({ outcome: "absent" });
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
