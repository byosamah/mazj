import "server-only";

import { insertLead } from "../db/leads";
import { normalizeLead } from "../domain/leads";
import { env } from "../env";
import { errors, type AppError } from "../core/errors";
import { hashIp } from "../core/hash";
import {
  abandonIdempotent,
  beginIdempotent,
  completeIdempotent,
} from "../core/idempotency";
import { log } from "../core/logger";
import { checkRateLimit, rateLimitedError } from "../core/rate-limit";
import { clientIp, idempotencyKey } from "../core/request";
import { err, ok, type Result } from "../core/result";
import { createLeadSchema, fieldErrors } from "../validation/leads";

/**
 * Creating a lead, end to end.
 *
 * This is the proving slice for the whole backend: it exercises validation,
 * rate limiting, idempotency, domain normalisation, the privileged client and
 * error mapping in one path. If this works, the plumbing works.
 *
 * Order of operations is not arbitrary:
 *
 *   1. Rate limit FIRST, before parsing. Parsing untrusted JSON costs CPU, and
 *      an endpoint that validates before limiting can be exhausted by garbage
 *      that was never going to be accepted anyway.
 *   2. Then shape validation, so we have a fingerprint-able body.
 *   3. Then idempotency, which needs that body to detect key reuse.
 *   4. Then domain rules, then the write.
 */

const SCOPE = "leads:create";

/** Twenty a minute per client: generous for a human, useless for a script. */
const RATE_LIMIT = { limit: 20, windowSeconds: 60 } as const;

export type CreateLeadResult = {
  id: string;
  createdAt: string;
  /** True when this response was replayed from a previous identical request. */
  replayed: boolean;
};

export async function createLead(
  rawBody: unknown,
  headers: Headers
): Promise<Result<CreateLeadResult, AppError>> {
  const ip = clientIp(headers);
  const ipHash = ip === "unknown" ? null : hashIp(ip, env().IP_HASH_SALT);

  // 1. Rate limit.
  const limit = await checkRateLimit({
    scope: SCOPE,
    identity: ipHash ?? "unknown",
    ...RATE_LIMIT,
  });
  if (!limit.ok) return err(limit.error);
  if (!limit.value.allowed) {
    log.warn("lead.rate_limited", { scope: SCOPE });
    return err(rateLimitedError(limit.value));
  }

  // 2. Shape.
  const parsed = createLeadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return err(
      errors.validation(
        "Some of those details need another look.",
        fieldErrors(parsed.error)
      )
    );
  }

  // 3. Idempotency, if the caller opted in by sending a key.
  const key = idempotencyKey(headers);
  if (key) {
    const begun = await beginIdempotent({
      scope: SCOPE,
      key,
      request: parsed.data,
    });
    if (!begun.ok) return err(begun.error);

    if (begun.value.kind === "replay") {
      const body = begun.value.body as CreateLeadResult | null;
      if (body?.id) {
        log.info("lead.replayed", { scope: SCOPE });
        return ok({ ...body, replayed: true });
      }
      // A completed row with an unusable body should never happen; the check
      // constraint requires one. Treat it as a conflict rather than guessing.
      return err(
        errors.conflict("That request completed but its result is unavailable.")
      );
    }
  }

  // 4. Domain rules.
  const normalized = normalizeLead(parsed.data, new Date());
  if (!normalized.ok) {
    if (key) await abandonIdempotent({ scope: SCOPE, key });
    return err(
      errors.validation("Some of those details need another look.", {
        [normalized.error.field]: normalized.error.message,
      })
    );
  }

  // 5. Write.
  const stored = await insertLead(normalized.value, { ipHash });
  if (!stored.ok) {
    if (key) await abandonIdempotent({ scope: SCOPE, key });
    log.error("lead.insert_failed", {
      code: stored.error.code,
      reason: stored.error.message,
    });
    return err(stored.error);
  }

  const result: CreateLeadResult = {
    id: stored.value.id,
    createdAt: stored.value.createdAt,
    replayed: false,
  };

  if (key) {
    const completed = await completeIdempotent({
      scope: SCOPE,
      key,
      status: 201,
      body: result,
    });
    // The lead is already saved. Failing to record the response only costs us
    // replay protection on a retry, which is not worth discarding a real lead.
    if (!completed.ok) {
      log.warn("lead.idempotency_not_recorded", {
        reason: completed.error.message,
      });
    }
  }

  // No personal data in this line. `interest` and `locale` are categories, not
  // identifiers, and the logger would redact the rest regardless.
  log.info("lead.created", {
    interest: normalized.value.interest,
    locale: normalized.value.locale,
    source: normalized.value.source,
  });

  return ok(result);
}
