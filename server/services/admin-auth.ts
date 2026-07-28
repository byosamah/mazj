import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { errors, type AppError } from "../core/errors";
import { hashIdentifier, hashIp } from "../core/hash";
import { log } from "../core/logger";
import { checkRateLimits, rateLimitedError } from "../core/rate-limit";
import type { ClientIdentity } from "../core/request";
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

/** Magic-link requests permitted per window, per client address. */
const LIMIT = 5;

/**
 * Magic-link requests permitted per EMAIL ADDRESS per window.
 *
 * Two, matching Supabase's project-wide mailer budget rather than exceeding it.
 *
 * 🔴 Read this before believing the ceiling protects anyone. It CANNOT stop one
 * address locking the others out, and an earlier version of this comment claimed
 * it could. The built-in sender is capped at roughly 2 messages an hour for the
 * WHOLE PROJECT, so any single address that spends its own allowance has already
 * spent everybody's. No per-address number can fix that; arithmetic forbids it.
 *
 * What it does buy, which is smaller and real: a flood cannot consume the budget
 * many times over before anyone notices, every refusal is now logged with the
 * address pseudonym, and the limit sits at the budget rather than above it, so
 * "allowed by us" and "actually sendable" stop disagreeing.
 *
 * 🔴 The durable fix is custom SMTP, which removes the shared budget entirely.
 * Until then the magic-link path has a project-wide single point of failure that
 * no code in this file can close.
 */
const PER_ADDRESS_LIMIT = 2;
/** One hour, matching Supabase's own `mailer_otp_exp`. */
const WINDOW_SECONDS = 3600;

export type MagicLinkInput = {
  /** Raw, untrusted. Validated here, never before. */
  email: unknown;
  /** Client address plus whether the platform vouches for it. See `clientIp`. */
  ip: ClientIdentity;
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
 * is always in the log (as a domain plus a salted pseudonym, never the address
 * itself: a key called `email` is redacted on the way out, which is what made
 * every one of these lines blank before 2026-07-28), and that the rate limiter
 * caps this per client AND per address, which is also what makes the remaining
 * timing difference impractical to measure.
 */
export async function requestAdminMagicLink(
  supabase: SupabaseClient,
  input: MagicLinkInput
): Promise<Result<void, AppError>> {
  // Rate limited BEFORE the address is even parsed. Limiting after validation
  // would leave the cheap path (send garbage, get refused) unlimited, and that
  // is precisely the path an enumeration script walks.
  //
  // 🔴 TWO dimensions. Neither one closes the project-wide mail budget, and
  // saying otherwise would be the comfortable lie: see `PER_ADDRESS_LIMIT`.
  //
  // The address bucket bounds how often one inbox can be targeted and makes the
  // attempt visible in the log. ⚠️ It cuts both ways, and that is accepted: an
  // attacker who knows a real admin address can exhaust that address's allowance
  // for an hour. That is the same targeted-lockout shape as the booking path's
  // mobile bucket, and it is tolerated here for the same reason: the alternative
  // is a single forgeable IP being the only thing between an anonymous caller
  // and the whole team's ability to sign in.
  //
  // The address is bucketed BEFORE validation, deliberately, so the ordering
  // above survives: whatever arrived is lowercased and trimmed and hashed as-is.
  // It is a bucket key, not an identity, so it does not need to be a real
  // address to be useful.
  const submitted =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

  const limit = await checkRateLimits([
    ...(input.ip.ip
      ? [
          {
            scope: "admin:magic-link",
            identity: hashIp(input.ip.ip, env().IP_HASH_SALT),
            limit: LIMIT,
            windowSeconds: WINDOW_SECONDS,
          },
        ]
      : []),
    ...(submitted
      ? [
          {
            scope: "admin:magic-link:address",
            identity: hashIdentifier(submitted, env().IP_HASH_SALT, "email"),
            limit: PER_ADDRESS_LIMIT,
            windowSeconds: WINDOW_SECONDS,
          },
        ]
      : []),
  ]);

  if (!limit.ok) return err(limit.error);
  if (!limit.value.allowed) return err(rateLimitedError(limit.value));

  const email = normaliseAdminEmail(input.email);

  if (!email) {
    // The one place the refusal is visible. Worth a warn rather than an info:
    // on an internal tool with a handful of users, someone trying an address
    // that is not one of ours is either a typo or somebody probing.
    log.warn("admin.magic_link.refused", {
      reason: "email outside the permitted domain",
      // 🔴 NOT a key containing "email". `core/logger.ts` redacts on a substring
      // match, so the previous `email:` field here was written as "[redacted]"
      // on every refusal, and the comment claiming the line could not be acted
      // on without it was describing a line that had never carried it. Same bug
      // as `booking.attempt` had, in a second place.
      //
      // The DOMAIN is the actionable half and is not personal data, so it is
      // kept in the clear: "someone tried a gmail address" is the signal, and
      // which gmail address is not worth putting in a log store. The pseudonym
      // is what links repeated attempts from the same address together.
      submittedDomain: domainOf(input.email),
      submitterHash: hashIdentifier(submitted, env().IP_HASH_SALT, "email"),
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
      // Redacted-key trap again: an `email:` field here logs "[redacted]". The
      // domain plus the pseudonym is what an operator can actually act on.
      submittedDomain: domainOf(email),
      submitterHash: hashIdentifier(email, env().IP_HASH_SALT, "email"),
      reason: error.message,
      status: error.status,
    });

    // 🔴 A MAILER QUOTA FAILURE IS REPORTED, unlike every other failure here.
    //
    // Supabase's built-in sender is capped at 2 emails per hour PROJECT-WIDE,
    // not per address and not per IP. Our own limit is 5 per client, so an
    // anonymous visitor staying comfortably inside it can drain the whole
    // project's hourly budget and lock every admin out. Swallowing that told
    // the locked-out admin "a link is on its way" while nothing had been sent,
    // which turns a fixable outage into an unexplainable one.
    //
    // Surfacing it does NOT weaken the anti-enumeration property, and the
    // distinction is exactly the point: enumeration is about whether an ADDRESS
    // is valid, and a global quota failure is address-independent. It says
    // nothing about who is or is not a MAZJ admin.
    //
    // Lowering the limit is the obvious wrong fix: the identity is a hashed
    // `x-forwarded-for`, which is client-forgeable, so no number binds. The real
    // fix is custom SMTP, which raises the cap and removes the shared budget.
    if (error.status === 429) {
      return err(
        errors.upstreamUnavailable(
          "Email is temporarily unavailable. Please try again shortly."
        )
      );
    }

    // Every other failure stays silent. See the note above: differentiating
    // here would reveal that this address is one of ours.
    return ok();
  }

  // 🔴 NOT `{ email }`. This is the record that a WORKING admin credential was
  // issued, and `email` is the first entry in the logger's denylist, so the line
  // carried literally nothing identifying. It matters more than the two refusal
  // paths above, which were fixed first: after a phishing report this is the only
  // evidence of who was sent a link and when.
  log.info("admin.magic_link.sent", {
    submittedDomain: domainOf(email),
    submitterHash: hashIdentifier(email, env().IP_HASH_SALT, "email"),
  });
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

/**
 * The domain half of whatever was submitted, or null.
 *
 * Deliberately NOT parsing: this is for a log line, so it must never throw and
 * must never care whether the input is a valid address. RFC 5321 puts the domain
 * after the LAST `@`, which is the same rule `isAllowedAdminEmail` applies and
 * the reason `"x@mazj.org"@evil.com` is not a MAZJ address.
 */
function domainOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const at = value.lastIndexOf("@");
  if (at < 0) return null;
  const domain = value.slice(at + 1).trim().toLowerCase();
  return domain ? domain.slice(0, 100) : null;
}
