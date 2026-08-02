import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { err, ok, type Result } from "../core/result";
import type { DatePrecision } from "../domain/events";
import { supabaseAdmin } from "../supabase/admin";
import type { Database } from "../supabase/types.gen";

/**
 * Reading and writing the events programme.
 *
 * ⚠️ Every call here goes through `supabaseAdmin()`, which uses the secret key
 * and **bypasses Row Level Security entirely**. On a privileged client a filter
 * IS the access control rather than a convenience, so every registration query
 * below is scoped by `event_id` and never left open.
 *
 * That is safe for `events` in a way it would not be for a per-customer table:
 * an admin legitimately sees every event, and the public reader is given a
 * narrowed view model by `app/[locale]/events/_lib`, never a row.
 */

type Row = Database["public"]["Tables"]["events"]["Row"];
type RegistrationRow =
  Database["public"]["Tables"]["event_registrations"]["Row"];

export type EventStatus = "draft" | "published" | "cancelled";

export type RegistrationStatus =
  | "confirmed"
  | "pending_payment"
  | "expired"
  | "cancelled";

/** One event, faithful to the row, with both languages intact. */
export type EventRecord = {
  id: string;
  slug: string;
  status: EventStatus;
  title: { en: string | null; ar: string | null };
  summary: { en: string | null; ar: string | null };
  description: { en: string | null; ar: string | null };
  host: { en: string | null; ar: string | null };
  location: { en: string | null; ar: string | null };
  series: string | null;
  edition: string | null;
  startsAt: string;
  endsAt: string;
  datePrecision: DatePrecision;
  posterPath: string | null;
  capacity: number | null;
  rekazPriceImmutableId: string | null;
  ticketAmount: number | null;
  createdAt: string;
};

export type RegistrationRecord = {
  id: string;
  eventId: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  status: RegistrationStatus;
  holdExpiresAt: string | null;
  rekazReference: string | null;
  rekazPaymentLink: string | null;
  locale: string;
  createdAt: string;
};

/**
 * ⚠️ `select("*")`, not a hand-written column list, and not by preference.
 *
 * `supabase-js` derives the row type from the STRING LITERAL passed to
 * `select()`. A column list built by concatenation widens to `string`, the
 * inference falls back to `GenericStringError`, and every `.map(toRecord)`
 * below fails to compile with an error that names `String` and explains
 * nothing. Assembling the list at all bought nothing here: the table is 23
 * narrow columns and the only one this file drops is `updated_at`.
 */
const COLUMNS = "*";

function toRecord(row: Row): EventRecord {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status as EventStatus,
    title: { en: row.title_en, ar: row.title_ar },
    summary: { en: row.summary_en, ar: row.summary_ar },
    description: { en: row.description_en, ar: row.description_ar },
    host: { en: row.host_en, ar: row.host_ar },
    location: { en: row.location_en, ar: row.location_ar },
    series: row.series,
    edition: row.edition,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    datePrecision: row.date_precision as DatePrecision,
    posterPath: row.poster_path,
    capacity: row.capacity,
    rekazPriceImmutableId: row.rekaz_price_immutable_id,
    // `numeric` crosses PostgREST as a string, because JavaScript numbers cannot
    // hold every value the column can. Amounts here are small enough that the
    // conversion is lossless, and it is display-only regardless: what is
    // actually charged is resolved live from Rekaz.
    ticketAmount: row.ticket_amount === null ? null : Number(row.ticket_amount),
    createdAt: row.created_at,
  };
}

function toRegistration(row: RegistrationRow): RegistrationRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    fullName: row.full_name,
    email: row.email,
    phoneE164: row.phone_e164,
    status: row.status as RegistrationStatus,
    holdExpiresAt: row.hold_expires_at,
    rekazReference: row.rekaz_reference,
    rekazPaymentLink: row.rekaz_payment_link,
    locale: row.locale,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Every published event, newest first.
 *
 * 🔴 Returns ALL of them in one query rather than one query for "upcoming" and
 * another for "past". The split between those two is `ends_at` versus now, and
 * asking the database twice means two different `now()` values: an event ending
 * in the next few milliseconds can appear in both lists or in neither. The
 * split happens once, in `app/[locale]/events/_lib`, against a single clock.
 *
 * The whole archive is 41 rows and grows by a handful a year, so paginating it
 * would add a control nobody needs. Revisit past a few hundred.
 */
export async function listPublishedEvents(): Promise<
  Result<EventRecord[], AppError>
> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select(COLUMNS)
      .eq("status", "published")
      .order("starts_at", { ascending: false })
      // Deterministic tiebreak. Six imported events record only a month and are
      // all anchored to the 15th, so without this their order is whatever
      // Postgres felt like and could differ between two renders of one page.
      .order("slug", { ascending: true });

    if (error) return err(dbError("list published events", error.message));
    return ok((data ?? []).map(toRecord));
  } catch (cause) {
    return err(fromUnknown(cause, "list published events"));
  }
}

/** Everything, drafts included. The admin list. */
export async function listAllEvents(): Promise<Result<EventRecord[], AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select(COLUMNS)
      .order("starts_at", { ascending: false })
      // The same deterministic tiebreak `listPublishedEvents` carries, and the
      // admin is the surface that actually suffers without it: six imported
      // events record only a month and are all anchored to the 15th, so their
      // order was whatever Postgres felt like and could differ between two
      // renders of this list. An operator scanning for one of them reads a
      // sequence that moves under them.
      .order("slug", { ascending: true });

    if (error) return err(dbError("list events", error.message));
    return ok((data ?? []).map(toRecord));
  } catch (cause) {
    return err(fromUnknown(cause, "list events"));
  }
}

export async function getEventBySlug(
  slug: string
): Promise<Result<EventRecord | null, AppError>> {
  return getEventBy("slug", slug);
}

export async function getEventById(
  id: string
): Promise<Result<EventRecord | null, AppError>> {
  return getEventBy("id", id);
}

async function getEventBy(
  column: "slug" | "id",
  value: string
): Promise<Result<EventRecord | null, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .select(COLUMNS)
      .eq(column, value)
      // `maybeSingle`, not `single`: `single` treats "no such event" as a
      // database error, which would turn every mistyped URL into a 500 instead
      // of the branded 404 the route is built to render.
      .maybeSingle();

    if (error) return err(dbError(`get event by ${column}`, error.message));
    return ok(data ? toRecord(data) : null);
  } catch (cause) {
    return err(fromUnknown(cause, `get event by ${column}`));
  }
}

/**
 * Seats taken, per event.
 *
 * 🔴 Delegates to `public.event_seats_taken` rather than counting rows here.
 * "Taken" means confirmed OR holding an unexpired hold, and `event_claim_seat`
 * already enforces exactly that when selling. Restating it in TypeScript is how
 * a page ends up advertising seats the claim function refuses to sell.
 */
export async function seatsTakenFor(
  eventIds: string[]
): Promise<Result<Map<string, number>, AppError>> {
  if (eventIds.length === 0) return ok(new Map());

  try {
    const { data, error } = await supabaseAdmin().rpc("event_seats_taken", {
      p_event_ids: eventIds,
    });

    if (error) return err(dbError("count seats", error.message));

    const counts = new Map<string, number>();
    for (const row of data ?? []) counts.set(row.event_id, row.taken);
    return ok(counts);
  } catch (cause) {
    return err(fromUnknown(cause, "count seats"));
  }
}

/** One event's registrations, newest first. Admin only. */
export async function listRegistrations(
  eventId: string
): Promise<Result<RegistrationRecord[], AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("event_registrations")
      .select("*")
      // 🔴 On a client that bypasses RLS, this filter IS the access control.
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) return err(dbError("list registrations", error.message));
    return ok((data ?? []).map(toRegistration));
  } catch (cause) {
    return err(fromUnknown(cause, "list registrations"));
  }
}

export async function getRegistrationById(
  id: string
): Promise<Result<RegistrationRecord | null, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("event_registrations")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) return err(dbError("get registration", error.message));
    return ok(data ? toRegistration(data) : null);
  } catch (cause) {
    return err(fromUnknown(cause, "get registration"));
  }
}

// ---------------------------------------------------------------------------
// Claiming a seat
// ---------------------------------------------------------------------------

export type ClaimOutcome =
  | "claimed"
  | "duplicate"
  | "full"
  | "closed"
  | "not_found";

export type ClaimResult = {
  outcome: ClaimOutcome;
  registrationId: string | null;
  registrationStatus: RegistrationStatus | null;
  seatsLeft: number | null;
};

/**
 * Claims one seat, atomically.
 *
 * 🔴 The whole decision happens inside `public.event_claim_seat`, under a row
 * lock on the event. Do NOT be tempted to "simplify" this into a count followed
 * by an insert: two concurrent requests both read the last free seat before
 * either writes, both succeed, and thirty-one people arrive at a room that
 * seats thirty. Measured on the live database, 12 simultaneous claims against a
 * one-seat event produced exactly one `claimed` and eleven `full`.
 */
export async function claimSeat(input: {
  eventId: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  locale: string;
  ipHash: string | null;
  /** 0 confirms immediately (a free event). Anything else holds the seat. */
  holdSeconds: number;
}): Promise<Result<ClaimResult, AppError>> {
  try {
    const { data, error } = await supabaseAdmin().rpc("event_claim_seat", {
      p_event_id: input.eventId,
      p_full_name: input.fullName,
      p_phone_e164: input.phoneE164,
      p_locale: input.locale,
      p_hold_seconds: input.holdSeconds,
      // ⚠️ Both are genuinely nullable in Postgres and null is the correct
      // value for "no email given" and "no address reached us". Supabase's type
      // generator emits every `text` parameter as non-nullable `string`
      // regardless, because a SQL signature does not record nullability. The
      // cast states that gap rather than corrupting the data to satisfy it:
      // coercing null to "" here would store an empty string, which then reads
      // downstream as an email that exists and is blank.
      //
      // Verified against the live function on 2026-07-28: passing null works.
      p_email: input.email as unknown as string,
      p_ip_hash: input.ipHash as unknown as string,
    });

    if (error) return err(dbError("claim seat", error.message));

    const row = data?.[0];
    if (!row) {
      return err(errors.internal("event_claim_seat returned no row"));
    }

    return ok({
      outcome: row.outcome as ClaimOutcome,
      registrationId: row.registration_id,
      registrationStatus: row.registration_status as RegistrationStatus | null,
      seatsLeft: row.seats_left,
    });
  } catch (cause) {
    return err(fromUnknown(cause, "claim seat"));
  }
}

/** Releases lapsed payment holds for one event. Idempotent. */
export async function expireHolds(
  eventId: string
): Promise<Result<number, AppError>> {
  try {
    const { data, error } = await supabaseAdmin().rpc("event_expire_holds", {
      p_event_id: eventId,
    });

    if (error) return err(dbError("expire holds", error.message));
    return ok(data ?? 0);
  } catch (cause) {
    return err(fromUnknown(cause, "expire holds"));
  }
}

/**
 * Records the Rekaz order a held seat is waiting on.
 *
 * The payment link is stored so an interrupted buyer is handed the SAME
 * checkout instead of creating a second order. Rekaz exposes no way to recover
 * a payment link for an existing booking, so if this write is lost the only
 * remaining thread is the reference.
 */
export async function attachRekazOrder(input: {
  registrationId: string;
  reference: string | null;
  paymentLink: string;
}): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin()
      .from("event_registrations")
      .update({
        rekaz_reference: input.reference,
        rekaz_payment_link: input.paymentLink,
      })
      .eq("id", input.registrationId);

    if (error) return err(dbError("attach rekaz order", error.message));
    return ok();
  } catch (cause) {
    return err(fromUnknown(cause, "attach rekaz order"));
  }
}

/**
 * Gives a claimed seat back.
 *
 * `cancelled`, not `expired`. The two are different facts and the admin list
 * shows them differently: `expired` means a buyer walked away and the hold
 * lapsed on its own, `cancelled` means we deliberately released it because
 * something on our side failed. Collapsing them would hide a broken ticket
 * product behind what looks like ordinary buyer drop-off.
 */
export async function releaseSeat(
  registrationId: string
): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin()
      .from("event_registrations")
      .update({ status: "cancelled", hold_expires_at: null })
      .eq("id", registrationId);

    if (error) return err(dbError("release seat", error.message));
    return ok();
  } catch (cause) {
    return err(fromUnknown(cause, "release seat"));
  }
}

// ---------------------------------------------------------------------------
// Admin writes
// ---------------------------------------------------------------------------

export type EventDraft = {
  slug: string;
  status: EventStatus;
  titleEn: string | null;
  titleAr: string | null;
  summaryEn: string | null;
  summaryAr: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  hostEn: string | null;
  hostAr: string | null;
  locationEn: string | null;
  locationAr: string | null;
  series: string | null;
  edition: string | null;
  startsAt: string;
  endsAt: string;
  /**
   * 🔴 How much of the start time a human actually wrote down, carried by the
   * caller rather than assumed here. See `toColumns`.
   */
  datePrecision: DatePrecision;
  posterPath: string | null;
  capacity: number | null;
  rekazPriceImmutableId: string | null;
  ticketAmount: number | null;
};

function toColumns(draft: EventDraft) {
  return {
    slug: draft.slug,
    status: draft.status,
    title_en: draft.titleEn,
    title_ar: draft.titleAr,
    summary_en: draft.summaryEn,
    summary_ar: draft.summaryAr,
    description_en: draft.descriptionEn,
    description_ar: draft.descriptionAr,
    host_en: draft.hostEn,
    host_ar: draft.hostAr,
    location_en: draft.locationEn,
    location_ar: draft.locationAr,
    series: draft.series,
    edition: draft.edition,
    starts_at: draft.startsAt,
    ends_at: draft.endsAt,
    // 🔴 FROM THE FORM, never a constant, and the comment that used to sit here
    // was a false rationale rather than a small mistake. It claimed the lossy
    // precisions "never come through here" because only the historical import
    // creates them. Measured: `app/admin/(protected)/events/page.tsx` links ALL
    // 41 imported rows to this editor, and 4 of them record only a month. So
    // opening "sometime in March 2024" and pressing Save rewrote it to an exact
    // day and hour nobody chose, permanently, with the admin then disagreeing
    // with the public archive it feeds.
    //
    // A `timestamptz` always holds a clock time. That is not evidence anybody
    // recorded one, and this column is the only thing that remembers the
    // difference.
    date_precision: draft.datePrecision,
    poster_path: draft.posterPath,
    capacity: draft.capacity,
    rekaz_price_immutable_id: draft.rekazPriceImmutableId,
    ticket_amount: draft.ticketAmount,
  };
}

export async function insertEvent(
  draft: EventDraft
): Promise<Result<EventRecord, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .insert(toColumns(draft))
      .select(COLUMNS)
      .single();

    if (error) return err(writeError("create event", error));
    return ok(toRecord(data));
  } catch (cause) {
    return err(fromUnknown(cause, "create event"));
  }
}

export async function updateEvent(
  id: string,
  draft: EventDraft
): Promise<Result<EventRecord, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .update(toColumns(draft))
      .eq("id", id)
      .select(COLUMNS)
      .single();

    if (error) return err(writeError("update event", error));
    return ok(toRecord(data));
  } catch (cause) {
    return err(fromUnknown(cause, "update event"));
  }
}

/**
 * Moves ONE event between draft, published and cancelled, and touches nothing
 * else.
 *
 * 🔴 `.eq("status", from)` IS the concurrency control, exactly as the startups
 * queue's conditional update is. Two people with the events list open, or one
 * person with a tab that has been sitting there since this morning, are both
 * looking at a status that may already have moved. Writing `to` unconditionally
 * would let a stale tab silently republish something a colleague pulled down
 * ten minutes ago, and neither of them would ever know.
 *
 * ⚠️ So `null` here means NO ROW MATCHED, which is three different situations
 * and the caller has to tell them apart by reading the row: the event is gone,
 * somebody else moved it, or it is already at `to`. Only the middle one is a
 * conflict, and reporting all three as one is how an operator ends up being told
 * "that failed" about a change that has in fact already happened.
 *
 * The bilingual check constraint still guards the `published` transition
 * independently, and `writeError` maps it. `missingToPublish` is what turns it
 * into a sentence naming the field; this is the backstop under that.
 */
export async function setEventStatus(
  id: string,
  from: EventStatus,
  to: EventStatus
): Promise<Result<EventRecord | null, AppError>> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("events")
      .update({ status: to })
      .eq("id", id)
      .eq("status", from)
      .select(COLUMNS)
      // `maybeSingle`, not `single`: a conditional update matching nothing is
      // the expected outcome of a stale page, not a database error, and
      // `single` reports it as one.
      .maybeSingle();

    if (error) return err(writeError("set event status", error));
    return ok(data ? toRecord(data) : null);
  } catch (cause) {
    return err(fromUnknown(cause, "set event status"));
  }
}

export async function deleteEvent(id: string): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin().from("events").delete().eq("id", id);
    if (error) return err(dbError("delete event", error.message));
    return ok();
  } catch (cause) {
    return err(fromUnknown(cause, "delete event"));
  }
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function dbError(context: string, message: string): AppError {
  return errors.upstreamUnavailable(`${context}: ${message}`);
}

/**
 * Turns the constraint that fired into something the admin can act on.
 *
 * Postgres codes: `23505` unique violation, `23514` check violation. Without
 * this mapping every one of them surfaces as "our database is unavailable",
 * which is both untrue and unactionable when the real problem is that two
 * events want the same URL.
 */
function writeError(
  context: string,
  error: { code?: string; message: string }
): AppError {
  if (error.code === "23505") {
    return errors.conflict("An event with that link already exists.", {
      fields: { slug: "taken" },
    });
  }
  if (error.code === "23514") {
    if (error.message.includes("events_published_is_bilingual")) {
      return errors.validation(
        "A published event needs a title and a summary in both languages.",
        { titleAr: "required" }
      );
    }
    if (error.message.includes("events_ends_after_start")) {
      return errors.validation("The event has to end after it starts.", {
        endsAt: "before_start",
      });
    }
    return errors.validation("One of those values is out of range.");
  }
  return dbError(context, error.message);
}
