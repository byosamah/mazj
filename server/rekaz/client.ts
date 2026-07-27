import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { log } from "../core/logger";
import { err, ok, type Result } from "../core/result";
import { env } from "../env";

/**
 * The only place in this codebase that speaks HTTP to Rekaz.
 *
 * Everything else calls a typed function in a sibling module. That is worth the
 * indirection for one reason: the credential. Rekaz issues a single
 * **admin-scope** key, and `GET /customers` with it returns the entire customer
 * list. It has the same blast radius as `SUPABASE_SECRET_KEY` and gets the same
 * handling: `server-only`, never `NEXT_PUBLIC_`, never logged, never in an error
 * that reaches a client.
 *
 * Returns `Result`, never throws. A booking flow that dies on an upstream
 * timeout because someone forgot a try/catch is a lost sale.
 *
 * Behaviour verified against the live API on 2026-07-27. The surprises are
 * documented in `docs/rekaz-api-findings.md`; the ones this file exists to
 * absorb are noted inline.
 */

/**
 * 🔴 An explicit User-Agent is mandatory, not cosmetic.
 *
 * The live API returns **403 Forbidden** to clients whose agent it does not
 * recognise. Measured: `Python-urllib/3.12` is refused outright while `curl`,
 * `node` and browser strings pass. There is a filter in front of the API that
 * Rekaz does not document.
 *
 * Node's `fetch` currently sends `node` and happens to pass. Relying on that is
 * relying on an undocumented default of a runtime we upgrade regularly, and the
 * failure mode is a 403 that reads exactly like an expired credential. Sending
 * our own string also means Rekaz support can find us in their logs.
 */
const USER_AGENT = "MAZJ-Site/1.0 (+https://mazj.sa)";

/**
 * Rekaz has published no rate limits, though `RateLimit` appears in their error
 * list. Ten seconds is long enough for their slowest observed response (~1.4s
 * on `/otp`-class calls) with a wide margin, and short enough that a hung
 * upstream does not hold a serverless function open until the platform kills it.
 */
const TIMEOUT_MS = 10_000;

type RequestOptions = {
  /** Path below `/api/public`, e.g. `/reservations/slots`. Must start with `/`. */
  path: string;
  method?: "GET" | "POST" | "PUT";
  /** Appended as a query string. `undefined` values are dropped, not sent as "undefined". */
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

/**
 * Performs one Rekaz request and returns the parsed body.
 *
 * The caller supplies `T`. That is an unchecked assertion, deliberately: Rekaz
 * offers no schema to validate against, and a hand-written runtime validator
 * over 30-odd fields would be a second source of truth that rots separately
 * from the first. The integration tests are where the shape is actually
 * checked.
 */
export async function rekazRequest<T>(
  options: RequestOptions
): Promise<Result<T, AppError>> {
  const { REKAZ_API_BASE, REKAZ_AUTH_BASIC, REKAZ_TENANT_ID } = env();
  const { path, method = "GET", query, body } = options;

  const url = new URL(`${REKAZ_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${REKAZ_AUTH_BASIC}`,
        // 🔴 TWO underscores. The Quick Start page documents `_tenant`, which
        // does not work. Verified against the live API.
        __tenant: REKAZ_TENANT_ID,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Rekaz is the system of record and its answers change without warning.
      // Next would otherwise cache this fetch and serve a stale availability
      // grid, which is worse than a slow one.
      cache: "no-store",
    });
  } catch (cause) {
    // AbortSignal.timeout rejects with a TimeoutError; a DNS or TLS failure
    // rejects with a TypeError. Both are "Rekaz is not answering right now",
    // which is retryable, so neither is an `internal`.
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return err(
      errors.upstreamUnavailable(
        timedOut
          ? `Rekaz did not respond within ${TIMEOUT_MS}ms: ${method} ${path}`
          : `Rekaz request failed: ${method} ${path}`,
        { cause }
      )
    );
  }

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    return err(mapErrorResponse(response.status, text, method, path));
  }

  // 204 and an empty body are legitimate on the PUT endpoints.
  if (text.trim() === "") return ok(undefined as T);

  try {
    return ok(JSON.parse(text) as T);
  } catch (cause) {
    return err(
      fromUnknown(cause, `Rekaz returned unparseable JSON: ${method} ${path}`)
    );
  }
}

/**
 * Turns a Rekaz failure into one of our error codes.
 *
 * 🔴 The Rekaz message never reaches the caller. Two reasons. It arrives in
 * **Arabic** regardless of `Accept-Language`, so surfacing it would print Arabic
 * on an English page. And it names internal field names (`PriceId`,
 * `MinQuantity`), which is upstream implementation detail we should not be
 * teaching the public. The detail goes to the log; the caller gets a code and
 * renders its own copy from `messages/*.json`.
 */
function mapErrorResponse(
  status: number,
  text: string,
  method: string,
  path: string
): AppError {
  const context = `Rekaz ${status} on ${method} ${path}`;
  const detail = summarise(text);

  log.error("rekaz.request_failed", {
    status,
    method,
    path,
    detail,
    traceId: extractTraceId(text),
  });

  switch (status) {
    case 400:
    case 422:
      // Rekaz rejected our request shape. That is our bug, not the visitor's,
      // so it must not surface as "check your input": a visitor cannot fix
      // a missing MinQuantity parameter.
      return errors.internal(`${context}: ${detail}`);
    case 401:
      return errors.internal(`${context}: Rekaz credentials rejected`);
    case 403:
      // 🔴 Most likely a User-Agent rejection rather than a permissions
      // problem. Reading this as "our key lost access" sends you to the Rekaz
      // dashboard for an hour looking at a key that is fine.
      return errors.internal(
        `${context}: forbidden. Check the User-Agent header before the credential`
      );
    case 404:
      return errors.notFound(`${context}`);
    case 429:
      // Rekaz documents no rate limits and no Retry-After. 60s is a guess, and
      // labelled as one.
      return errors.rateLimited("Rekaz is rate limiting us.", 60);
    default:
      return status >= 500
        ? errors.upstreamUnavailable(`${context}: ${detail}`)
        : errors.internal(`${context}: ${detail}`);
  }
}

/** Truncates an upstream body for the log. Never returned to a client. */
function summarise(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 300)}...` : collapsed;
}

/**
 * Rekaz's ProblemDetails responses carry a `traceId`. It is the first thing
 * their support will ask for, so it is worth pulling out of the body and into a
 * structured log field rather than leaving it buried in a truncated string.
 */
function extractTraceId(text: string): string | undefined {
  const match = /"traceId"\s*:\s*"([^"]+)"/.exec(text);
  return match?.[1];
}
