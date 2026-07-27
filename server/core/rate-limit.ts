import "server-only";

import { supabaseAdmin } from "../supabase/admin";
import { errors, fromUnknown, type AppError } from "./errors";
import { err, ok, type Result } from "./result";

/**
 * Rate limiting, backed by Postgres.
 *
 * The counter lives in the database rather than in process memory because this
 * application runs on serverless functions. Each warm instance has its own
 * heap, so an in-memory counter limits each instance independently and the real
 * ceiling becomes (limit x instance count), which under the traffic spike you
 * were defending against is no ceiling at all.
 *
 * The atomicity that makes it correct lives in `public.rate_limit_hit`; see the
 * comments in the migration for why it is one statement rather than a read
 * followed by a write.
 */

export type RateLimitState = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export type RateLimitOptions = {
  /** Groups counters by endpoint, e.g. `leads:create`. */
  scope: string;
  /** Who is being limited. Always an already-hashed value, never a raw IP. */
  identity: string;
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/**
 * Records a request against a bucket and reports whether it may proceed.
 *
 * 🔴 Fails CLOSED. If the database is unreachable this returns an error rather
 * than allowing the request through. A rate limiter that opens under load is
 * decorative: the exact moment the database struggles is the exact moment an
 * abusive client is most able to hurt you, so "the limiter is down, let
 * everyone in" is precisely backwards.
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<Result<RateLimitState, AppError>> {
  const { scope, identity, limit, windowSeconds } = options;

  try {
    const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
      p_bucket: `${scope}:${identity}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      return err(
        errors.upstreamUnavailable(`rate_limit_hit failed: ${error.message}`, {
          cause: error,
        })
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return err(errors.upstreamUnavailable("rate_limit_hit returned no row"));
    }

    const resetAt = new Date(row.reset_at);
    const retryAfterSeconds = Math.max(
      0,
      Math.ceil((resetAt.getTime() - Date.now()) / 1000)
    );

    return ok({
      allowed: row.allowed,
      remaining: row.remaining,
      resetAt,
      retryAfterSeconds,
    });
  } catch (cause) {
    return err(fromUnknown(cause, "rate limit check"));
  }
}

/** Convenience: the `AppError` to return when a limit has been exceeded. */
export function rateLimitedError(state: RateLimitState): AppError {
  return errors.rateLimited(
    "Too many requests. Please wait a moment and try again.",
    state.retryAfterSeconds
  );
}
