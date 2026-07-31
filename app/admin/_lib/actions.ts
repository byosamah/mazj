"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { clientIp } from "@/server/core/request";
import { riyadhTime } from "@/server/domain/riyadh-time";
import { requestAdminMagicLink } from "@/server/services/admin-auth";
import {
  decideStartupApplication,
  markCodeRedeemed,
  resendDecisionEmail,
} from "@/server/services/startup-application";

import { requireAdmin } from "./auth";
import { adminSupabase } from "./supabase";

/**
 * The admin's write endpoints, as Server Actions.
 *
 * These are Server Actions rather than route handlers under `app/api/**` for
 * one concrete reason: `@supabase/ssr` uses the PKCE flow, so requesting a
 * magic link writes a code-verifier cookie that the callback later needs to
 * complete the exchange. Both halves therefore need a cookie store they can
 * WRITE to, which a Server Component cannot provide but an action can.
 *
 * They are still public POST endpoints, with all that implies. The rate limit
 * lives in the service, not here, so it cannot be skipped by a second caller.
 *
 * ⚠️ EVERY export from this file is a callable Server Action, because the file
 * is `"use server"`. Nothing may be exported here except an async action and a
 * type: a helper taking a Supabase client would become an action nobody can
 * invoke and would widen the public POST surface for free. `_lib/session.ts`
 * exists for exactly that.
 */

/** Which failure, so the form can pick a tone. Never an upstream string. */
export type LoginFailure = "rate_limited" | "upstream_unavailable" | "unknown";

export type LoginState = {
  /** Rendered beside the form. Chosen by code, never `AppError.message`. */
  message: string | null;
  sent: boolean;
  /**
   * Set on every failure. The three of them need three different tones: a rate
   * limit is the visitor's own doing, a mail outage is ours, and neither reads
   * like the other on screen.
   */
  code?: LoginFailure;
  /**
   * Seconds until the limit lifts (P9).
   *
   * The service computes this against a 3600-second window and the action used
   * to throw it away, so the screen said "wait a while" for something that can
   * be a full hour. An hour is a decision (go and do something else); "a while"
   * is a reason to press the button again in ninety seconds.
   */
  retryAfter?: number;
  /**
   * What was typed, echoed straight back.
   *
   * The form no longer unmounts itself on success, so the input keeps its value
   * and `omar@mazj.or` is one keystroke from fixed rather than retyped from
   * memory. Echoing it reveals nothing: it is the submitter's own input going
   * back to the submitter.
   */
  email?: string;
};

/**
 * RFC 5321 caps a whole address at 254 octets, so nothing longer can be real.
 * The cap is on the ECHO, not on the check: the service validates the raw value
 * and is the only thing that decides whether an address is usable.
 */
const EMAIL_ECHO_MAX = 254;

/**
 * Requests a magic link.
 *
 * 🔴 Reports the SAME outcome for an address that is allowed and one that is
 * not. The service explains why at length; the short version is that any
 * difference here is a way to enumerate who works at MAZJ.
 */
export async function requestLoginLink(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const requestHeaders = await headers();
  const supabase = await adminSupabase();

  const submitted = formData.get("email");
  const email =
    typeof submitted === "string" ? submitted.slice(0, EMAIL_ECHO_MAX) : "";

  // Built from the incoming request rather than from a configured site URL, so
  // a link requested on localhost returns to localhost and one requested on the
  // production domain returns there. A hardcoded origin here is how the magic
  // link ends up sending a developer to production.
  const origin = requestOrigin(requestHeaders);

  const result = await requestAdminMagicLink(supabase, {
    // Raw and unvalidated, on purpose. The service owns the address rule, and
    // pre-filtering here would put a second copy of it on the enumeration path.
    email: submitted,
    ip: clientIp(requestHeaders),
    redirectTo: `${origin}/admin/auth/callback`,
  });

  if (!result.ok) {
    // Fixed strings chosen by CODE, never `result.error.message`: that message
    // is written for logs and can carry upstream detail.
    if (result.error.code === "rate_limited") {
      const retryAfter = result.error.retryAfterSeconds;

      return {
        sent: false,
        email,
        code: "rate_limited",
        retryAfter,
        // Naming the real clock time turns a refusal into a decision: 15:42 is
        // something a person can plan around, "a while" is a reason to keep
        // pressing. Riyadh, because that is the clock everyone reading this
        // screen is standing in, and it is the clock the rest of the admin
        // quotes. The `typeof` branch is not a fallback: if the window was
        // never computed we must not name an hour we did not measure.
        message:
          typeof retryAfter === "number"
            ? `Too many attempts. Try again after ${riyadhTime(new Date(Date.now() + retryAfter * 1000))}.`
            : "Too many attempts. Try again later.",
      };
    }

    if (result.error.code === "upstream_unavailable") {
      // The project-wide email quota is exhausted. Saying so is honest and
      // reveals nothing about the address: a global quota is address
      // independent, so it says nothing about who is or is not a MAZJ admin.
      // The alternative (reporting success) left an admin waiting for a link
      // that was never sent. It names itself as OUR failure because the reader's
      // only other reading is that they typed something wrong.
      return {
        sent: false,
        email,
        code: "upstream_unavailable",
        message:
          "Email is temporarily unavailable. This is our system, not your account. Try again shortly.",
      };
    }

    return {
      sent: false,
      email,
      code: "unknown",
      message: "Something went wrong. Please try again.",
    };
  }

  return {
    sent: true,
    email,
    message: null,
  };
}

/** Ends the session and returns to the login page. */
export async function signOut(): Promise<void> {
  // No guard: signing out an already-anonymous caller is a no-op, and requiring
  // a session to END a session would strand anyone whose token had just expired
  // on a page with a button that could not work.
  const supabase = await adminSupabase();
  await supabase.auth.signOut();

  // 🔴 `?bye=1`, not a bare `/admin/login`. Two reasons, and the second is the
  // real one. It confirms the thing happened, and it lets the login page ask
  // Supabase whether the session is ACTUALLY gone rather than trusting the call
  // above: a sign-out that silently failed used to render as the login form,
  // then a bounce straight back to the dashboard on the next click, which reads
  // as "the button is broken" rather than "you are still signed in".
  //
  // The return value of `signOut()` is deliberately not consulted for that: the
  // page re-verifies with the auth server, which is a stronger question than
  // what this call claims.
  redirect("/admin/login?bye=1");
}

/**
 * ⚠️ `refreshDashboard` STOOD HERE and was deleted on 2026-07-30 with the
 * Rekaz-fed dashboard it served (owner ruling: bookings and memberships are
 * managed in Rekaz's own platform, so this tool no longer copies them).
 *
 * It existed for one reason and the reason is gone. The dashboard's figures were
 * held in a 60-second `unstable_cache`, because assembling them cost 2.8s to
 * 7.8s against an API measured between 1.2s and 10.8s, so the page needed a
 * control that could bust that cache: a bare redirect re-rendered the identical
 * stale numbers and read as a broken button. `/admin` now reads three Postgres
 * counts per request and caches nothing between requests, so there is no
 * staleness for a control to fix.
 *
 * 🔴 The lesson it carried is not deleted, and it applies to every action in
 * this file: an action is a public POST endpoint reachable by its id from the
 * client bundle, so it must call `requireAdmin()` ITSELF. Sitting under
 * `(protected)/` protects nothing. That one was the cheap case (an anonymous
 * caller could only drive load at the Rekaz API that also serves mazj.sa
 * checkout); the startups actions below can GRANT something.
 */

// ---------------------------------------------------------------------------
// The startups queue
// ---------------------------------------------------------------------------

/**
 * 🔴 Every one of these calls `requireAdmin()` ITSELF.
 *
 * A Server Action is a public POST endpoint reachable by its id from the client
 * bundle. The `(protected)` layout guards PAGE RENDERS, and none of these is a
 * page render, so sitting under that folder protects nothing at all. Without
 * the guard, an anonymous caller could approve their own application, mint a
 * code, and have MAZJ email it to them from MAZJ's own verified domain.
 *
 * This is the same lesson `refreshDashboard` carries one level up, and it is
 * worth more here: that action could only cause load, these can grant something.
 */

export type DecisionState = {
  /** Rendered beside the form. Never an `AppError.message` from below. */
  message: string | null;
  ok: boolean;
  /**
   * The note as it was submitted, echoed back on every failure branch (P12).
   *
   * 🔴 React resets an uncontrolled form once the action resolves, so without
   * this a rejection reason of up to 1000 characters vanishes the moment the
   * save conflicts, and somebody has to write again, from memory, the careful
   * paragraph explaining to a founder why the answer is no. It is not clamped:
   * over-long input is refused BY THE SERVICE with a sentence saying so, and
   * truncating the echo would hand back something the writer never wrote.
   *
   * Deliberately absent on success. The decision is committed by then, and a
   * textarea still holding its text invites a second press.
   */
  note?: string;
  /**
   * Whether the email actually left the building.
   *
   * 🔴 Separate from `ok` because a decision and its email are two facts. An
   * approval whose mail failed is a SUCCESS that still needs a human, and
   * keying its notice on `ok` gives it the success skin, which is how a founder
   * ends up waiting on a code that exists only in our database.
   */
  delivered?: boolean;
};

/**
 * Approves or rejects one application.
 *
 * The decision is committed before the email is attempted, and the email is
 * never allowed to undo it. See `server/services/startup-application.ts`.
 */
export async function decideApplication(
  _previous: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "");

  if (decision !== "approved" && decision !== "rejected") {
    return { ok: false, note, message: "Choose approve or reject." };
  }

  const result = await decideStartupApplication({
    id,
    decision,
    note,
    adminEmail: admin.email,
  });

  if (!result.ok) {
    // Chosen by CODE, never `result.error.message`: that string is written for
    // logs and carries database and provider detail. The one exception is
    // `validation_failed`, whose message is authored for a human in the service
    // and is the only way to say WHICH rule the note broke.
    return {
      ok: false,
      note,
      message:
        result.error.code === "validation_failed"
          ? result.error.message
          : result.error.code === "conflict"
            ? "Somebody already decided that one."
            : result.error.code === "not_found"
              ? "That application no longer exists."
              : "Something went wrong. The decision was not recorded.",
    };
  }

  // 🔴 The outcome deliberately reports DELIVERY separately from the decision,
  // because they can and do differ. Saying only "Approved" when no email left
  // the building is how a founder ends up waiting on a code that exists only in
  // our database.
  const { status, code, delivered } = result.value;
  const headline = status === "approved" ? `Approved. Code ${code}.` : "Rejected.";

  // 🔴 `refresh()`, not `updateTag`. There is no server-side cache to bust:
  // `loadStartupsQueue` reads Postgres directly on every render, on purpose
  // (see `_lib/startups.ts`). What IS stale is the CLIENT router cache, which
  // would otherwise keep showing this application as pending until a hard
  // reload, i.e. the owner presses Approve and nothing visibly happens.
  refresh();

  return {
    ok: true,
    delivered,
    // The failure sentence leads with the consequence rather than the cause,
    // and carries no upstream text. The mailer's own words are not lost by
    // that: they are stored on the row as `decision_email_error`, surfaced as
    // `AdminApplication.emailError` (`_lib/startups.ts:52`) and rendered by
    // `(protected)/startups/[id]/page.tsx:74`, which is one `refresh()` away
    // and is where an operator's diagnostic belongs. Measured, not assumed.
    message: delivered
      ? `${headline} The email has gone.`
      : `${headline} Nothing has reached them yet. Try sending it again once the cause is fixed.`,
  };
}

/** Re-attempts a decision email that failed, after the cause is fixed. */
export async function resendApplicationEmail(
  _previous: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const result = await resendDecisionEmail(id);

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error.code === "conflict"
          ? "That application has not been decided yet."
          : "Could not resend. Try again shortly.",
    };
  }

  if (!result.value.delivered) {
    return {
      ok: false,
      delivered: false,
      message: "Still not sending. Nothing has reached them yet.",
    };
  }

  refresh();

  // 🔴 A redirect carrying `?resent=1`, not a returned "Sent." message.
  //
  // The confirmation used to destroy itself: `refresh()` clears the undelivered
  // flag, which unmounts the alarm panel that was holding the "Sent." line, so
  // the one signal that the retry worked disappeared at the instant it became
  // true. A query parameter survives that re-render.
  //
  // `encodeURIComponent` because the id arrives in a form post: it belongs in a
  // single path segment, and a value containing a slash must not be able to
  // steer the redirect somewhere else.
  redirect(`/admin/startups/${encodeURIComponent(id)}?resent=1`);
}

/**
 * Records that the team honoured a code.
 *
 * The only way redemption is ever recorded, because no software consumes this
 * code: Rekaz has no coupon API. Without somebody pressing this, MAZJ can say
 * how many codes were issued and nothing about how many were used.
 */
export async function redeemApplicationCode(
  _previous: DecisionState,
  formData: FormData
): Promise<DecisionState> {
  const admin = await requireAdmin();

  const result = await markCodeRedeemed(
    String(formData.get("id") ?? ""),
    admin.email
  );

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.error.code === "conflict"
          ? "That code is not approved, or is already marked used."
          : "Could not mark it used.",
    };
  }

  refresh();
  return { ok: true, message: "Marked as used." };
}

/**
 * The origin this request arrived on.
 *
 * ⚠️ `host` is client-controlled and must never be used for a security
 * decision. It is safe HERE only because Supabase independently validates the
 * redirect against its own allow-list: a forged host produces a link Supabase
 * refuses to issue, not a link that sends a visitor somewhere hostile. Keep
 * that allow-list tight, and never reuse this value for anything else.
 */
function requestOrigin(requestHeaders: Headers): string {
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
