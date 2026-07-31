import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { hashIdentifier } from "../core/hash";
import { log } from "../core/logger";
import { err, ok, type Result } from "../core/result";
import { normalizePhone } from "../domain/phone";
import type { BookingFlow, SpaceSlug } from "../domain/spaces";
import { env } from "../env";
import { supabaseAdmin } from "../supabase/admin";

/**
 * Reading and writing the record of what MAZJ created in Rekaz.
 *
 * 🔴 WHY THIS TABLE EXISTS. Before it, the booking path dropped everything Rekaz
 * handed back the moment `createBooking` returned: the `reservationIds` array is
 * discarded at the point it is received, and the only surviving trace of a
 * purchase was an `idempotency_keys` row that deletes itself after 24 hours. A
 * customer phoning three days later was unfindable from our side.
 *
 * 🔴 A ROW IS FOUND BY MOBILE NUMBER, NOT BY A REFERENCE NUMBER. Rekaz's create
 * responses carry no human reference at all (`{invoiceId, reservationIds,
 * paymentLink}`), so a lookup keyed on the number a customer reads off their
 * invoice would find nothing, ever. The mobile works on both sides of the wall:
 * measured against the live tenant on 2026-07-28,
 * `GET /reservations?customerMobile=` genuinely filters, narrowing 562 rows to 7
 * and reaching records from January 2025. So "ask the customer for their mobile"
 * finds the booking here AND finds it upstream.
 *
 * ⚠️ Rekaz's filter is a SUBSTRING match, so a staff member reading that list
 * must check each row's own mobile before trusting it. The lookup here is an
 * exact match on a full HMAC and has no such failure mode.
 *
 * ⚠️ Every call here goes through `supabaseAdmin()`, which uses the secret key
 * and bypasses Row Level Security entirely. On a privileged client a filter IS
 * the access control rather than a convenience.
 *
 * 🔴 THE PAYMENT LINK IS A CAPABILITY, and it is deliberately absent from
 * `BookingRecord`. Exactly one function returns it, `getBookingPaymentLink`, and
 * its precondition is a caller already behind the admin's three access gates.
 * Nothing a visitor can reach may call it.
 */

/* -------------------------------------------------------------------------
 * 🔴 TEMPORARY LOCAL TYPES. DELETE THIS BLOCK WHEN THE GENERATED TYPES CATCH UP.
 *
 * `server/supabase/types.gen.ts` is generated and must never be hand-edited, and
 * it cannot be regenerated right now: Docker Desktop is stopped on the machine
 * this was written on. So the shapes the migration creates are declared here, by
 * hand, and reach the typed Supabase client through ONE cast in `bookingsDb()`
 * below. Nothing else in this module casts anything.
 *
 * The fix, in order, once Docker is running (or via the `--project-id` route in
 * server/CLAUDE.md, which needs no Docker):
 *
 *   1. `npm run db:push`
 *   2. `npm run db:types`
 *   3. delete `BookingRow`, `BookingInsert`, `BookingsSchema` and
 *      `BookingsDatabase`, and make `bookingsDb()` return `supabaseAdmin()`
 *      unchanged.
 *
 * ⚠️ Until step 2 happens these types are asserted, not checked. If they drift
 * from the migration, `tsc` will keep saying yes and Postgres will say no at
 * runtime. Keep them in the same edit as any change to
 * supabase/migrations/20260728140000_bookings.sql or any later migration that
 * alters the same table. `amount_snapshot` below arrived that way, in
 * supabase/migrations/20260729120000_bookings_amount_snapshot.sql.
 * ---------------------------------------------------------------------- */

type BookingRow = {
  id: string;
  created_at: string;
  updated_at: string;
  flow: string;
  space_slug: string;
  price_immutable_id: string;
  /**
   * `numeric(10, 2)`. The generated types emit `number | null` for a numeric
   * column, so this matches what a regeneration would produce, and `toRecord`
   * still runs it through `Number()` for the reason `server/db/events.ts` gives
   * about `ticket_amount`.
   */
  amount_snapshot: number | null;
  starts_at: string;
  rekaz_reservation_ids: string[] | null;
  rekaz_subscription_id: string | null;
  reference: string | null;
  invoice_id: string | null;
  payment_link: string | null;
  payment_link_purged_at: string | null;
  mobile_hash: string;
  origin_hash: string | null;
  status: string;
};

type BookingInsert = {
  flow: string;
  space_slug: string;
  price_immutable_id: string;
  amount_snapshot?: number | null;
  starts_at: string;
  mobile_hash: string;
  rekaz_reservation_ids?: string[] | null;
  rekaz_subscription_id?: string | null;
  reference?: string | null;
  invoice_id?: string | null;
  payment_link?: string | null;
  origin_hash?: string | null;
  status?: string;
};

type BookingsSchema = {
  Tables: {
    bookings: {
      Row: BookingRow;
      Insert: BookingInsert;
      Update: Partial<BookingInsert>;
      Relationships: [];
    };
  };
  Views: Record<string, never>;
  Functions: {
    bookings_purge_payment_links: {
      Args: { p_retain_hours?: number };
      Returns: number;
    };
  };
};

type BookingsDatabase = { public: BookingsSchema };

/** The single cast. See the block above. */
function bookingsDb(): SupabaseClient<BookingsDatabase> {
  return supabaseAdmin() as unknown as SupabaseClient<BookingsDatabase>;
}

/**
 * 🔴 The only two values anything can write, and the check constraint agrees.
 *
 * `paid`, `cancelled` and `expired` are absent because nothing can produce them:
 * Rekaz pushes no payment status and exposes no webhook, there is no cancel
 * wrapper in `server/rekaz/`, and there is no scheduled job in this repo. Adding
 * one when its writer arrives is a single `ALTER` plus a line here.
 */
export type BookingStatus = "pending" | "indeterminate";

/**
 * One booking, as operations sees it.
 *
 * 🔴 Three columns are deliberately NOT on this type.
 *
 * `mobile_hash` and `origin_hash` are pseudonyms for an audit trail and are
 * useless on a screen. A field that exists on a record ends up on a view model
 * and then in HTML, and a pseudonym rendered beside a booking is a correlation
 * handle we published for no reason.
 *
 * `payment_link` is left off for a stronger reason: it is a bearer capability to
 * pay for a named customer's purchase, and `listRecentBookings` hands back up to
 * 200 records in one call. A list has no use for the capability. Only
 * `getBookingPaymentLink` returns it, one row at a time, on purpose.
 */
export type BookingRecord = {
  id: string;
  createdAt: string;
  flow: BookingFlow;
  spaceSlug: SpaceSlug;
  priceImmutableId: string;
  /**
   * What MAZJ charged, frozen at the moment of sale.
   *
   * 🔴 `priceImmutableId` above is a POINTER INTO A CATALOG SOMEBODY EDITS, so
   * it can only ever answer "what does that price cost today". This is the one
   * field on the record that can say what this buyer was actually asked for.
   *
   * 🔴 NOT an invoice, NOT a receipt, NOT proof of payment, and it carries no
   * VAT line: Rekaz is the merchant of record and nothing here can learn whether
   * a booking was paid. Admin-only, and it must never reach a customer.
   *
   * Null on any row written before the column existed, and on any row whose
   * amount arrived unusable. Renderable as "not recorded"; never as zero.
   */
  amountSnapshot: number | null;
  startsAt: string;
  rekazReservationIds: string[] | null;
  rekazSubscriptionId: string | null;
  /**
   * `reservationNumber` or `subscriptionCode`.
   *
   * Null on every normal booking. Only the reconcile path ever learns one, which
   * makes a non-null value meaningful: this is a booking whose customer was told
   * "created, but we could not open payment, please contact us".
   */
  reference: string | null;
  invoiceId: string | null;
  /** Whether a live checkout link is still stored. The URL itself is not here. */
  hasPaymentLink: boolean;
  /** Set when retention took the link away. Distinct from never having had one. */
  paymentLinkPurgedAt: string | null;
  status: BookingStatus;
};

/**
 * ⚠️ `select("*")` rather than a column list, for the reason spelled out in
 * `server/db/events.ts`: supabase-js derives the row type from the string
 * literal, and a list built by concatenation widens to `string` and destroys the
 * inference.
 */
const COLUMNS = "*";

/**
 * How long a stored payment link may live. See the migration for the reasoning.
 *
 * ⚠️ The SQL function carries the same number as a DEFAULT, for anyone running it
 * by hand in psql. The application always passes this one explicitly, so THIS is
 * the value that governs the site. Change both, or change this one.
 */
const LINK_RETAIN_HOURS = 72;

function toRecord(row: BookingRow): BookingRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    flow: row.flow as BookingFlow,
    spaceSlug: row.space_slug as SpaceSlug,
    priceImmutableId: row.price_immutable_id,
    // `Number()` for the reason `server/db/events.ts` spells out for
    // `ticket_amount`: a `numeric` can cross PostgREST as a string, and amounts
    // this size convert losslessly.
    amountSnapshot:
      row.amount_snapshot === null ? null : Number(row.amount_snapshot),
    startsAt: row.starts_at,
    rekazReservationIds: row.rekaz_reservation_ids,
    rekazSubscriptionId: row.rekaz_subscription_id,
    reference: row.reference,
    invoiceId: row.invoice_id,
    hasPaymentLink: row.payment_link !== null,
    paymentLinkPurgedAt: row.payment_link_purged_at,
    status: row.status as BookingStatus,
  };
}

/**
 * Empty string to null.
 *
 * Rekaz returns absent fields as `undefined` and, on at least one path, as an
 * empty string. Storing `""` would defeat every `is not null` predicate in the
 * migration: the partial indexes would carry rows that answer nothing, and the
 * unique invoice index would treat two unrelated blank rows as a duplicate.
 */
function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * An amount the column will accept, or null.
 *
 * ⚠️ CLAMPED HERE RATHER THAN LET THE CHECK CONSTRAINT FIRE, deliberately, and
 * it is the same argument the bookings migration makes for pairing no handle
 * with `flow`. This insert runs AFTER the customer's money path has already
 * succeeded. A negative or non-finite amount reaching Postgres would raise
 * `23514` and destroy the only record of a real booking, in order to protect a
 * number that is display-only. Losing the amount is bad; losing the row is
 * worse. Both are visible: a null renders as "not recorded" rather than as zero.
 *
 * `NaN` is caught here too, because it would otherwise serialise to JSON `null`
 * on the way out and arrive as a stored null nobody chose.
 */
function amountOrNull(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type NewBooking = {
  flow: BookingFlow;
  spaceSlug: SpaceSlug;
  /** The immutable price handle, never Rekaz's rotating `id`. */
  priceImmutableId: string;
  /**
   * 🔴 `chargedAmount(price)` from `server/rekaz/catalog.ts`, which is the same
   * function the booking page renders on the submit button. NOT `price.amount`:
   * a Rekaz price carries both `amount` and `discountedAmount`, and the page has
   * always shown the discounted one when it is set, so reading the list amount
   * here would record a figure the buyer never saw.
   *
   * Pass it on every path that has a resolved price, because the handle beside
   * it re-prices the day the owner edits that price in Rekaz and there is then
   * nothing left that knows what this booking cost.
   *
   * Never a total assembled here, never with tax added: this is a snapshot of
   * one number, not a document.
   */
  amountSnapshot?: number | null;
  /**
   * When the booked thing begins.
   *
   * A reservation passes the slot's `from` verbatim (ISO 8601 UTC). A
   * subscription passes its `YYYY-MM-DD` start date, which lands at midnight UTC
   * because a day is all Rekaz was ever given.
   */
  startsAt: string;
  rekazReservationIds?: string[] | null;
  rekazSubscriptionId?: string | null;
  /**
   * 🔴 Only ever set from the reconcile path. No Rekaz create response carries a
   * reference, so passing one here on the happy path is a bug, not an
   * improvement: it would mean the value came from somewhere that cannot know it.
   */
  reference?: string | null;
  invoiceId?: string | null;
  /** 🔴 ABSOLUTE. Pass the output of `absolutePaymentLink`, never Rekaz's raw path. */
  paymentLink?: string | null;
  /** `hashIdentifier(mobile, env().IP_HASH_SALT, "mobile")`. Never the number itself. */
  mobileHash: string;
  /** `hashIp(ip, env().IP_HASH_SALT)`. Null when no address reached us. */
  originHash?: string | null;
  /** Defaults to `pending`. Pass `indeterminate` when the write was never confirmed. */
  status?: BookingStatus;
};

/**
 * Writes down a booking we just created upstream.
 *
 * 🔴 THE CALLER MUST TREAT THIS AS BEST EFFORT. A booking that succeeded in
 * Rekaz must never be reported to a customer as failed because our own
 * bookkeeping did not land afterwards. Log the failure and return the payment
 * link anyway, exactly as `services/booking.ts` already does when
 * `completeIdempotent` fails.
 *
 * ⚠️ It refuses a relative payment link rather than storing one with the field
 * quietly dropped. A relative link reaching here means the call site skipped
 * `absolutePaymentLink`, which is the single most expensive known trap in the
 * Rekaz integration: redirecting a browser to `/orders/pay/...` sends the buyer
 * to OUR origin and 404s the last click of the purchase. Refusing costs one
 * bookkeeping row and puts the regression in the error log on the very first
 * booking. Storing the row with the link silently missing would hide it.
 *
 * ⚠️ It also runs the retention purge, on every successful insert. That is the
 * ONLY thing that retires a stored payment link, because there is no cron in
 * this repo, so the sweep runs at the rate MAZJ takes bookings rather than on a
 * clock. See `purgeExpiredPaymentLinks`.
 */
export async function recordBooking(
  input: NewBooking
): Promise<Result<BookingRecord, AppError>> {
  const mobileHash = blankToNull(input.mobileHash);
  if (!mobileHash) {
    // No `fields` here: `core/errors.ts` reserves that for `validation_failed`,
    // and this is programmer error rather than something a visitor typed.
    return err(errors.internal("recordBooking: mobileHash is required"));
  }

  const paymentLink = blankToNull(input.paymentLink);
  if (paymentLink && !/^https?:\/\//i.test(paymentLink)) {
    return err(
      errors.internal(
        "recordBooking: payment link is not absolute. Pass absolutePaymentLink(link, REKAZ_API_BASE)."
      )
    );
  }

  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .insert({
        flow: input.flow,
        space_slug: input.spaceSlug,
        price_immutable_id: input.priceImmutableId,
        amount_snapshot: amountOrNull(input.amountSnapshot),
        starts_at: input.startsAt,
        rekaz_reservation_ids: input.rekazReservationIds?.length
          ? input.rekazReservationIds
          : null,
        rekaz_subscription_id: blankToNull(input.rekazSubscriptionId),
        reference: blankToNull(input.reference),
        invoice_id: blankToNull(input.invoiceId),
        payment_link: paymentLink,
        mobile_hash: mobileHash,
        origin_hash: blankToNull(input.originHash),
        status: input.status ?? "pending",
      })
      .select(COLUMNS)
      .single();

    if (error) return err(writeError("record booking", error));

    // Retention, riding on the one call site this table reliably has. Awaited so
    // it cannot be killed mid-flight by a serverless freeze, and its failure is
    // never allowed to turn a recorded booking into a failed one.
    const purged = await purgeExpiredPaymentLinks();
    if (!purged.ok) {
      log.warn("booking.link_purge_failed", { reason: purged.error.message });
    }

    return ok(toRecord(data));
  } catch (cause) {
    return err(fromUnknown(cause, "record booking"));
  }
}

/**
 * Retires stored payment links older than the retention window.
 *
 * 🔴 A stored link is a capability: whoever holds it can pay for that booking,
 * and it identifies one customer's purchase. Retention is what keeps a database
 * of live "pay for this" URLs from accumulating forever.
 *
 * ⚠️ Called from `recordBooking` and nowhere else, so the sweep is bounded by
 * booking traffic rather than by the clock: a link created on a Friday outlives
 * 72 hours if nobody books again until Tuesday. Exported so the scheduled job
 * that the abandoned-hold sweep will need can call it directly and close that
 * gap. Idempotent, so calling it from both costs nothing.
 */
export async function purgeExpiredPaymentLinks(
  retainHours: number = LINK_RETAIN_HOURS
): Promise<Result<number, AppError>> {
  try {
    const { data, error } = await bookingsDb().rpc(
      "bookings_purge_payment_links",
      { p_retain_hours: retainHours }
    );

    if (error) return err(dbError("purge payment links", error.message));
    return ok(data ?? 0);
  } catch (cause) {
    return err(fromUnknown(cause, "purge payment links"));
  }
}

// ---------------------------------------------------------------------------
// Admin reads
// ---------------------------------------------------------------------------

/**
 * THE STAFF LOOKUP: a customer phones and gives their mobile number.
 *
 * 🔴 This proves NOTHING about the caller and is not supposed to. Its
 * precondition is an authenticated `@mazj.org` session that has already passed
 * the admin's three access gates. Never call it from anything a visitor can
 * reach: a public form taking a mobile number and answering with that number's
 * booking history is an account-existence oracle and a PDPL disclosure, and the
 * fact that the number was typed by whoever asked is not consent.
 *
 * The caller supplies the HASH, not the number, so this module never sees a
 * phone number and the value joins the booking row, the per-mobile rate-limit
 * bucket and the audit log line. Build it the same way `services/booking.ts`
 * does:
 *
 *   `hashIdentifier(normalizePhone(typed)!, env().IP_HASH_SALT, "mobile")`
 *
 * 🔴 Normalise FIRST. `domain/phone.ts` turns `٠٥٣٤٦٠٠٤٨٨`, `053 460 0488` and
 * `+966 (0)53 460 0488` into one canonical E.164 string, and hashing any other
 * form produces a value that matches nothing.
 */
/**
 * Every booking MAZJ holds for one mobile number, given the number as typed.
 *
 * The hashing wrapper around `findBookingsByMobileHash`, so a caller never
 * handles the salt and this module still never stores a phone number. It lives
 * here rather than in the admin because the normalise-then-hash pair is the
 * whole correctness of the lookup: get either half wrong and the query is not
 * an error, it is a confident "no bookings" for a customer who has ten.
 *
 * 🔴 Same precondition as the function it wraps: an authenticated `@mazj.org`
 * session. Never reachable from a public form.
 */
export async function bookingsByMobile(
  mobile: string,
  limit = 20
): Promise<Result<BookingRecord[], AppError>> {
  // Normalise BEFORE hashing, or the value matches nothing. `053 460 0488`,
  // `+966 (0)53 460 0488` and the Arabic-keyboard `٠٥٣٤٦٠٠٤٨٨` are the same
  // number and must reach the same hash, and only `domain/phone.ts` knows that.
  const normalised = normalizePhone(mobile);
  if (!normalised) {
    // `validation_failed` rather than `internal`, because this is somebody at
    // the desk typing a number wrong, not a fault. The admin renders its own
    // sentence from the code and never shows this message.
    return err(errors.validation("Not a mobile number we can look up."));
  }

  return findBookingsByMobileHash(
    hashIdentifier(normalised, env().IP_HASH_SALT, "mobile"),
    limit
  );
}

export async function findBookingsByMobileHash(
  mobileHash: string,
  limit = 20
): Promise<Result<BookingRecord[], AppError>> {
  const hash = blankToNull(mobileHash);
  if (!hash) {
    // An empty filter on a client that bypasses RLS returns the whole table.
    return err(errors.internal("findBookingsByMobileHash: hash is required"));
  }

  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .select(COLUMNS)
      // 🔴 On a client that bypasses RLS, this filter IS the access control.
      .eq("mobile_hash", hash)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(limit));

    if (error) return err(dbError("find bookings by mobile", error.message));
    return ok((data ?? []).map(toRecord));
  } catch (cause) {
    return err(fromUnknown(cause, "find bookings by mobile"));
  }
}

/**
 * The narrow second lookup: a customer quoting a reference number.
 *
 * ⚠️ This finds only the small set of bookings the reconcile path ever learned a
 * reference for, i.e. the ones where Rekaz timed out after the write and our own
 * error copy told the customer "your booking was created (reference X) but we
 * could not open payment". Those are exactly the calls MAZJ receives, which is
 * why the lookup exists, but a customer quoting a number off a paid invoice will
 * NOT be found here. Ask for their mobile instead.
 *
 * `reference` is deliberately not unique in the schema, so the newest match wins
 * rather than a rare collision turning a support call into a 500.
 */
export async function getBookingByReference(
  reference: string
): Promise<Result<BookingRecord | null, AppError>> {
  const value = blankToNull(reference);
  if (!value) {
    return err(errors.internal("getBookingByReference: reference is required"));
  }

  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .select(COLUMNS)
      .eq("reference", value)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return err(dbError("get booking by reference", error.message));
    return ok(data ? toRecord(data) : null);
  } catch (cause) {
    return err(fromUnknown(cause, "get booking by reference"));
  }
}

export async function getBookingById(
  id: string
): Promise<Result<BookingRecord | null, AppError>> {
  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .select(COLUMNS)
      .eq("id", id)
      // `maybeSingle`, not `single`: `single` reports "no such row" as a database
      // error, which turns a mistyped id into a 500 instead of a not-found.
      .maybeSingle();

    if (error) return err(dbError("get booking", error.message));
    return ok(data ? toRecord(data) : null);
  } catch (cause) {
    return err(fromUnknown(cause, "get booking"));
  }
}

/**
 * The admin list, newest first.
 *
 * Bounded rather than paginated. This table grows with every booking, so unlike
 * `events` it cannot be read whole, and a dashboard asking "what happened
 * recently" wants a window rather than a page control. Add real pagination when
 * a screen needs to walk backwards.
 */
export async function listRecentBookings(
  limit = 50
): Promise<Result<BookingRecord[], AppError>> {
  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(boundedLimit(limit));

    if (error) return err(dbError("list bookings", error.message));
    return ok((data ?? []).map(toRecord));
  } catch (cause) {
    return err(fromUnknown(cause, "list bookings"));
  }
}

/**
 * The stored checkout URL for one booking, if it still has one.
 *
 * 🔴 THE ONE FUNCTION IN THIS MODULE THAT HANDS BACK A CAPABILITY. Whoever holds
 * the returned URL can pay for this booking. Its only legitimate use is a member
 * of staff, behind the admin's three access gates, finishing a purchase a
 * customer walked away from. It must never be reachable from a public route, and
 * it must never be rendered into a page that anything but an admin session can
 * load.
 *
 * Returns null in three different situations that a screen should NOT collapse
 * into one sentence: retention purged it (`paymentLinkPurgedAt` is set), Rekaz
 * never gave us one (an indeterminate write, which is a support case), or there
 * is no such booking. Read the record alongside this to tell them apart.
 */
export async function getBookingPaymentLink(
  id: string
): Promise<Result<string | null, AppError>> {
  try {
    const { data, error } = await bookingsDb()
      .from("bookings")
      .select("payment_link")
      .eq("id", id)
      .maybeSingle();

    if (error) return err(dbError("get payment link", error.message));
    return ok(data?.payment_link ?? null);
  } catch (cause) {
    return err(fromUnknown(cause, "get payment link"));
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Keeps a caller's `limit` inside something a dashboard can actually render. */
function boundedLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit) || 1, 1), 200);
}

function dbError(context: string, message: string): AppError {
  return errors.upstreamUnavailable(`${context}: ${message}`);
}

/**
 * Turns the constraint that fired into something a caller can act on.
 *
 * Postgres codes: `23505` unique violation, `23514` check violation. Without
 * this every one of them surfaces as "our database is unavailable", which is
 * both untrue and unactionable when the real problem is that the same invoice
 * was recorded twice.
 */
function writeError(
  context: string,
  error: { code?: string; message: string }
): AppError {
  if (error.code === "23505") {
    // Almost certainly `bookings_invoice_idx`: this booking is already written
    // down. A conflict rather than an error, because the record we wanted to
    // exist does exist.
    return errors.conflict("That booking is already recorded.", {
      fields: { invoiceId: "duplicate" },
    });
  }
  if (error.code === "23514") {
    if (error.message.includes("bookings_purged_link_is_gone")) {
      return errors.internal(
        "recordBooking: a purged payment link cannot also be stored."
      );
    }
    return errors.internal(`${context}: a stored value is out of range.`);
  }
  return dbError(context, error.message);
}
