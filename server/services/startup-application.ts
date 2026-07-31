import "server-only";

import { errors, type AppError } from "../core/errors";
import { hashIdentifier, hashIp } from "../core/hash";
import {
  abandonIdempotent,
  beginIdempotent,
  completeIdempotent,
} from "../core/idempotency";
import { log } from "../core/logger";
import { checkRateLimits, rateLimitedError } from "../core/rate-limit";
import { err, ok, type Result } from "../core/result";
import type { ClientIdentity } from "../core/request";
import { normalizePhone } from "../domain/phone";
import {
  asSpace,
  asStage,
  generateOfferCode,
  generateReference,
  offerCodeExpiry,
} from "../domain/startup-offer";
import { cleanFreeText, cleanMultilineText, looksLikeEmail } from "../domain/text";
import { emailConfig, sendEmail } from "../email/client";
import type { EmailLocale } from "../email/copy";
import {
  renderAlertEmail,
  renderApprovedEmail,
  renderReceivedEmail,
  renderRejectedEmail,
} from "../email/templates";
import { env } from "../env";
import { supabaseAdmin } from "../supabase/admin";
import type { Database } from "../supabase/types.gen";

/**
 * The startups & builders offer, end to end.
 *
 * Everything security-relevant about the public form lives here rather than in
 * the Server Action, because the action is a public POST endpoint that anyone
 * can call by reading its id out of the client bundle. The action translates
 * `FormData`; this decides.
 *
 * Three properties the form itself cannot provide:
 *
 *   1. **Two rate-limit dimensions.** One per network origin, one per submitted
 *      address. The second is the one that matters: this endpoint sends email to
 *      an address a stranger types, which is the shape of an open relay.
 *   2. **Idempotency.** A double tap files one application, not two.
 *   3. **A decision and its email are separate facts.** See `decide` below. It
 *      is the single most important rule in this file.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Applications per network origin per hour. */
const PER_ORIGIN_LIMIT = 5;
const ORIGIN_WINDOW_SECONDS = 3600;

/**
 * Applications per submitted email address per DAY.
 *
 * 🔴 The dimension that actually bounds harm here, and the window is a day
 * rather than an hour on purpose. Every accepted submission sends a message to
 * whatever address was typed, so without this the form is a way to mail a
 * stranger from MAZJ's own verified sending domain, as often as you like, with
 * MAZJ's reputation paying for it.
 *
 * Three is generous for a real person: one application, plus two for anyone who
 * mistyped their own address and tried again.
 *
 * ⚠️ Same weapon as the booking flow's per-mobile bucket, and mitigated the same
 * way: it is keyed on a possible VICTIM, so it is charged late (see `submit`),
 * after everything that could reject the request on its own merits.
 */
const PER_EMAIL_LIMIT = 3;
const EMAIL_WINDOW_SECONDS = 86_400;

const IDEMPOTENCY_SCOPE = "startup:apply";

// Bounds. Mirrored by check constraints in the migration, deliberately: this
// layer gives a human a sensible message, that one holds when a future path
// forgets to ask.
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MIN_PITCH = 20;
const MAX_PITCH = 2000;
const MAX_TEAM = 200;
const MIN_NOTE = 10;
const MAX_NOTE = 1000;

/** How many times to re-roll a generated identifier that collided. */
const COLLISION_RETRIES = 5;

export type StartupApplicationRow =
  Database["public"]["Tables"]["startup_applications"]["Row"];

export type StartupApplicationInput = {
  founderName: string;
  startupName: string;
  email: string;
  mobile: string;
  pitch: string;
  stage: string;
  teamSize: string;
  space: string;
  locale: string;
  /** Client-generated, stable across retries of the same submission. */
  idempotencyKey: string;
  ip: ClientIdentity;
};

export type SubmittedApplication = { reference: string };

// ---------------------------------------------------------------------------
// Submitting
// ---------------------------------------------------------------------------

export async function submitStartupApplication(
  input: StartupApplicationInput
): Promise<Result<SubmittedApplication, AppError>> {
  // --- Validate and normalise -----------------------------------------------
  //
  // By hand rather than through a schema library, matching `services/booking.ts`,
  // because each rejection here needs to name ONE field so the form can point at
  // it, and because the interesting decisions (what a pitch floor is for, why
  // the email is lowercased) are comments rather than validators.

  const founderName = cleanFreeText(input.founderName, MAX_NAME);
  if (founderName.length < 2) {
    return err(errors.validation("Name is required.", { founderName: "required" }));
  }

  const startupName = cleanFreeText(input.startupName, MAX_NAME);
  if (startupName.length < 1) {
    return err(
      errors.validation("Startup name is required.", { startupName: "required" })
    );
  }

  // Lowercased before anything else touches it, because it is about to become a
  // rate-limit bucket key AND a partial unique index key. `Founder@X.com` and
  // `founder@x.com` are one person, and treating them as two would hand anyone
  // an unlimited allowance by varying capitalisation.
  const email = cleanFreeText(input.email, MAX_EMAIL).toLowerCase();
  if (!looksLikeEmail(email)) {
    return err(errors.validation("A valid email is required.", { email: "invalid" }));
  }

  // Handles Arabic-Indic and Persian digits, and the `+966 (0)5…` trunk-prefix
  // trap. An Arabic keyboard emits ٠٥٣٤٦٠٠٤٨٨, which every ASCII-digit
  // validator on earth rejects.
  const phone = normalizePhone(input.mobile);
  if (!phone) {
    return err(errors.validation("A valid mobile number is required.", { mobile: "invalid" }));
  }

  const pitch = cleanMultilineText(input.pitch, MAX_PITCH);
  if (pitch.length < MIN_PITCH) {
    return err(
      errors.validation("Tell us a little more about what you are building.", {
        pitch: "too_short",
      })
    );
  }

  const stage = asStage(input.stage);
  if (!stage) {
    return err(errors.validation("Choose a stage.", { stage: "required" }));
  }

  const space = asSpace(input.space);
  if (!space) {
    return err(errors.validation("Choose a space.", { space: "required" }));
  }

  // 🔴 Parsed with a strict pattern, not `parseInt`. `parseInt("3 people")` is 3
  // and `parseInt("1e9")` is 1, both of which quietly accept a value nobody
  // typed and neither of which the database constraint would catch, since both
  // land inside the allowed range.
  const teamSize = /^\d{1,3}$/.test(input.teamSize.trim())
    ? Number(input.teamSize.trim())
    : Number.NaN;
  if (!Number.isInteger(teamSize) || teamSize < 1 || teamSize > MAX_TEAM) {
    return err(errors.validation("How many are you?", { teamSize: "invalid" }));
  }

  const locale: EmailLocale = input.locale === "ar" ? "ar" : "en";

  // Computed once and reused by the audit log, so the bucket a request was
  // counted against and the line describing it carry the SAME pseudonym. Null
  // when no address reached us at all, which is distinguishable from having one.
  const originHash = input.ip.ip ? hashIp(input.ip.ip, env().IP_HASH_SALT) : null;

  // --- The self-keyed limit, charged first ----------------------------------
  if (originHash) {
    const byOrigin = await checkRateLimits([
      {
        scope: "startup:apply",
        identity: originHash,
        limit: PER_ORIGIN_LIMIT,
        windowSeconds: ORIGIN_WINDOW_SECONDS,
      },
    ]);
    if (!byOrigin.ok) return err(byOrigin.error);
    if (!byOrigin.value.allowed) {
      log.warn("startup_application.rate_limited", {
        scope: "startup:apply",
        originHash,
        originAttested: input.ip.attested,
      });
      return err(rateLimitedError(byOrigin.value));
    }
  }

  // --- Idempotency ----------------------------------------------------------
  const begin = await beginIdempotent({
    scope: IDEMPOTENCY_SCOPE,
    key: input.idempotencyKey,
    request: { email, startupName, pitch },
  });
  if (!begin.ok) return err(begin.error);

  if (begin.value.kind === "replay") {
    const replayed = begin.value.body as Partial<SubmittedApplication> | null;
    if (replayed && typeof replayed.reference === "string") {
      log.info("startup_application.replayed", { reference: replayed.reference });
      return ok({ reference: replayed.reference });
    }
    // A stored row we do not recognise. Refusing beats handing back a
    // confirmation screen built from an unchecked cast.
    return err(errors.conflict("Please start that application again."));
  }

  // --- The resource-keyed limit, charged late -------------------------------
  //
  // 🔴 Position is the mitigation, exactly as in `services/booking.ts`. Charged
  // beside the origin bucket, five malformed requests naming a stranger's
  // address would burn that person's daily allowance and lock them out of
  // applying, because the counter increments before it decides. By here the
  // request is well-formed and is not a replay, so charging the address it names
  // is charging a genuine attempt.
  const emailBucket = hashIdentifier(email, env().IP_HASH_SALT, "email");
  const byEmail = await checkRateLimits([
    {
      scope: "startup:apply:email",
      identity: emailBucket,
      limit: PER_EMAIL_LIMIT,
      windowSeconds: EMAIL_WINDOW_SECONDS,
    },
  ]);
  if (!byEmail.ok) {
    await abandonIdempotent({ scope: IDEMPOTENCY_SCOPE, key: input.idempotencyKey });
    return err(byEmail.error);
  }
  if (!byEmail.value.allowed) {
    // Released, not held: nothing was written, so a retry after the window must
    // be able to reuse the same key rather than meeting a permanently claimed one.
    await abandonIdempotent({ scope: IDEMPOTENCY_SCOPE, key: input.idempotencyKey });
    log.warn("startup_application.rate_limited", {
      scope: "startup:apply:email",
      originHash,
      originAttested: input.ip.attested,
      submitterHash: emailBucket,
    });
    return err(rateLimitedError(byEmail.value));
  }

  // --- Write ----------------------------------------------------------------
  const inserted = await insertWithFreshReference({
    founder_name: founderName,
    startup_name: startupName,
    email,
    phone_e164: phone,
    pitch,
    stage,
    team_size: teamSize,
    space,
    locale,
    ip_hash: originHash,
  });

  if (!inserted.ok) {
    await abandonIdempotent({ scope: IDEMPOTENCY_SCOPE, key: input.idempotencyKey });
    return inserted;
  }

  const row = inserted.value;

  await completeIdempotent({
    scope: IDEMPOTENCY_SCOPE,
    key: input.idempotencyKey,
    status: 201,
    body: { reference: row.reference } satisfies SubmittedApplication,
  });

  log.info("startup_application.received", {
    reference: row.reference,
    stage,
    space,
    teamSize,
    locale,
    originHash,
    originAttested: input.ip.attested,
    submitterHash: emailBucket,
  });

  // --- Tell people ----------------------------------------------------------
  //
  // 🔴 AFTER the write, and never allowed to fail it. The application is safely
  // recorded by this point; a mail outage must not turn a founder's successful
  // submission into an error screen that makes them submit again. Failures are
  // logged loudly (this is the owner's only alert that somebody is waiting) but
  // they do not change what this function returns.
  await announceNewApplication(row);

  return ok({ reference: row.reference });
}

/**
 * Inserts, re-rolling the reference if it collides.
 *
 * 32^6 makes a collision vanishingly unlikely, and "vanishingly unlikely" is not
 * "impossible": at a collision the insert must not surface to a founder as a
 * failed application. The retry is cheap and bounded.
 *
 * The OTHER unique violation this can hit is the real one:
 * `one_pending_per_email` fires when somebody already has an unanswered
 * application, and that is a distinct answer, not something to retry.
 */
async function insertWithFreshReference(
  values: Omit<
    Database["public"]["Tables"]["startup_applications"]["Insert"],
    "reference"
  >
): Promise<Result<StartupApplicationRow, AppError>> {
  for (let attempt = 0; attempt < COLLISION_RETRIES; attempt += 1) {
    const { data, error } = await supabaseAdmin()
      .from("startup_applications")
      .insert({ ...values, reference: generateReference() })
      .select()
      .single();

    if (!error && data) return ok(data);

    if (isUniqueViolation(error, "one_pending_per_email")) {
      // Deliberately NOT phrased as a failure. From the founder's side this is
      // good news: the thing they were worried about already happened.
      return err(
        errors.conflict("You already have an application with us.", {
          fields: { email: "pending" },
        })
      );
    }

    if (isUniqueViolation(error, "reference")) continue;

    return err(
      errors.upstreamUnavailable(
        `startup application insert failed: ${error?.message ?? "no row returned"}`,
        { cause: error }
      )
    );
  }

  return err(errors.internal("Could not allocate an application reference."));
}

/**
 * The receipt to the applicant and the alert to MAZJ.
 *
 * Both best effort, both logged. Neither is allowed to throw: this runs after a
 * committed database write, and an exception escaping here would surface to the
 * founder as a failed application that actually succeeded, which is the single
 * worst outcome available on this path.
 */
async function announceNewApplication(row: StartupApplicationRow): Promise<void> {
  const config = emailConfig();
  if (!config.ok) {
    // Loud, and NOT a silent no-op. Somebody is now waiting for a reply nobody
    // has been told to write.
    log.error("startup_application.alert_not_configured", {
      reference: row.reference,
      reason: config.error.message,
    });
    return;
  }

  const locale: EmailLocale = row.locale === "ar" ? "ar" : "en";

  const receipt = renderReceivedEmail({
    locale,
    siteOrigin: config.value.siteOrigin,
    founderName: row.founder_name,
    reference: row.reference,
  });

  const alert = config.value.alertTo
    ? renderAlertEmail({
        siteOrigin: config.value.siteOrigin,
        id: row.id,
        reference: row.reference,
        founderName: row.founder_name,
        startupName: row.startup_name,
        email: row.email,
        phone: row.phone_e164,
        stage: row.stage,
        teamSize: row.team_size,
        space: row.space,
        locale,
        pitch: row.pitch,
      })
    : null;

  // Sent together: they go to different people and neither should wait on the
  // other's round trip while a founder watches a spinner.
  const [receiptResult, alertResult] = await Promise.all([
    sendEmail({ ...receipt, to: row.email }, config.value),
    alert
      ? sendEmail({ ...alert, to: config.value.alertTo! }, config.value)
      : Promise.resolve(
          err(errors.internal("EMAIL_ALERT_TO is not set, so nobody was alerted."))
        ),
  ]);

  if (!receiptResult.ok) {
    log.error("startup_application.receipt_failed", {
      reference: row.reference,
      reason: receiptResult.error.message,
    });
  }
  if (!alertResult.ok) {
    log.error("startup_application.alert_failed", {
      reference: row.reference,
      reason: alertResult.error.message,
    });
  }
}

// ---------------------------------------------------------------------------
// Reading, for the admin
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listStartupApplications(): Promise<
  Result<StartupApplicationRow[], AppError>
> {
  const { data, error } = await supabaseAdmin()
    .from("startup_applications")
    // Pending first, then newest. Sorting by status text happens to put
    // approved < pending < rejected alphabetically, which is not the order
    // anyone wants, so the queue is ordered explicitly by the service instead.
    .select()
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return err(
      errors.upstreamUnavailable(`could not list applications: ${error.message}`, {
        cause: error,
      })
    );
  }

  const rows = data ?? [];
  const rank = (r: StartupApplicationRow) => (r.status === "pending" ? 0 : 1);
  return ok([...rows].sort((a, b) => rank(a) - rank(b)));
}

export async function getStartupApplication(
  id: string
): Promise<Result<StartupApplicationRow, AppError>> {
  // 🔴 Shape-checked before it reaches Postgres. A malformed uuid is error
  // 22P02, which the db layer maps to `upstream_unavailable`, i.e. a 503 that
  // reads as "our database is broken" when someone simply edited the URL.
  if (!UUID.test(id)) return err(errors.notFound("No such application."));

  const { data, error } = await supabaseAdmin()
    .from("startup_applications")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return err(
      errors.upstreamUnavailable(`could not load application: ${error.message}`, {
        cause: error,
      })
    );
  }
  if (!data) return err(errors.notFound("No such application."));
  return ok(data);
}

// ---------------------------------------------------------------------------
// Deciding
// ---------------------------------------------------------------------------

export type DecisionInput = {
  id: string;
  decision: "approved" | "rejected";
  /** Required for a rejection. This is what the founder reads, verbatim. */
  note: string;
  /** The signed-in admin's address. Authorisation happens in the action. */
  adminEmail: string;
};

export type DecisionOutcome = {
  status: "approved" | "rejected";
  reference: string;
  code: string | null;
  /** Whether the applicant was actually told. Never assumed. */
  delivered: boolean;
  /** Why not, when not. Shown to the admin, never to the applicant. */
  deliveryFailure: string | null;
};

export async function decideStartupApplication(
  input: DecisionInput
): Promise<Result<DecisionOutcome, AppError>> {
  if (!UUID.test(input.id)) return err(errors.notFound("No such application."));

  // 🔴 The rejection reason is validated HERE and again by a check constraint.
  // "If we rejected them, explain why" was the owner's requirement, and a
  // rejection whose reason is "no" satisfies the letter of it and none of the
  // point. Ten characters is the floor the database also enforces.
  const note = cleanMultilineText(input.note ?? "", MAX_NOTE);
  if (input.decision === "rejected" && note.length < MIN_NOTE) {
    return err(
      errors.validation("Give them a reason worth reading.", { note: "too_short" })
    );
  }

  const decidedAt = new Date();
  const approving = input.decision === "approved";

  // Approvals re-roll on a code collision; rejections have nothing to collide.
  for (let attempt = 0; attempt < COLLISION_RETRIES; attempt += 1) {
    const expiry = approving ? offerCodeExpiry(decidedAt) : null;

    const { data, error } = await supabaseAdmin()
      .from("startup_applications")
      .update({
        status: input.decision,
        decided_at: decidedAt.toISOString(),
        decided_by: input.adminEmail,
        // Stored on an approval too, when the admin left a note. Harmless, and
        // occasionally the only record of why an unusual one was let through.
        decision_note: note.length > 0 ? note : null,
        code: approving ? generateOfferCode() : null,
        code_expires_at: expiry ? expiry.toISOString() : null,
        // Cleared, so a resend after a fixed configuration does not keep
        // showing yesterday's failure beside a message that has now gone.
        decision_email_sent_at: null,
        decision_email_error: null,
      })
      .eq("id", input.id)
      // 🔴 THE CONCURRENCY CONTROL, and the reason this is not a read-then-write.
      // Two admins with the queue open both press Approve: without this predicate
      // the second update silently overwrites the first, issuing a second code
      // and invalidating one that has already been emailed. With it, the second
      // update matches zero rows and is told the truth.
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (error) {
      if (isUniqueViolation(error, "code")) continue;
      return err(
        errors.upstreamUnavailable(`could not record the decision: ${error.message}`, {
          cause: error,
        })
      );
    }

    if (!data) {
      // Either no such application, or somebody already decided it.
      const existing = await getStartupApplication(input.id);
      return err(
        existing.ok
          ? errors.conflict(
              `That application was already ${existing.value.status}.`
            )
          : errors.notFound("No such application.")
      );
    }

    log.info("startup_application.decided", {
      reference: data.reference,
      decision: input.decision,
      // 🔴 Hashed, and NOT named `decidedByEmail`. Two reasons, and both have
      // bitten this repo already. The logger redacts any key CONTAINING
      // "email", so that name would write "[redacted]" and this line would
      // record nothing at all. And an admin's address is still personal data,
      // so the pseudonym is the right value regardless of the field name: two
      // decisions by the same person stay joinable without a log store holding
      // a staff list.
      deciderHash: hashIdentifier(input.adminEmail, env().IP_HASH_SALT, "admin"),
    });

    // 🔴 THE DECISION IS NOW COMMITTED. Everything below is delivery, and
    // delivery is never allowed to undo it. If Resend is down, the domain is
    // unverified, or the key is missing, the approval still stands, the code is
    // still in the row, and the admin screen renders a resend control beside the
    // reason it failed. The alternative (rolling back, or reporting failure) is
    // how an owner ends up pressing Approve twice and issuing two codes.
    const delivery = await deliverDecision(data);

    return ok({
      status: input.decision,
      reference: data.reference,
      code: data.code,
      delivered: delivery.ok,
      deliveryFailure: delivery.ok ? null : delivery.error.message,
    });
  }

  return err(errors.internal("Could not allocate an offer code."));
}

/** Re-attempts the decision email for an application already decided. */
export async function resendDecisionEmail(
  id: string
): Promise<Result<{ delivered: boolean; deliveryFailure: string | null }, AppError>> {
  const found = await getStartupApplication(id);
  if (!found.ok) return found;
  if (found.value.status === "pending") {
    return err(errors.conflict("That application has not been decided yet."));
  }

  const delivery = await deliverDecision(found.value);
  return ok({
    delivered: delivery.ok,
    deliveryFailure: delivery.ok ? null : delivery.error.message,
  });
}

/**
 * Sends the decision email and records what happened, on the row.
 *
 * The recording is the point. Without it, "was this founder ever actually told?"
 * is a question with no answer anywhere, and the failure mode is silent by
 * construction: the owner clicked Approve, saw the row turn green, and moved on.
 */
async function deliverDecision(
  row: StartupApplicationRow
): Promise<Result<void, AppError>> {
  const config = emailConfig();
  const locale: EmailLocale = row.locale === "ar" ? "ar" : "en";

  const outcome: Result<{ id: string }, AppError> = !config.ok
    ? err(config.error)
    : row.status === "approved"
      ? row.code && row.code_expires_at
        ? await sendEmail(
            {
              ...renderApprovedEmail({
                locale,
                siteOrigin: config.value.siteOrigin,
                startupName: row.startup_name,
                code: row.code,
                expiresAt: row.code_expires_at,
              }),
              to: row.email,
            },
            config.value
          )
        : err(errors.internal("Approved with no code. Refusing to send an empty offer."))
      : row.decision_note
        ? await sendEmail(
            {
              ...renderRejectedEmail({
                locale,
                siteOrigin: config.value.siteOrigin,
                founderName: row.founder_name,
                startupName: row.startup_name,
                reason: row.decision_note,
              }),
              to: row.email,
            },
            config.value
          )
        : err(errors.internal("Rejected with no reason. Refusing to send a bare no."));

  // Best effort, and deliberately not allowed to change the reported outcome: a
  // message that DID send must never be reported as failed because the
  // bookkeeping afterwards did not.
  const { error } = await supabaseAdmin()
    .from("startup_applications")
    .update(
      outcome.ok
        ? { decision_email_sent_at: new Date().toISOString(), decision_email_error: null }
        : {
            decision_email_sent_at: null,
            // Bounded to the column width. The full detail is already in the log
            // with a provider status beside it.
            decision_email_error: outcome.error.message.slice(0, 500),
          }
    )
    .eq("id", row.id);

  if (error) {
    log.error("startup_application.delivery_record_failed", {
      reference: row.reference,
      reason: error.message,
    });
  }

  if (!outcome.ok) {
    log.error("startup_application.delivery_failed", {
      reference: row.reference,
      reason: outcome.error.message,
    });
    return err(outcome.error);
  }

  log.info("startup_application.delivered", { reference: row.reference });
  return ok();
}

/**
 * Records that the team honoured a code.
 *
 * 🔴 The only place redemption can ever be recorded, because no software
 * consumes this code: Rekaz has no coupon API, so a person applies the offer in
 * the room and a person marks it here. Without this the owner can say how many
 * codes were issued and nothing at all about how many were used, which is the
 * only number that says whether the offer works.
 */
export async function markCodeRedeemed(
  id: string,
  adminEmail: string
): Promise<Result<void, AppError>> {
  if (!UUID.test(id)) return err(errors.notFound("No such application."));

  const { data, error } = await supabaseAdmin()
    .from("startup_applications")
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by: adminEmail,
    })
    .eq("id", id)
    .eq("status", "approved")
    // Same conditional-update discipline: marking an already-redeemed code
    // again would overwrite the date it was actually used.
    .is("redeemed_at", null)
    .select()
    .maybeSingle();

  if (error) {
    return err(
      errors.upstreamUnavailable(`could not mark redeemed: ${error.message}`, {
        cause: error,
      })
    );
  }
  if (!data) {
    return err(errors.conflict("That code is not approved, or is already marked used."));
  }

  log.info("startup_application.redeemed", { reference: data.reference });
  return ok();
}

/**
 * Whether a Postgres error is a unique violation on a named constraint.
 *
 * Matching on the constraint NAME rather than merely on `23505`: this table has
 * three unique constraints and they mean completely different things. A
 * reference collision is a re-roll, a pending-email collision is a message to
 * the founder, and treating either as the other is a bug that only appears in
 * production.
 */
function isUniqueViolation(
  error: { code?: string; message?: string } | null,
  needle: string
): boolean {
  return (
    error?.code === "23505" && (error.message ?? "").includes(needle)
  );
}
