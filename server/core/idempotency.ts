import "server-only";

import { supabaseAdmin } from "../supabase/admin";
import { errors, fromUnknown, type AppError } from "./errors";
import { fingerprint } from "./hash";
import { err, ok, type Result } from "./result";

/**
 * Idempotency keys.
 *
 * Rekaz's public API has none (docs/rekaz-api-review-ar.md section 4.4), so a
 * double-tapped button or an automatic retry after a dropped connection can
 * create two of whatever was being created. We own that problem for our own
 * endpoints, and this is the primitive the Rekaz booking calls will reuse.
 *
 * The protocol, which is the one Stripe uses:
 *
 *   begin()      -> "proceed"  the key is new; do the work
 *                -> "replay"   the key completed before; return the stored response
 *                -> conflict   the key is mid-flight in another request
 *                -> reused     the key was used with a different body
 *   complete()   -> store the response so a future replay can return it
 *   abandon()    -> the work failed; release the key so a retry can proceed
 *
 * Rejecting a reused key rather than quietly returning the first response is
 * deliberate. Returning the wrong resource because two different requests
 * shared a key is a data-integrity bug that surfaces days later; an error
 * surfaces immediately.
 */

export type BeginOutcome =
  | { kind: "proceed" }
  | { kind: "replay"; status: number; body: unknown };

export type BeginOptions = {
  /** Endpoint identity, e.g. `leads:create`. */
  scope: string;
  /** The client-supplied key. */
  key: string;
  /** The parsed request body, fingerprinted to detect key reuse. */
  request: unknown;
};

/**
 * How long an `in_progress` row may sit before another request may take it
 * over.
 *
 * 🔴 This value is what stops a key wedging forever. Without it, a request that
 * died between claiming a key and finishing (a serverless timeout, an OOM kill,
 * a redeploy mid-flight, or a transient database fault that defeats both the
 * insert and the cleanup delete that follows) left a row nothing would ever
 * remove, and every future retry with that key answered 409 for all time. The
 * client behaviour that triggers it is the correct one: retrying with the same
 * key, which is the entire point of having one.
 *
 * 90 seconds is comfortably longer than any request this service makes could
 * legitimately take, and short enough that a human retrying by hand is not
 * blocked.
 */
const STALE_AFTER_SECONDS = 90;

export async function beginIdempotent(
  options: BeginOptions
): Promise<Result<BeginOutcome, AppError>> {
  const { scope, key, request } = options;

  try {
    // One round trip, one atomic decision. See the migration for why this is a
    // database function rather than insert-then-read here: the two-statement
    // version could interleave, and had no way to reclaim a stranded row.
    const { data, error } = await supabaseAdmin().rpc("idempotency_begin", {
      p_scope: scope,
      p_key: key,
      p_fingerprint: fingerprint(request),
      p_stale_after_seconds: STALE_AFTER_SECONDS,
    });

    if (error) {
      return err(
        errors.upstreamUnavailable(
          `idempotency_begin failed: ${error.message}`,
          { cause: error }
        )
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return err(
        errors.upstreamUnavailable("idempotency_begin returned no row")
      );
    }

    switch (row.outcome) {
      case "proceed":
        return ok({ kind: "proceed" });

      case "replay":
        return ok({
          kind: "replay",
          status: row.response_status ?? 200,
          body: row.response_body,
        });

      case "fingerprint_mismatch":
        return err(
          errors.idempotencyKeyReused(
            "This idempotency key was already used for a different request."
          )
        );

      case "in_flight":
        return err(
          errors.conflict(
            "An identical request is already being processed. Please wait."
          )
        );

      case "retry":
        // Raced a cleanup sweep. Safe and correct to send the same request again.
        return err(
          errors.conflict("That request raced a cleanup. Please try again.")
        );

      default:
        return err(
          errors.internal(
            `idempotency_begin returned an unknown outcome: ${String(row.outcome)}`
          )
        );
    }
  } catch (cause) {
    return err(fromUnknown(cause, "idempotency begin"));
  }
}

export async function completeIdempotent(options: {
  scope: string;
  key: string;
  status: number;
  body: unknown;
}): Promise<Result<void, AppError>> {
  try {
    const { error } = await supabaseAdmin()
      .from("idempotency_keys")
      .update({
        status: "completed",
        response_status: options.status,
        response_body: options.body as never,
        completed_at: new Date().toISOString(),
      })
      .eq("scope", options.scope)
      .eq("idempotency_key", options.key);

    if (error) {
      return err(
        errors.upstreamUnavailable(
          `idempotency complete failed: ${error.message}`,
          { cause: error }
        )
      );
    }
    return ok();
  } catch (cause) {
    return err(fromUnknown(cause, "idempotency complete"));
  }
}

/**
 * Releases a key after failed work, so the client can retry with the same key.
 *
 * Without this an in_progress row would linger and every retry would be told
 * "already being processed" forever, turning one transient failure into a
 * permanently wedged key.
 */
export async function abandonIdempotent(options: {
  scope: string;
  key: string;
}): Promise<void> {
  try {
    await supabaseAdmin()
      .from("idempotency_keys")
      .delete()
      .eq("scope", options.scope)
      .eq("idempotency_key", options.key)
      .eq("status", "in_progress");
  } catch {
    // Best effort. The caller is already reporting a failure and a wedged key
    // is a smaller problem than masking the original error with this one.
  }
}
