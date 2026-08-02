"use server";

import {refresh} from "next/cache";
import {redirect} from "next/navigation";

import type {AppError} from "@/server/core/errors";
import {
  deleteEvent,
  getEventById,
  insertEvent,
  setEventStatus,
  updateEvent,
  type EventDraft,
  type EventRecord,
  type EventStatus,
} from "@/server/db/events";
import {
  isValidSlug,
  missingToPublish,
  slugifyTitle,
  type DatePrecision,
  type MissingForPublish,
} from "@/server/domain/events";
import {riyadhWallClockToUtc} from "@/server/domain/riyadh-time";
import {cleanFreeText} from "@/server/domain/text";
import {chargedAmount} from "@/server/rekaz/types";
import {resolveTicketPrice} from "@/server/services/event-tickets";
import {deletePoster, uploadPoster} from "@/server/storage/event-posters";

import {requireAdmin} from "./auth";
import {
  eventOutcomeUrl,
  type EventOutcomeCode,
  type EventScope,
} from "./event-outcomes";

/**
 * Creating, editing and deleting events.
 *
 * 🔴 EVERY ACTION CALLS `requireAdmin()` ITSELF, and sitting under
 * `(protected)/` is not a substitute. A Server Action is a public POST endpoint
 * reachable by its generated id from the client bundle: the route group decides
 * which PAGES render behind the guard and has no say over who can invoke this.
 * An unguarded action here would let anybody who read the JS publish an event
 * on mazj.sa.
 *
 * ⚠️ This is a `"use server"` module, so EVERY export becomes a callable
 * endpoint. Do not add a helper that takes a non-serialisable argument: it
 * creates an action nobody can invoke and widens the public surface for
 * nothing. Type-only exports are erased and are fine.
 */

export type SaveEventState =
  | {status: "idle"}
  /**
   * The write succeeded.
   *
   * ⚠️ The success path REDIRECTS (to `?saved=1`), which throws, so this
   * variant is not returned today. It is in the union because `idle` is what
   * "saved" used to render as, and `idle` is also what "the button did nothing"
   * renders as: the two were the same pixels. Keeping a named success state
   * means any future change that drops the redirect cannot quietly regress to
   * that, and the form already renders it.
   */
  | {status: "saved"}
  | {status: "error"; message: string; field?: string};

/**
 * ⚠️ `RemoveEventState` STOOD HERE and is gone, with the `useActionState` form
 * that consumed it.
 *
 * Deleting used to live at the bottom of `EventForm`, behind a typed-slug
 * confirmation, and it was reachable from exactly one screen. It is now on the
 * events LIST as well (owner request, 2026-08-01), and a control that exists on
 * two screens cannot report itself through one screen's client state. Both
 * screens report through `event-outcomes.ts` instead, which is why this action
 * now takes a bare `FormData` and redirects rather than returning a value.
 *
 * 🔴 The typed slug went with it, by the same owner decision: two clicks, no
 * typing. What replaced it as the SERVER-side guard is the slug comparison in
 * `removeEvent`, and that swap is the load-bearing part. The typed field never
 * defended against a crafted POST (an admin is trusted and can delete anything
 * they like); it defended against a SLIP, and a slip cannot happen over HTTP.
 * The comparison defends something the typed field never did: it refuses when
 * the page's idea of the event disagrees with the row.
 */

/** Mirrors the check constraints in `20260728120000_events.sql`. */
const LIMITS = {
  title: 160,
  summary: 400,
  description: 6000,
  host: 160,
  location: 200,
  series: 60,
  edition: 12,
} as const;

const PRECISIONS: readonly DatePrecision[] = ["exact", "day", "month"];

export async function saveEvent(
  _previous: SaveEventState,
  formData: FormData
): Promise<SaveEventState> {
  await requireAdmin();

  const id = str(formData, "id");
  const status = (str(formData, "status") ?? "draft") as EventStatus;
  if (!["draft", "published", "cancelled"].includes(status)) {
    return {status: "error", message: "Unknown status.", field: "status"};
  }

  // 🔴 FROM THE FORM. Hard-coding "exact" here silently rewrote the four
  // imported archive rows that record only a month, the moment anybody opened
  // one and pressed Save. See the comment on `toColumns` in
  // `server/db/events.ts`.
  const datePrecision = (str(formData, "datePrecision") ??
    "exact") as DatePrecision;
  if (!PRECISIONS.includes(datePrecision)) {
    return {
      status: "error",
      message: "Unknown date precision.",
      field: "datePrecision",
    };
  }

  const titleEn = clean(formData, "titleEn", LIMITS.title);
  const titleAr = clean(formData, "titleAr", LIMITS.title);

  // 🔴 The slug is derived from the ENGLISH title, and only when the admin has
  // not typed one. Deriving it on every save would silently change a published
  // event's URL the moment somebody fixed a typo in the title, breaking every
  // link already shared on Instagram and every Google result pointing at it.
  const typedSlug = str(formData, "slug");
  const slug = typedSlug
    ? typedSlug.toLowerCase()
    : slugifyTitle(titleEn ?? titleAr ?? "", str(formData, "edition"));

  if (!isValidSlug(slug)) {
    return {
      status: "error",
      message:
        "The link needs to be lowercase English letters, numbers and hyphens.",
      field: "slug",
    };
  }

  const startsAt = riyadhWallClockToUtc(str(formData, "startsAtLocal") ?? "");
  const endsAt = riyadhWallClockToUtc(str(formData, "endsAtLocal") ?? "");

  if (!startsAt) {
    return {status: "error", message: "Pick a start date and time.", field: "startsAtLocal"};
  }
  if (!endsAt) {
    return {status: "error", message: "Pick an end date and time.", field: "endsAtLocal"};
  }
  if (endsAt <= startsAt) {
    return {
      status: "error",
      message: "The event has to end after it starts.",
      field: "endsAtLocal",
    };
  }

  const summaryEn = clean(formData, "summaryEn", LIMITS.summary);
  const summaryAr = clean(formData, "summaryAr", LIMITS.summary);

  // Checked here as well as by the database, because a constraint violation
  // arrives as a Postgres error and the person who needs to read it is looking
  // at a form, not a log.
  //
  // 🔴 Through `missingToPublish`, which is the SAME rule the status control on
  // the events list reads. Two screens now publish the same row, and the two
  // used to hold their own copy of "what counts as ready": the copy here tested
  // truthiness, so a title of `" "` passed it and the other would have had to
  // rediscover that. The two SENTENCES still differ, and should: this one is a
  // field error rendered beside the field, and the list's is a notice on a page
  // where the event is one row of forty.
  if (status === "published") {
    const missing = missingToPublish({titleEn, titleAr, summaryEn, summaryAr});
    if (missing) {
      return {
        status: "error",
        message: missing.startsWith("title")
          ? "A published event needs a title in both languages."
          : "A published event needs a one-line summary in both languages.",
        field: missing,
      };
    }
  }

  const capacityRaw = str(formData, "capacity");
  let capacity: number | null = null;
  if (capacityRaw) {
    const parsed = Number(capacityRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5000) {
      return {
        status: "error",
        message: "Seats has to be a whole number, or blank for no limit.",
        field: "capacity",
      };
    }
    capacity = parsed;
  }

  // ---------------------------------------------------------------- ticket
  const priceId = str(formData, "rekazPriceImmutableId");
  let ticketAmount: number | null = null;

  if (priceId) {
    // Resolved against the LIVE catalog rather than trusted from the form. The
    // select is populated from Rekaz, but a crafted POST is not, and an event
    // pointing at a price that does not exist would fail at the last click of
    // somebody's purchase rather than here.
    const ticket = await resolveTicketPrice(priceId);
    if (!ticket.ok) {
      // 🔴 THE TWO REASONS THIS FAILS ARE OPPOSITE, AND ONLY ONE OF THEM MEANS
      // THE PRICE IS GONE. `resolveTicketPrice` returns a `conflict` when the
      // price genuinely no longer exists in the catalog (deleted in the Rekaz
      // dashboard), and it PASSES THROUGH whatever `listProducts()` failed with
      // otherwise, which on a bad day is `upstream_unavailable` or
      // `rate_limited`.
      //
      // ⚠️ **A SOLD-OUT TICKET IS NO LONGER EITHER OF THEM**, as of 2026-07-31.
      // It used to take this branch and print the `gone` message, so a ticket
      // that had simply sold out told the owner its price was deleted and
      // offered "set the event to free" as the remedy: the one irreversible
      // action on this screen, applied to a temporary and entirely good state.
      // Selling out now arrives as `ticket.value.stock` and saving proceeds.
      //
      // Collapsing them cost the operator twice over. The form already warns,
      // when Rekaz is unreachable at render, that "saving now would leave the
      // ticket exactly as it is"; the save was then refused anyway, so the
      // screen contradicted itself. And the refusal asserted a fact nobody had
      // established, that the price was deleted, while prescribing the one
      // irreversible action the warning exists to prevent: an operator who
      // follows "set the event to free" during a five-minute Rekaz outage
      // permanently converts a paid event to a free one, and every subsequent
      // sign-up is free.
      //
      // So the outage arm must not name the price and must not offer "free".
      // It says the only thing we actually know: we could not ask.
      const gone = ticket.error.code === "conflict";
      return {
        status: "error",
        message: gone
          ? "That ticket price is no longer in Rekaz. Pick another, or set the event to free."
          : "Rekaz is not answering, so the ticket price could not be checked. Nothing was saved. Try again in a moment, and do not set the event to free to get past this: the ticket is still there.",
        field: "rekazPriceImmutableId",
      };
    }
    // A snapshot for the admin list only. What a buyer is charged is whatever
    // the Rekaz storefront holds when they get there; the public page resolves
    // it live in `loadTicketOffer`.
    //
    // 🔴 `chargedAmount`, NOT `price.amount`, and it is the SAME call the public
    // page makes. These are two readings of one question, and the whole reason
    // that helper exists is that two expressions of it drift: the admin list
    // would read 50 while the event page and the storefront both said 40.
    ticketAmount = chargedAmount(ticket.value.price);
  }

  // ---------------------------------------------------------------- poster
  const existingPoster = str(formData, "posterPath");
  let posterPath: string | null = existingPoster ?? null;

  const upload = formData.get("poster");
  const hasUpload = upload instanceof File && upload.size > 0;

  if (formData.get("removePoster") === "on" && !hasUpload) {
    posterPath = null;
  }

  if (hasUpload) {
    const stored = await uploadPoster(upload);
    if (!stored.ok) return failure(stored.error, "poster");
    posterPath = stored.value;
  }

  const draft: EventDraft = {
    slug,
    status,
    titleEn,
    titleAr,
    summaryEn,
    summaryAr,
    descriptionEn: clean(formData, "descriptionEn", LIMITS.description, true),
    descriptionAr: clean(formData, "descriptionAr", LIMITS.description, true),
    hostEn: clean(formData, "hostEn", LIMITS.host),
    hostAr: clean(formData, "hostAr", LIMITS.host),
    locationEn: clean(formData, "locationEn", LIMITS.location),
    locationAr: clean(formData, "locationAr", LIMITS.location),
    series: clean(formData, "series", LIMITS.series),
    edition: clean(formData, "edition", LIMITS.edition),
    startsAt,
    endsAt,
    datePrecision,
    posterPath,
    capacity,
    rekazPriceImmutableId: priceId ?? null,
    ticketAmount,
  };

  const saved = id ? await updateEvent(id, draft) : await insertEvent(draft);

  if (!saved.ok) {
    // A poster uploaded moments ago now belongs to nothing. Removed so a run of
    // failed saves does not quietly fill the bucket with orphans.
    if (hasUpload && posterPath) await deletePoster(posterPath);
    return failure(saved.error);
  }

  // The old poster is only removed once the row referencing the new one is
  // committed. The other order loses the image if the write fails.
  if (existingPoster && existingPoster !== posterPath) {
    await deletePoster(existingPoster);
  }

  // ⚠️ OUTSIDE any try/catch. `redirect()` works by throwing a control-flow
  // signal that Next catches; swallowing it turns a successful save into a page
  // that silently does nothing.
  //
  // `?saved=1` is the whole of P10: without it a successful save and a button
  // that did nothing at all rendered the same pixels, because the form simply
  // returned to its resting state either way.
  redirect(`/admin/events/${saved.value.id}?saved=1`);
}

/**
 * Moves one event between draft, published and cancelled, and touches nothing
 * else.
 *
 * 🔴 THIS EXISTS SO THAT CHANGING A STATUS IS NOT A FULL-FORM SAVE. The only
 * way to publish something used to be `saveEvent`, which rewrites all
 * twenty-three columns from the form's current contents. That made an ordinary
 * "put this live" carry every unrelated field on the screen, and the events
 * list, where an operator actually decides what to publish, could not do it at
 * all: it had no controls.
 *
 * ⚠️ It is a bare `FormData` action rather than a `useActionState` one, and
 * that is what keeps the events list a Server Component. `/admin` ships exactly
 * six client components, pinned BY NAME in `test/admin-page-guards.test.ts`,
 * and turning a forty-row list into the seventh to render three buttons is the
 * trade this shape avoids. The outcome travels back in the URL instead; see
 * `event-outcomes.ts`.
 */
export async function changeEventStatus(formData: FormData): Promise<void> {
  await requireAdmin();

  const scope = readScope(formData);
  const id = str(formData, "id");
  const to = str(formData, "status");
  const from = str(formData, "from");

  if (!id || !isStatus(to) || !isStatus(from)) return back(scope, id, "failed");

  // 🔴 The ROW is read before anything is decided, and the page's own idea of
  // the status is only ever used as a precondition. An admin list is left open
  // for hours and a second person may be working the same queue, so what the
  // form posts is a claim about the past.
  const found = await getEventById(id);
  if (!found.ok) return back(scope, id, "failed");
  if (!found.value) return back(scope, id, "gone");

  const event = found.value;

  // 🔴 ALREADY THERE IS A SUCCESS, NOT A CONFLICT. Two people pressing Publish
  // on the same draft, or one person on a tab that missed a refresh, both want
  // the state that now holds. Reporting "that changed while this page was open"
  // for a change that produced exactly the intended outcome is how an operator
  // learns to distrust the whole control and goes back to opening the event.
  if (event.status === to) return back(scope, id, doneCode(to));

  if (event.status !== from) return back(scope, id, "moved");

  // 🔴 Checked BEFORE the write, so the refusal can name the field. The check
  // constraint would catch it anyway, but it arrives as `23514` naming
  // `events_published_is_bilingual`, and the operator needs to be told which of
  // four boxes is empty, not which constraint fired.
  if (to === "published") {
    const missing = missingToPublish(publishableCopy(event));
    if (missing) return back(scope, id, needsCode(missing));
  }

  const saved = await setEventStatus(id, from, to);
  if (!saved.ok) {
    // 🔴 A CONSTRAINT VIOLATION IS NOT AN OUTAGE, and `failed` says it is:
    // "the database did not answer" about a database that answered very
    // clearly. `missingToPublish` cleared this event moments ago, so the only
    // way `events_published_is_bilingual` can fire here is that somebody
    // emptied a title between our read and our write. That is precisely what
    // `moved` reports, and it is the only one of the two that is true.
    const raced = saved.error.code === "validation_failed";
    return back(scope, id, raced ? "moved" : "failed");
  }

  // The conditional update matched nothing, having read the row a moment ago:
  // somebody wrote it in between. Nothing was changed, and saying so is the
  // whole reason that update is conditional.
  if (!saved.value) return back(scope, id, "moved");

  return back(scope, id, doneCode(to));
}

/**
 * Deletes one event, its poster and every sign-up for it.
 *
 * 🔴 THE POSTED SLUG IS COMPARED AGAINST THE STORED ONE, and that comparison is
 * the whole server-side guard now that the typed confirmation is gone (owner
 * decision, 2026-08-01: two clicks, no typing).
 *
 * It is a real guard rather than a smaller version of the old one, and it
 * defends a different thing. Typing the slug proved the operator meant this
 * event; comparing it proves the PAGE meant this event. A list rendered twenty
 * minutes ago, whose row has since been renamed or replaced, now refuses
 * instead of deleting whatever currently sits at that id. Neither the typed
 * field nor its `pattern` could ever have caught that, because both compared
 * the page against itself.
 *
 * 🔴 The poster path is read from the DATABASE, never from the form. It used to
 * arrive in a hidden input, which means a crafted POST could name any object in
 * a public bucket and have this delete it on the way past.
 */
export async function removeEvent(formData: FormData): Promise<void> {
  await requireAdmin();

  const scope = readScope(formData);
  const id = str(formData, "id");
  const slug = str(formData, "slug");

  if (!id || !slug) return back(scope, id, "failed");

  const found = await getEventById(id);
  if (!found.ok) return back(scope, id, "failed");
  if (!found.value) return back(scope, id, "gone");
  if (found.value.slug !== slug) return back(scope, id, "moved");

  // Read before the row goes, so the object can be cleaned up after it.
  const poster = found.value.posterPath;

  const deleted = await deleteEvent(id);
  if (!deleted.ok) return back(scope, id, "failed");

  // Registrations go with it: the foreign key is `on delete cascade`, because a
  // registration for an event that no longer exists is a row nobody can act on.
  await deletePoster(poster);

  // 🔴 Always the LIST, whichever screen this was pressed on. The event's own
  // page no longer resolves, so returning to it would answer the successful
  // delete with a 404 and leave the operator wondering which of the two things
  // went wrong.
  return back("list", undefined, "deleted");
}

// ---------------------------------------------------------------------------
// The status controls' plumbing
// ---------------------------------------------------------------------------

const STATUSES: readonly EventStatus[] = ["draft", "published", "cancelled"];

function isStatus(value: string | undefined): value is EventStatus {
  return value !== undefined && (STATUSES as readonly string[]).includes(value);
}

/**
 * 🔴 Narrowed to two values, never trusted as a path. Anything that is not
 * exactly `detail` is the list, so a crafted `scope` cannot steer the redirect;
 * `eventOutcomeUrl` builds every destination itself.
 */
function readScope(formData: FormData): EventScope {
  return formData.get("scope") === "detail" ? "detail" : "list";
}

function doneCode(status: EventStatus): EventOutcomeCode {
  if (status === "published") return "published";
  return status === "cancelled" ? "cancelled" : "drafted";
}

/**
 * The missing field, as the code that names it.
 *
 * A function rather than an inline template with a cast, so the two unions have
 * to keep agreeing: rename a field in `MissingForPublish` without adding the
 * matching `needs-*` code and this stops compiling, where a cast would have gone
 * on producing a string neither screen recognises and rendering no notice at all.
 */
function needsCode(missing: MissingForPublish): EventOutcomeCode {
  return `needs-${missing}`;
}

function publishableCopy(event: EventRecord) {
  return {
    titleEn: event.title.en,
    titleAr: event.title.ar,
    summaryEn: event.summary.en,
    summaryAr: event.summary.ar,
  };
}

/**
 * Reports the outcome and sends the operator back where they pressed.
 *
 * ⚠️ `refresh()` on EVERY path, including the ones that changed nothing, and
 * that is deliberate rather than lazy. `gone` and `moved` both mean the page
 * the operator is looking at is describing a row that no longer matches it, so
 * the one thing they must not get is their stale copy handed straight back with
 * a note attached. Both list pages read Postgres on every render, so there is
 * no server cache to bust; what is stale is the CLIENT router cache, which is
 * exactly the trap `decideApplication` documents next door.
 *
 * ⚠️ OUTSIDE any try/catch, because `redirect()` works by throwing a
 * control-flow signal that Next catches. Swallowing it turns a completed action
 * into a screen that silently does nothing.
 */
function back(
  scope: EventScope,
  eventId: string | undefined,
  code: EventOutcomeCode
): never {
  refresh();
  redirect(eventOutcomeUrl(scope, eventId, code));
}

/**
 * Our own sentence for a failed write, chosen from the error's CODE and the
 * field it named.
 *
 * 🔴 `error.message` is never returned. Next redacts THROWN errors and
 * serialises RETURNED action values verbatim, so an `upstream_unavailable`
 * carrying `${context}: ${PostgREST prose}` would land our table and column
 * names on screen, and a Supabase Storage failure would land its own. This repo
 * has already shipped that class of leak once, on a public booking form.
 *
 * ⚠️ The four constraint sentences are restated here rather than imported.
 * `server/db/events.ts` writes its own English for the same constraints, so
 * this is a second copy, and that is the accepted cost of the rule above: if a
 * constraint is ever added there and not here, the operator gets the generic
 * sentence for its code, which is vaguer but never wrong.
 */
function failure(error: AppError, fallbackField?: string): SaveEventState {
  const field = error.fields ? Object.keys(error.fields)[0] : fallbackField;
  const reason = field && error.fields ? error.fields[field] : undefined;

  if (error.code === "conflict" && field === "slug") {
    return {
      status: "error",
      message: "An event with that link already exists. Give it a different one.",
      field,
    };
  }

  if (error.code === "validation_failed") {
    if (field === "titleAr") {
      return {
        status: "error",
        message:
          "A published event needs a title and a one-line summary in both languages.",
        field,
      };
    }
    if (field === "endsAt") {
      return {
        status: "error",
        message: "The event has to end after it starts.",
        field,
      };
    }
    if (field === "poster") {
      return {
        status: "error",
        message:
          reason === "size"
            ? "The poster has to be under 5 MB."
            : reason === "empty"
              ? "That poster file is empty."
              : "The poster has to be a JPG, PNG or WebP image.",
        field,
      };
    }
    return {
      status: "error",
      message: "One of those values is out of range.",
      field,
    };
  }

  return {
    status: "error",
    message: "The event was not saved. Nothing was changed. Try again.",
    field,
  };
}

function str(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Cleaned and bounded, exactly as the public form's input is.
 *
 * The admin is trusted, which is precisely why this is easy to skip and worth
 * not skipping: a pasted control character from a design brief still reaches
 * Postgres as `unsupported Unicode escape sequence`, and the resulting 503
 * blames the database rather than the paste.
 *
 * `multiline` keeps paragraph breaks, which a description needs and a title
 * does not.
 */
function clean(
  formData: FormData,
  key: string,
  max: number,
  multiline = false
): string | null {
  const raw = formData.get(key);
  if (typeof raw !== "string") return null;

  if (!multiline) {
    const value = cleanFreeText(raw, max);
    return value === "" ? null : value;
  }

  // Collapse runs of blank lines but keep single ones, then clean each line.
  const value = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => cleanFreeText(line, max))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);

  return value === "" ? null : value;
}
