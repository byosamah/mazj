import "server-only";

import type { AdminUser } from "./auth";

import { isCodeExpired } from "@/server/domain/startup-offer";
import {
  getStartupApplication,
  listStartupApplications,
  type StartupApplicationRow,
} from "@/server/services/startup-application";

/**
 * The startups queue, as a view model.
 *
 * Every value the admin pages render is computed here and handed over as plain
 * data, the same shape `_lib/dashboard.ts` established: the page does no
 * fetching, no date arithmetic and no status derivation.
 *
 * 🔴 NOT CACHED, unlike the dashboard. That page caches for 60s because it
 * hammers a slow third party on every view; this one reads our own Postgres in
 * Frankfurt, from functions pinned to Frankfurt, and it is the screen where a
 * decision is made. A 60-second-stale queue means two admins can both see an
 * application as pending. The conditional UPDATE in the service is what
 * actually prevents a double decision, but showing someone a stale row and then
 * refusing their click is a worse experience than one extra 40ms query.
 */

export type ApplicationSummary = {
  id: string;
  reference: string;
  createdAt: string;
  founderName: string;
  startupName: string;
  status: "pending" | "approved" | "rejected";
  stage: string;
  space: string;
  teamSize: number;
  locale: string;
  code: string | null;
  /**
   * When the code stops being good, or `null` when none was recorded.
   *
   * On the list as well as the detail page, because "expires in 3 days" and
   * "expired last month" are the two ends of the one column an operator scans
   * this queue for, and a bare code cannot tell them apart.
   */
  codeExpiresAt: string | null;
  /** Derived, never stored: a code past its date is still `approved`. */
  codeExpired: boolean;
  redeemedAt: string | null;
  /**
   * 🔴 Whether the applicant was actually TOLD.
   *
   * Surfaced on the list, not buried in the detail page, because the failure it
   * reports is invisible by construction: the owner pressed Approve, the row
   * turned green, and a founder is still waiting. `null` on a pending row,
   * where there is nothing to have sent.
   */
  emailDelivered: boolean | null;
  emailError: string | null;
};

export type ApplicationDetail = ApplicationSummary & {
  email: string;
  phone: string;
  pitch: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  /**
   * When the decision email left, or `null` if it never did.
   *
   * Kept beside `emailDelivered` rather than folded into it, because the detail
   * page states the delivery as a fact with a time on it ("Emailed 29 Jul 2026,
   * 14:32") instead of the old bare "The email has gone." A boolean cannot say
   * when, and when is what somebody needs when a founder says they never got it.
   */
  emailSentAt: string | null;
  redeemedBy: string | null;
};

/**
 * A read that failed, as the three sentences `ErrorState` requires.
 *
 * 🔴 `message` is chosen by CODE and is never the upstream `AppError.message`:
 * that string is written for logs and carries database and provider detail.
 * `next` is what the operator does about it, which is the half a bare "could
 * not load" leaves out.
 */
export type QueueFailure = {
  title: string;
  message: string;
  next: string;
};

export type StartupsQueue = {
  /** Pending applications, in service order. The section that needs a human. */
  waiting: ApplicationSummary[];
  /** Everything already decided, newest first. */
  decided: ApplicationSummary[];
  /** How many rows were read, before any search filter. */
  total: number;
  /** How many of them the search matched. Equal to `total` when nothing is typed. */
  matched: number;
  /** The search string, echoed back so the box keeps it and the copy can quote it. */
  query: string;
  /**
   * The three system-level figures, counted over EVERY row read, never over the
   * search result. A filter narrows what you are looking at; it does not change
   * how many approvals nobody could be told about.
   */
  pendingCount: number;
  /** How many approvals nobody could be told about. The alarm figure. */
  undeliveredCount: number;
  /**
   * Codes that reached their date without anybody marking them used.
   *
   * A founder MAZJ approved, emailed, and then lost. Nothing else on this
   * screen counts that, so it had no presence at the system level at all.
   */
  expiredUnusedCount: number;
  /**
   * Whether the read hit its row cap, so the figures above are floors.
   *
   * 🔴 Rendered, never merely logged. `total` used to be shown as a headline
   * "Total", which is the length of a capped result labelled as a count: past
   * the cap the oldest rows silently vanish and the number becomes a ceiling
   * that looks like a measurement.
   */
  truncated: boolean;
  /** Loaded, or why not. Never a silent empty list. */
  error: QueueFailure | null;
};

/**
 * What `listStartupApplications` caps its read at.
 *
 * Duplicated from the service rather than exported by it, because the service
 * returns rows and not a page cursor, so the only signal available here is that
 * exactly this many came back. That over-reports by one case (a queue of
 * precisely 500 with nothing hidden) and under-reports by none, which is the
 * right direction for a warning: claiming completeness we cannot prove is the
 * failure mode that matters.
 */
const LIST_LIMIT = 500;

/** Longest search string we will act on. Longer cannot match any real value. */
export const QUERY_MAX = 64;

/**
 * 🔴 The `AdminUser` argument is unused at runtime and load-bearing at compile
 * time, exactly as in `_lib/dashboard.ts`.
 *
 * An `AdminUser` can only be obtained from `requireAdmin()` or
 * `getAdminUser()`, both of which verify the session against Supabase and
 * re-check the email domain. So a page that forgets to authorise cannot call
 * this: it has nothing to pass, and `tsc` refuses it. That turns "somebody
 * remembered a line" into a property the compiler enforces, which matters more
 * here than on the dashboard: this table holds founders' names, addresses,
 * mobile numbers and descriptions of unlaunched businesses.
 *
 * `query` filters what is LISTED and never what is COUNTED. See `StartupsQueue`.
 */
export async function loadStartupsQueue(
  _admin: AdminUser,
  query = ""
): Promise<StartupsQueue> {
  const result = await listStartupApplications();

  if (!result.ok) {
    // 🔴 An empty queue and a failed query render DIFFERENTLY, always. "No
    // applications" and "we could not reach the database" are the same shape on
    // screen if you let them be, and they mean opposite things: one says go
    // home, the other says a founder may have applied an hour ago and nobody
    // can see it.
    //
    // The two error codes keep two different sentences, because they need two
    // different reactions: an upstream outage is worth waiting out, anything
    // else is worth telling somebody about.
    return {
      waiting: [],
      decided: [],
      total: 0,
      matched: 0,
      query,
      pendingCount: 0,
      undeliveredCount: 0,
      expiredUnusedCount: 0,
      truncated: false,
      error:
        result.error.code === "upstream_unavailable"
          ? {
              title: "The queue could not be read",
              message: "The database is not responding. This is usually temporary.",
              next: "Try again in a minute. Applications are still arriving while this screen cannot see them, so nothing is being lost.",
            }
          : {
              title: "The queue could not be read",
              message: "Could not load applications.",
              next: "Try again. If it happens twice, the reason is in the server log against this request.",
            },
    };
  }

  const applications = result.value.map(toSummary);
  const needle = query.trim().slice(0, QUERY_MAX).toLowerCase();
  const shown = needle ? applications.filter((a) => matches(a, needle)) : applications;

  return {
    waiting: shown.filter((a) => a.status === "pending"),
    decided: shown.filter((a) => a.status !== "pending"),
    total: applications.length,
    matched: shown.length,
    query,
    pendingCount: applications.filter((a) => a.status === "pending").length,
    undeliveredCount: applications.filter((a) => a.emailDelivered === false).length,
    expiredUnusedCount: applications.filter(isExpiredUnused).length,
    truncated: applications.length >= LIST_LIMIT,
    error: null,
  };
}

/**
 * One application, or an honest account of why not.
 *
 * 🔴 THREE outcomes, not two. Collapsing a failed read into `null` made the
 * page call `notFound()`, so a database outage rendered as "this application
 * does not exist" one click from a list page that spends five lines of comment
 * refusing exactly that. The founder's row was fine the whole time.
 */
export type ApplicationResult =
  | { state: "found"; application: ApplicationDetail }
  | { state: "absent" }
  | { state: "failed"; error: QueueFailure };

export async function loadApplication(
  _admin: AdminUser,
  id: string
): Promise<ApplicationResult> {
  const result = await getStartupApplication(id);

  if (!result.ok) {
    // The service shape-checks the id before it reaches Postgres, so a
    // hand-edited URL arrives here as `not_found` rather than as a driver
    // error. That is what makes this branch trustworthy: `absent` really does
    // mean the row is not there.
    if (result.error.code === "not_found") return { state: "absent" };

    return {
      state: "failed",
      error:
        result.error.code === "upstream_unavailable"
          ? {
              title: "This application could not be read",
              message: "The database is not responding. This is usually temporary.",
              next: "Try again in a minute. Nothing has been decided and nothing has been sent.",
            }
          : {
              title: "This application could not be read",
              message: "Could not load this application.",
              next: "Go back to the queue and open it again. If it fails twice, the reason is in the server log.",
            },
    };
  }

  const row = result.value;
  return {
    state: "found",
    application: {
      ...toSummary(row),
      email: row.email,
      phone: row.phone_e164,
      pitch: row.pitch,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by,
      decisionNote: row.decision_note,
      emailSentAt: row.decision_email_sent_at,
      redeemedBy: row.redeemed_by,
    },
  };
}

function toSummary(row: StartupApplicationRow): ApplicationSummary {
  const decided = row.status !== "pending";

  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    founderName: row.founder_name,
    startupName: row.startup_name,
    status: row.status as ApplicationSummary["status"],
    stage: row.stage,
    space: row.space,
    teamSize: row.team_size,
    locale: row.locale,
    code: row.code,
    codeExpiresAt: row.code_expires_at,
    codeExpired: isCodeExpired(row.code_expires_at),
    redeemedAt: row.redeemed_at,
    // Three states, not two. `null` means nothing was owed; `false` means
    // something was owed and did not arrive.
    emailDelivered: decided ? row.decision_email_sent_at !== null : null,
    emailError: row.decision_email_error,
  };
}

/**
 * An issued code that reached its date unused.
 *
 * `codeExpired` alone is not enough: a code that was honoured on day 4 is still
 * past its date on day 40, and counting it as a loss would put the feature's
 * successes into its failure figure.
 */
function isExpiredUnused(row: ApplicationSummary): boolean {
  return row.code !== null && row.codeExpired && row.redeemedAt === null;
}

/**
 * What the search box looks at.
 *
 * The reference first, because `MZ-XXXXXX` is the handle a founder quotes over
 * WhatsApp and it exists nowhere else on this screen: answering "I'm MZ-4K7Q2X,
 * what happened?" used to mean opening rows one at a time. The two names are
 * included because whoever is asking usually says one of those instead.
 *
 * Not the email, the pitch or the phone number. A queue holding other people's
 * confidences should match on what they would quote at you, not offer a way to
 * sweep the table for a word.
 */
function matches(row: ApplicationSummary, needle: string): boolean {
  return (
    row.reference.toLowerCase().includes(needle) ||
    row.startupName.toLowerCase().includes(needle) ||
    row.founderName.toLowerCase().includes(needle)
  );
}

/** `shared_seat` reads as machinery; the admin should see a room. */
export const SPACE_LABELS: Record<string, string> = {
  shared_seat: "Open desk",
  private_office: "Private office",
  meeting_room: "Al-Malqa",
  event_hall: "Al-Ma'arij",
};

export const STAGE_LABELS: Record<string, string> = {
  idea: "Idea",
  building: "Building",
  earning: "Earning",
};

/** How the applicant wrote to us, and therefore how we write back. */
export const LOCALE_LABELS: Record<string, string> = {
  ar: "Arabic",
  en: "English",
};
