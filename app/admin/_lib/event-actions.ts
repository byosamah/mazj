"use server";

import {redirect} from "next/navigation";

import type {AppError} from "@/server/core/errors";
import {
  deleteEvent,
  insertEvent,
  updateEvent,
  type EventDraft,
  type EventStatus,
} from "@/server/db/events";
import {
  isValidSlug,
  slugifyTitle,
  type DatePrecision,
} from "@/server/domain/events";
import {riyadhWallClockToUtc} from "@/server/domain/riyadh-time";
import {cleanFreeText} from "@/server/domain/text";
import {chargedAmount} from "@/server/rekaz/types";
import {resolveTicketPrice} from "@/server/services/event-tickets";
import {deletePoster, uploadPoster} from "@/server/storage/event-posters";

import {requireAdmin} from "./auth";

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

export type RemoveEventState =
  | {status: "idle"}
  | {status: "error"; message: string};

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

  // Checked here as well as by the database, because a constraint violation
  // arrives as a Postgres error and the person who needs to read it is looking
  // at a form, not a log.
  if (status === "published" && !(titleEn && titleAr)) {
    return {
      status: "error",
      message: "A published event needs a title in both languages.",
      field: titleEn ? "titleAr" : "titleEn",
    };
  }

  const summaryEn = clean(formData, "summaryEn", LIMITS.summary);
  const summaryAr = clean(formData, "summaryAr", LIMITS.summary);

  if (status === "published" && !(summaryEn && summaryAr)) {
    return {
      status: "error",
      message: "A published event needs a one-line summary in both languages.",
      field: summaryEn ? "summaryAr" : "summaryEn",
    };
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

export async function removeEvent(
  _previous: RemoveEventState,
  formData: FormData
): Promise<RemoveEventState> {
  await requireAdmin();

  const id = str(formData, "id");
  const slug = str(formData, "slug");

  // 🔴 Both of these used to be a bare `return`, i.e. a delete that failed and
  // a delete that succeeded were both a page doing nothing. The operator
  // concludes the button is broken and presses it again, which is the one thing
  // that must not happen on an irreversible control.
  if (!id) {
    return {
      status: "error",
      message: "The event was not deleted. Nothing was changed.",
    };
  }

  // The typed-slug confirmation is enforced here as well as by the input's own
  // `pattern`. Native validation is a slip guard and cannot be reached by a
  // crafted POST, so this is what makes the guard real rather than a property
  // of the markup that a later edit could drop without anyone noticing.
  if (!slug || str(formData, "confirmSlug") !== slug) {
    return {
      status: "error",
      message:
        "Type the event's link exactly to confirm. Nothing was changed.",
    };
  }

  // Read first, so the poster can be cleaned up after the row is gone.
  const poster = str(formData, "posterPath");

  const deleted = await deleteEvent(id);
  if (!deleted.ok) {
    return {
      status: "error",
      message: "The event was not deleted. Nothing was changed.",
    };
  }

  // Registrations go with it: the foreign key is `on delete cascade`, because a
  // registration for an event that no longer exists is a row nobody can act on.
  await deletePoster(poster ?? null);

  redirect("/admin/events");
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
