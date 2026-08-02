/**
 * What just happened to an event, carried in the URL.
 *
 * 🔴 A CODE CROSSES, NEVER A SENTENCE AND NEVER AN UPSTREAM MESSAGE. The
 * sentences live in the table below and are chosen here; a PostgREST failure
 * arrives as `${context}: ${prose}` naming our own table and column names, and
 * both admin list pages printed exactly that to the operator until 2026-07-29.
 * A query parameter is the most public surface in the tool, so nothing that is
 * not already in this file may reach it.
 *
 * 🔴 AND IT IS THE URL RATHER THAN A RETURNED ACTION VALUE, deliberately. The
 * events list and the event's own page are both Server Components, and the
 * status controls on them are plain forms posting to a Server Action so that
 * `/admin` keeps its six client components (pinned by name in
 * `test/admin-page-guards.test.ts`). A Server Component cannot hold the result
 * of an action in state, so the result has to survive a redirect, and a query
 * parameter is the only thing that does. It is the same mechanism `saveEvent`
 * already uses for `?saved=1` and `resendApplicationEmail` for `?resent=1`.
 *
 * ⚠️ Which means the notice OUTLIVES the action, because the parameter stays in
 * the address bar until the next navigation. That is fine for a report about
 * something that definitely happened, and it is exactly why a failure must
 * always displace a success in the one notice slot each screen owns.
 */

/**
 * Every outcome either screen can report.
 *
 * The four `needs-*` codes exist separately rather than as one "incomplete"
 * because the operator's next action differs for each: the answer to a missing
 * Arabic summary is not the answer to a missing English title, and "this event
 * is not ready" tells nobody which of the four boxes to go and fill.
 */
export type EventOutcomeCode =
  | "published"
  | "drafted"
  | "cancelled"
  | "deleted"
  | "needs-titleEn"
  | "needs-titleAr"
  | "needs-summaryEn"
  | "needs-summaryAr"
  | "gone"
  | "moved"
  | "failed";

/** Which screen the control was pressed on, so the redirect can come back to it. */
export type EventScope = "list" | "detail";

export type EventOutcome = {
  code: EventOutcomeCode;
  /**
   * 🔴 `ok` for everything that happened as asked, INCLUDING a delete, and
   * `destructive` only where nothing was changed.
   *
   * The tone reports whether the operator's instruction was carried out, not
   * how grave the instruction was. Colouring a successful delete as an alarm
   * would put the loudest register in the tool on the one screen where it means
   * "this worked", and the warning about a delete belongs BEFORE the click, on
   * the control, where it already is.
   */
  tone: "ok" | "destructive";
  message: string;
  detail?: string;
  /**
   * The event this is about, when it still exists and the operator has
   * something to go and do to it. Absent after a delete, and absent on the
   * event's own page, where they are already looking at it.
   */
  eventId?: string;
};

type Sentence = { tone: EventOutcome["tone"]; message: string; detail?: string };

/**
 * 🔴 Every sentence names what is true of the WORLD now, and every failure says
 * that nothing changed.
 *
 * "Nothing was changed" is not padding. A control that reports a refusal
 * without saying whether it half-happened is a control the operator presses
 * again, and pressing again is the one thing that must not happen on a row that
 * also carries a delete.
 */
const SENTENCE: Record<EventOutcomeCode, Sentence> = {
  published: {
    tone: "ok",
    message: "That event is on the site now.",
    detail:
      "It has an English page and an Arabic page, and it moves into the archive by itself once it ends.",
  },
  drafted: {
    tone: "ok",
    message: "Taken off the site. It is a draft again.",
    detail:
      "Nobody can reach it and nobody new can sign up. Everyone who already signed up is still recorded.",
  },
  cancelled: {
    tone: "ok",
    message: "Cancelled. It is off the site.",
    detail:
      "Everyone who signed up is still recorded, so you can still download the list and tell them.",
  },
  deleted: {
    tone: "ok",
    message: "Deleted. The event, its poster and its sign-ups are gone.",
    detail: "There is no undo, and nothing was kept anywhere else.",
  },
  "needs-titleEn": {
    tone: "destructive",
    message: "It needs an English title before it can go live.",
    detail: "Nothing was changed. It is still a draft.",
  },
  "needs-titleAr": {
    tone: "destructive",
    message: "It needs an Arabic title before it can go live.",
    detail: "Nothing was changed. It is still a draft.",
  },
  "needs-summaryEn": {
    tone: "destructive",
    message: "It needs an English one-line summary before it can go live.",
    detail: "Nothing was changed. It is still a draft.",
  },
  "needs-summaryAr": {
    tone: "destructive",
    message: "It needs an Arabic one-line summary before it can go live.",
    detail: "Nothing was changed. It is still a draft.",
  },
  gone: {
    tone: "destructive",
    message: "That event no longer exists.",
    detail:
      "Nothing was changed. Somebody deleted it while this page was open.",
  },
  moved: {
    tone: "destructive",
    message: "That event changed while this page was open.",
    detail:
      "Nothing was changed, because the page was acting on a status it no longer has. Read it again and try once more.",
  },
  failed: {
    tone: "destructive",
    message: "Nothing was changed. The database did not answer.",
    detail: "The event is exactly as it was. Try again in a minute.",
  },
};

const CODES = new Set<string>(Object.keys(SENTENCE));

/**
 * Postgres `uuid`, which is the only shape `events.id` can hold.
 *
 * 🔴 Validated because the value is read from the query string and rendered
 * into an href. Without it a crafted `?event=../../somewhere` would build a
 * link out of somebody else's text, and a notice on an authenticated page is a
 * good place to be handed one.
 */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RawQuery = {
  outcome?: string | string[];
  event?: string | string[];
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The outcome this page was navigated to with, or `null`.
 *
 * An unknown code is `null` rather than a generic message: a value that is not
 * in the table above was not written by this application, and inventing a
 * sentence for it would report something we do not know to be true.
 */
export function readEventOutcome(query: RawQuery): EventOutcome | null {
  const code = one(query.outcome);
  if (!code || !CODES.has(code)) return null;

  const eventId = one(query.event);
  const sentence = SENTENCE[code as EventOutcomeCode];

  return {
    code: code as EventOutcomeCode,
    ...sentence,
    ...(eventId && UUID.test(eventId) ? { eventId } : {}),
  };
}

/**
 * Where a control should send the operator once it has finished.
 *
 * 🔴 The destination is BUILT here from a two-value scope, never taken from the
 * form. A `returnTo` field would be an open redirect on an authenticated POST
 * endpoint, and this action is reachable by its id from the client bundle by
 * anyone who reads the JavaScript.
 *
 * The id is encoded because it arrives in a form post: it belongs in one path
 * segment, and a value carrying a slash must not be able to steer the redirect.
 * Same reasoning as `resendApplicationEmail`.
 */
export function eventOutcomeUrl(
  scope: EventScope,
  eventId: string | undefined,
  code: EventOutcomeCode
): string {
  if (scope === "detail" && eventId) {
    return `/admin/events/${encodeURIComponent(eventId)}?outcome=${code}`;
  }

  // On the list the notice has to say WHICH event, and it cannot name it: the
  // title may be Arabic, and this is an English document. So it carries the id
  // and the page renders a link to the event instead, which is also the thing
  // the operator needs when the outcome is "go and write the Arabic title".
  const query = eventId ? `?outcome=${code}&event=${eventId}` : `?outcome=${code}`;
  return `/admin/events${query}`;
}
