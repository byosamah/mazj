import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { errors, type AppError } from "../core/errors";
import { hashIp } from "../core/hash";
import { log } from "../core/logger";
import { checkRateLimit, rateLimitedError } from "../core/rate-limit";
import { err, ok, type Result } from "../core/result";
import { normaliseAdminEmail } from "../domain/admin-access";
import { env } from "../env";

/**
 * Gate 1 of 3: refusing to send a magic link to anyone outside the domain.
 *
 * The other two gates stop an outsider USING a link. This one stops them
 * receiving one, which matters because a magic link in an outsider's inbox is
 * already a problem even if it is refused on click: it tells them the admin
 * exists, where it lives, and that MAZJ uses Supabase.
 *
 * WHY THE SUPABASE CLIENT IS INJECTED. `server/` may not import `next/*`, and
 * the client that must be used here is the cookie-bound one, because
 * `@supabase/ssr` runs the PKCE flow: requesting a link writes a code-verifier
 * cookie to the visitor's browser, and the callback cannot complete the
 * exchange without it. Passing the client in keeps that Next dependency in
 * `app/` where it belongs.
 */

/** Magic-link requests permitted per window, per client. */
const LIMIT = 5;
/** One hour, matching Supabase's own `mailer_otp_exp`. */
const WINDOW_SECONDS = 3600;

export type MagicLinkInput = {
  /** Raw, untrusted. Validated here, never before. */
  email: unknown;
  /** Client IP, already extracted from headers. Hashed before storage. */
  ip: string;
  /** Absolute URL Supabase sends the visitor back to. */
  redirectTo: string;
};

/**
 * Requests a magic link, if and only if the address is a MAZJ one.
 *
 * 🔴 RETURNS SUCCESS FOR A REFUSED ADDRESS, DELIBERATELY.
 *
 * The caller renders the same message either way: "if that address can use the
 * admin, a link is on its way". Any observable difference between an allowed
 * and a refused address turns this endpoint into an oracle for enumerating who
 * works at MAZJ, which is a list worth having if you intend to phish one of
 * them. So a refusal is logged server-side and reported to the caller as
 * nothing at all.
 *
 * That has a real cost, and it is worth naming rather than hiding: a genuine
 * mail failure is also invisible to the person waiting for the email. Nobody
 * gets an error, they just get nothing. The compensations are that the outcome
 * is always in the log with the address attached, and that the rate limiter
 * caps this at five attempts an hour per client, which is also what makes the
 * remaining timing difference impractical to measure.
 */
export async function requestAdminMagicLink(
  supabase: SupabaseClient,
  input: MagicLinkInput
): Promise<Result<void, AppError>> {
  // Rate limited BEFORE the address is even parsed. Limiting after validation
  // would leave the cheap path (send garbage, get refused) unlimited, and that
  // is precisely the path an enumeration script walks.
  const limit = await checkRateLimit({
    scope: "admin:magic-link",
    identity: hashIp(input.ip, env().IP_HASH_SALT),
    limit: LIMIT,
    windowSeconds: WINDOW_SECONDS,
  });

  if (!limit.ok) return err(limit.error);
  if (!limit.value.allowed) return err(rateLimitedError(limit.value));

  const email = normaliseAdminEmail(input.email);

  if (!email) {
    // The one place the refusal is visible. Worth a warn rather than an info:
    // on an internal tool with a handful of users, someone trying an address
    // that is not one of ours is either a typo or somebody probing.
    log.warn("admin.magic_link.refused", {
      reason: "email outside the permitted domain",
      // `redact` in the logger handles anything that looks like a secret; an
      // address is not one, and without it this log line cannot be acted on.
      email: typeof input.email === "string" ? input.email.slice(0, 120) : null,
    });
    return ok();
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: input.redirectTo,
      // Account creation is governed by the `before user created` hook (gate 2),
      // not here. Left true so the first sign-in of a legitimate new colleague
      // works without someone hand-creating a row first.
      shouldCreateUser: true,
    },
  });

  if (error) {
    log.error("admin.magic_link.send_failed", {
      email,
      reason: error.message,
      status: error.status,
    });
    // Still `ok` to the caller. See the note above: differentiating here would
    // reveal that this address is one of ours.
    return ok();
  }

  log.info("admin.magic_link.sent", { email });
  return ok();
}

/**
 * Turns whatever the magic link carried into a session.
 *
 * 🔴 TWO MECHANISMS, AND THE ORDER MATTERS.
 *
 * Supabase can hand a link back in three shapes, and only two of them are
 * usable from a server:
 *
 *   1. `?token_hash=...&type=...` -> `verifyOtp`. This is what MAZJ's email
 *      template produces, and it is the shape this flow is built around.
 *   2. `?code=...` -> `exchangeCodeForSession`. The PKCE shape. Handled because
 *      Supabase produces it if the template is ever reverted to the default
 *      `{{ .ConfirmationURL }}`, and a silent regression to a broken login is
 *      not worth saving eight lines.
 *   3. `#access_token=...` in a URL FRAGMENT. Unusable, and the reason the
 *      template was changed at all: a fragment is never sent to the server, so
 *      the callback sees an empty query string and can do nothing but fail. This
 *      was observed for real against this project before the template was fixed.
 *
 * The `token_hash` route also survives something PKCE does not: a link requested
 * on a laptop and opened on a phone. PKCE binds the link to the browser holding
 * the code-verifier cookie, and "request on desktop, read mail on mobile" is the
 * normal way people use email, not an edge case.
 */
export type SignInParams = {
  tokenHash?: string | null;
  type?: string | null;
  code?: string | null;
};

export async function completeAdminSignIn(
  supabase: SupabaseClient,
  params: SignInParams
): Promise<Result<void, AppError>> {
  const invalid = errors.unauthorized(
    "That sign-in link is invalid or has expired."
  );

  if (params.tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      // `magiclink` for an existing user, `email` for a first sign-in. The
      // template sends whichever applies; anything unrecognised is refused
      // rather than coerced.
      type: params.type === "magiclink" ? "magiclink" : "email",
    });

    if (error) {
      log.warn("admin.sign_in.verify_failed", {
        reason: error.message,
        status: error.status,
      });
      return err(invalid);
    }
    return ok();
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);

    if (error) {
      log.warn("admin.sign_in.exchange_failed", {
        reason: error.message,
        status: error.status,
      });
      return err(invalid);
    }
    return ok();
  }

  log.warn("admin.sign_in.no_credential", {
    reason: "callback reached with neither token_hash nor code",
  });
  return err(invalid);
}
