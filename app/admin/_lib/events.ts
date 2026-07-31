import "server-only";

import {
  getEventById,
  listAllEvents,
  listRegistrations,
  seatsTakenFor,
  type EventRecord,
  type RegistrationRecord,
} from "@/server/db/events";
import {
  eventPhase,
  type DatePrecision,
  type EventPhase,
} from "@/server/domain/events";
import {utcToRiyadhWallClock} from "@/server/domain/riyadh-time";
import {
  listTicketPriceOptions,
  type TicketPriceOption,
} from "@/server/services/event-tickets";
import {posterPublicUrl} from "@/server/storage/event-posters";

import type {AdminUser} from "./auth";

/**
 * The admin's events data, as plain view models.
 *
 * 🔴 A sanctioned crossing into `@/server`, and it exports DATA only: never a
 * backend module, never a Supabase client, never a row. Pages render what is
 * here.
 *
 * 🔴 Every exported loader REQUIRES an `AdminUser`. It is never read, and that
 * is the point: it makes forgetting the auth check a compile error rather than
 * a leak a regex has to notice. The dashboard uses the same trick, and the
 * reason is a real incident: an anonymous `curl /admin` once returned a correct
 * 307 redirect whose body still carried 28 KB of rendered dashboard, because
 * React renders a route's components concurrently with its ancestors and the
 * layout's `redirect()` throw does not cancel the page.
 *
 * 🔴 NO LOADER HERE RETURNS AN UPSTREAM MESSAGE. Every failure is a state the
 * page maps to a sentence of ours. A PostgREST error arrives as
 * `${context}: ${prose}` naming our own table and column names, and until
 * 2026-07-29 both list pages printed it straight to the operator, who can do
 * nothing with it and should not be shown it.
 */

/** Which language the admin's row title actually came from. */
export type AdminTitleSource = "en" | "ar" | "slug";

export type AdminEventRow = {
  id: string;
  slug: string;
  status: string;
  phase: EventPhase;
  title: string;
  /**
   * 🔴 Carried, not inferred at the call site. The list has to flag a missing
   * English title and set `dir` on an Arabic one, and it cannot tell "the
   * English title is written" from "the English title is missing and this is
   * the Arabic one" by looking at the string.
   */
  titleSource: AdminTitleSource;
  startsAt: string;
  /** `YYYY-MM-DDTHH:mm` as read at the venue. */
  startsAtLocal: string;
  /**
   * How much of the start time anybody actually recorded. Four of the 41
   * imported archive rows record only a month, and rendering their stored hour
   * would be asserting a fact nobody has.
   */
  datePrecision: DatePrecision;
  capacity: number | null;
  /**
   * 🔴 `null` means WE COULD NOT COUNT, and it is never 0.
   *
   * Until 2026-07-29 a failed `event_seats_taken` was swallowed into an empty
   * Map, so every row of the one column an operator opens this page for read a
   * confident `0`. "Nobody has signed up" and "the count did not run" are
   * opposite instructions to whoever is deciding whether to cancel a workshop.
   */
  seatsTaken: number | null;
  isTicketed: boolean;
  ticketAmount: number | null;
  posterUrl: string | null;
};

export type AdminEventDetail = AdminEventRow & {
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
  endsAtLocal: string;
  posterPath: string | null;
  rekazPriceImmutableId: string | null;
};

export type AdminRegistrationRow = {
  id: string;
  fullName: string;
  email: string | null;
  phoneE164: string;
  status: string;
  /** True while a payment hold is still running. */
  holdLive: boolean;
  /** When that hold lapses. Rendered beside "Holding a seat" so a stale server render is self-evident. */
  holdExpiresAt: string | null;
  rekazReference: string | null;
  locale: string;
  createdAt: string;
};

/**
 * The English title, falling back to the Arabic one, and saying which it used.
 *
 * ⚠️ The ONE place a cross-language fallback is correct, and only because this
 * is an internal English-only tool listing rows that may still be drafts with
 * half the copy written. On the public site the same fallback would print
 * Arabic onto an English page, which is the exact thing the i18n rule exists to
 * prevent. Do not copy this shape outward.
 *
 * The `source` is what makes the fallback honest instead of invisible: the list
 * wraps an Arabic title in `<Ar>` so it reads right, flags that the English one
 * is missing, and prints "Untitled" rather than the slug twice.
 */
function adminTitle(record: EventRecord): {
  title: string;
  source: AdminTitleSource;
} {
  if (record.title.en) return {title: record.title.en, source: "en"};
  if (record.title.ar) return {title: record.title.ar, source: "ar"};
  return {title: record.slug, source: "slug"};
}

function toRow(record: EventRecord, seatsTaken: number | null): AdminEventRow {
  const {title, source} = adminTitle(record);

  return {
    id: record.id,
    slug: record.slug,
    status: record.status,
    phase: eventPhase(record),
    title,
    titleSource: source,
    startsAt: record.startsAt,
    startsAtLocal: utcToRiyadhWallClock(record.startsAt),
    datePrecision: record.datePrecision,
    capacity: record.capacity,
    seatsTaken,
    isTicketed: record.rekazPriceImmutableId !== null,
    ticketAmount: record.ticketAmount,
    posterUrl: posterPublicUrl(record.posterPath),
  };
}

export type AdminEventsResult =
  | {
      status: "ok";
      events: AdminEventRow[];
      /**
       * False when the seat RPC failed. Every row's `seatsTaken` is then
       * `null`, and the page says so ONCE at the top as well as in each cell:
       * an operator who scrolls straight to a row needs the cell, and one
       * scanning the page needs to know the whole column is unanswered.
       */
      seatsCounted: boolean;
    }
  | {status: "unavailable"};

export async function loadAdminEvents(
  _admin: AdminUser
): Promise<AdminEventsResult> {
  const events = await listAllEvents();
  if (!events.ok) return {status: "unavailable"};

  // 🔴 A failed count is `null` on every row, not an empty Map read as zeros.
  // The seat column is the whole reason this page gets opened.
  const counts = await seatsTakenFor(events.value.map((e) => e.id));

  return {
    status: "ok",
    seatsCounted: counts.ok,
    events: events.value.map((e) =>
      toRow(e, counts.ok ? (counts.value.get(e.id) ?? 0) : null)
    ),
  };
}

/**
 * One event, or the reason there isn't one.
 *
 * 🔴 Three states, and `missing` and `unavailable` may never re-merge. Until
 * 2026-07-29 this returned `null` for both, so a database outage rendered as
 * "this event does not exist": the operator concludes somebody deleted it, and
 * the next thing they do is recreate it.
 */
export type AdminEventResult =
  | {status: "found"; event: AdminEventDetail}
  | {status: "missing"}
  | {status: "unavailable"};

export async function loadAdminEvent(
  _admin: AdminUser,
  id: string
): Promise<AdminEventResult> {
  const found = await getEventById(id);
  if (!found.ok) return {status: "unavailable"};
  if (!found.value) return {status: "missing"};

  const record = found.value;
  const counts = await seatsTakenFor([record.id]);
  const taken = counts.ok ? (counts.value.get(record.id) ?? 0) : null;

  return {
    status: "found",
    event: {
      ...toRow(record, taken),
      titleEn: record.title.en,
      titleAr: record.title.ar,
      summaryEn: record.summary.en,
      summaryAr: record.summary.ar,
      descriptionEn: record.description.en,
      descriptionAr: record.description.ar,
      hostEn: record.host.en,
      hostAr: record.host.ar,
      locationEn: record.location.en,
      locationAr: record.location.ar,
      series: record.series,
      edition: record.edition,
      endsAtLocal: utcToRiyadhWallClock(record.endsAt),
      posterPath: record.posterPath,
      rekazPriceImmutableId: record.rekazPriceImmutableId,
    },
  };
}

export type AdminRegistrationsResult =
  | {status: "ok"; rows: AdminRegistrationRow[]}
  | {status: "unavailable"};

export async function loadRegistrations(
  _admin: AdminUser,
  eventId: string
): Promise<AdminRegistrationsResult> {
  const rows = await listRegistrations(eventId);
  if (!rows.ok) return {status: "unavailable"};

  const now = Date.now();
  return {status: "ok", rows: rows.value.map((r) => toRegistrationRow(r, now))};
}

function toRegistrationRow(
  record: RegistrationRecord,
  now: number
): AdminRegistrationRow {
  return {
    id: record.id,
    fullName: record.fullName,
    email: record.email,
    phoneE164: record.phoneE164,
    status: record.status,
    holdLive:
      record.status === "pending_payment" &&
      record.holdExpiresAt !== null &&
      new Date(record.holdExpiresAt).getTime() > now,
    holdExpiresAt: record.holdExpiresAt,
    rekazReference: record.rekazReference,
    locale: record.locale,
    createdAt: record.createdAt,
  };
}

/**
 * The prices the admin may attach to an event.
 *
 * Returns an empty list, not an error, when the Rekaz catalog has no suitable
 * product yet. That is the expected state before the owner creates the "event
 * ticket" product, and the form explains what to do about it. An error there
 * would read as a broken page rather than a setup step.
 */
export async function loadTicketOptions(
  _admin: AdminUser
): Promise<{options: TicketPriceOption[]; reachable: boolean}> {
  const result = await listTicketPriceOptions();
  if (!result.ok) return {options: [], reachable: false};
  return {options: result.value, reachable: true};
}

export type {TicketPriceOption};
