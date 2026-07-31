import "server-only";

import { errors, type AppError } from "../core/errors";
import { hashIdentifier, hashIp } from "../core/hash";
import { log } from "../core/logger";
import { checkRateLimits, rateLimitedError } from "../core/rate-limit";
import type { ClientIdentity } from "../core/request";
import { err, ok, type Result } from "../core/result";
import { claimSeat, getEventBySlug, releaseSeat } from "../db/events";
import { registrationIsOpen } from "../domain/events";
import { normalizePhone } from "../domain/phone";
import { cleanFreeText, looksLikeEmail } from "../domain/text";
import { env } from "../env";

/**
 * Signing up for a FREE event.
 *
 * Everything the browser sent is a suggestion. This module and
 * `public.event_claim_seat` between them are the only things deciding whether a
 * seat exists and who gets it.
 *
 * 🔴 A TICKETED EVENT IS REFUSED HERE, and that refusal is load-bearing rather
 * than defensive tidiness. Since 2026-07-30 a paid event is not sold on this
 * site at all: `/events/<slug>` renders a link to the Rekaz storefront instead
 * of a form, because Rekaz publishes no write endpoint for a one-time product.
 * But a Server Action is a public POST endpoint reachable by its id from the
 * client bundle, so without this check a crafted request would still claim a
 * FREE seat on a paid event, and the holder would arrive expecting to be let in.
 * The page not rendering a form is not access control.
 *
 * Design records: `docs/superpowers/specs/2026-07-28-events-programme-design.md`
 * and `docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md`.
 */

/** Registrations permitted per client per window. */
const PER_ORIGIN_LIMIT = 10;
const WINDOW_SECONDS = 3600;

/**
 * Registrations permitted per MOBILE NUMBER per window.
 *
 * One person signs up for one event, occasionally two or three in a burst when
 * a season is announced. Five is comfortably above that and far below the
 * number needed to walk a programme claiming seats under one identity.
 */
const PER_MOBILE_LIMIT = 5;

const MAX_NAME_LENGTH = 120;
const MAX_EMAIL_LENGTH = 254;

export type EventRegistrationRequest = {
  eventSlug: string;
  customer: { name: string; mobile: string; email?: string };
  locale: string;
  ip: ClientIdentity;
};

export type EventRegistrationResult =
  /** They are on the list and nothing else needs to happen. */
  | { kind: "confirmed"; seatsLeft: number | null }
  /** They already held a seat. Reported as good news, because it is. */
  | { kind: "already_registered" };

export async function registerForEvent(
  request: EventRegistrationRequest
): Promise<Result<EventRegistrationResult, AppError>> {
  // ---------------------------------------------------------------- validate
  const found = await getEventBySlug(request.eventSlug);
  if (!found.ok) return found;

  const event = found.value;
  if (!event || event.status !== "published") {
    return err(errors.notFound("No such event."));
  }

  // 🔴 Checked FIRST, above every other rule, and refused before a single hash
  // is computed. A ticket is bought on the Rekaz storefront; there is no seat
  // here to give away. It reads as a `conflict` rather than a `not_found`
  // because the event is real and the visitor did nothing wrong: they simply
  // arrived at a door that is not the one selling this.
  if (event.rekazPriceImmutableId !== null) {
    return err(
      errors.conflict("Tickets for this event are not sold here.", {
        fields: { reason: "ticketed" },
      })
    );
  }

  // Checked here as well as inside `event_claim_seat`. The function is the one
  // that cannot be raced; this is the one that can say WHY, and it avoids doing
  // any work at all for an event that closed last week.
  if (!registrationIsOpen(event)) {
    return err(
      errors.conflict("Registration for this event has closed.", {
        fields: {reason: "closed"},
      })
    );
  }

  const mobile = normalizePhone(request.customer.mobile);
  if (!mobile) {
    return err(
      errors.validation("Please enter a valid mobile number.", {
        mobile: "invalid",
      })
    );
  }

  // Cleaned and BOUNDED, not merely trimmed. This form is public and
  // unauthenticated and whatever is typed here is rendered on an internal
  // screen, so an unbounded string is a stranger writing arbitrary length into
  // MAZJ's own tooling, and a control character is a 503 blaming our database
  // for their input.
  const name = cleanFreeText(request.customer.name, MAX_NAME_LENGTH);
  if (name.length < 2) {
    return err(errors.validation("Please enter your name.", { name: "required" }));
  }

  const submittedEmail = cleanFreeText(
    request.customer.email ?? "",
    MAX_EMAIL_LENGTH
  ).toLowerCase();
  const email = looksLikeEmail(submittedEmail) ? submittedEmail : null;

  const locale = request.locale === "ar" ? "ar" : "en";

  // Computed once and reused by every log line below, so the bucket a request
  // was counted against and the record of what it did carry the SAME pseudonym.
  // Two independent hashes of one address are two numbers nobody can join.
  const originHash = request.ip.ip
    ? hashIp(request.ip.ip, env().IP_HASH_SALT)
    : null;
  const submitterHash = hashIdentifier(mobile, env().IP_HASH_SALT, "mobile");

  // ------------------------------------------------------------- rate limits
  // 🔴 The SELF-keyed bucket is charged here and short-circuits. The
  // RESOURCE-keyed one is charged further down, only once a seat has genuinely
  // been claimed. The split and the ordering are the mitigation, not a detail:
  // the mobile bucket is keyed on a VICTIM, so charging it up here would let
  // five throwaway requests carrying a stranger's number exhaust that number's
  // allowance and lock the real owner out of registering for an hour. The
  // counter increments before it decides, so even a request that was always
  // going to be rejected still spends the allowance.
  if (originHash) {
    const byOrigin = await checkRateLimits([
      {
        scope: "event:register",
        identity: originHash,
        limit: PER_ORIGIN_LIMIT,
        windowSeconds: WINDOW_SECONDS,
      },
    ]);
    if (!byOrigin.ok) return err(byOrigin.error);
    if (!byOrigin.value.allowed) {
      log.warn("event_registration.rate_limited", {
        eventSlug: event.slug,
        scope: "event:register",
        originHash,
        originAttested: request.ip.attested,
      });
      return err(rateLimitedError(byOrigin.value));
    }
  }

  // ------------------------------------------------------------- claim a seat
  // ⚠️ `holdSeconds: 0` on every call now, and the parameter survives on
  // purpose. It existed for the 30-minute payment hold, which only a paid event
  // ever used and which nothing on this site creates any more. The SQL keeps it
  // because an expired hold simply stops counting in both the claim and the
  // count, so the mechanism costs nothing while unused and is the piece that
  // would have to be rebuilt first if ticket sales ever come back on-site.
  const claim = await claimSeat({
    eventId: event.id,
    fullName: name,
    email,
    phoneE164: mobile,
    locale,
    ipHash: originHash,
    holdSeconds: 0,
  });
  if (!claim.ok) return claim;

  switch (claim.value.outcome) {
    case "not_found":
      return err(errors.notFound("No such event."));
    case "closed":
      return err(
      errors.conflict("Registration for this event has closed.", {
        fields: {reason: "closed"},
      })
    );
    case "full":
      // 🔴 `reason` rides in `fields` because `ErrorCode` is a closed union and
      // "closed" and "fully booked" are both `conflict`. They need different
      // sentences on screen: one says come back next time, the other says you
      // are too late. Collapsing them is how somebody who could have taken the
      // next event gets told nothing useful.
      return err(
        errors.conflict("This event is fully booked.", {
          fields: {reason: "full"},
        })
      );

    case "duplicate":
      // 🔴 THIS IS THE IDEMPOTENCY MECHANISM, and it deliberately is not
      // `idempotency_keys`. That deserves stating, because `server/CLAUDE.md`
      // says any public write endpoint needs both a rate limit and an
      // idempotency key, and this one has only the first.
      //
      // `idempotency_keys` is keyed on a string the CLIENT generates. That is
      // the right primitive for booking a room, where the same person may
      // legitimately book two different slots and only a client-supplied key can
      // tell a retry from a second booking. Here the resource itself is unique:
      // one seat per mobile per event, enforced by a database constraint. So the
      // constraint IS the key, and it is strictly stronger, because a client can
      // vary a string it invents and cannot vary the fact that it is the same
      // number asking about the same event.
      //
      // ⚠️ The one case a client key would additionally have covered was a Rekaz
      // write that timed out without an answer, where a retry might create a
      // second order. Nothing on this path writes to Rekaz any more, so that
      // case no longer exists at all.
      return ok({ kind: "already_registered" });
    case "claimed":
      break;
  }

  const registrationId = claim.value.registrationId;
  if (!registrationId) {
    return err(errors.internal("event_claim_seat claimed without an id"));
  }

  // The RESOURCE-keyed ceiling, charged only now.
  //
  // Everything above could reject a request without it ever having been a real
  // registration: an unknown event, a ticketed one, a closed one, a bad number,
  // a full room, or somebody already on the list. None of those may spend the
  // allowance of whoever owns the submitted number, because the submitter does
  // not have to be that person. By this line the request is well-formed and has
  // genuinely taken a seat, so charging the number it names is charging a real
  // attempt.
  const byMobile = await checkRateLimits([
    {
      scope: "event:mobile",
      identity: submitterHash,
      limit: PER_MOBILE_LIMIT,
      windowSeconds: WINDOW_SECONDS,
    },
  ]);
  if (!byMobile.ok || !byMobile.value.allowed) {
    // Give the seat back. Holding it would let a refused request quietly
    // consume capacity for the length of the window.
    await releaseSeat(registrationId);
    if (!byMobile.ok) return err(byMobile.error);

    log.warn("event_registration.rate_limited", {
      eventSlug: event.slug,
      scope: "event:mobile",
      originHash,
      originAttested: request.ip.attested,
      submitterHash,
    });
    return err(rateLimitedError(byMobile.value));
  }

  // 🔴 Field names chosen against `core/logger.ts`'s SUBSTRING denylist, which
  // redacts any key containing name, email, phone, mobile, ip, key, address and
  // several more, at every depth. `eventName` would be written as "[redacted]";
  // `eventSlug` survives. The booking path shipped nine dead fields exactly this
  // way and the compensating control they were supposed to provide had never
  // once recorded anything.
  log.info("event_registration.claimed", {
    eventSlug: event.slug,
    seatsLeft: claim.value.seatsLeft,
    originHash,
    originAttested: request.ip.attested,
    submitterHash,
  });

  return ok({ kind: "confirmed", seatsLeft: claim.value.seatsLeft });
}
