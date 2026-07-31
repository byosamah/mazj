import "server-only";

import { errors, fromUnknown, type AppError } from "../core/errors";
import { log, redact, scrubValue } from "../core/logger";
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
  /**
   * Overrides `TIMEOUT_MS` for this one call.
   *
   * ⚠️ `/products` is measured between 1.2s and **10.8s** on this tenant, so the
   * uniform 10s cut-off aborts the endpoint the booking flow has to call FIRST,
   * and then reports our own limit as `upstream_unavailable`: our bug wearing
   * Rekaz's name, on the path that takes money.
   *
   * Per-request rather than simply a bigger global value, because the reason the
   * global is short is also real: a hung upstream must not hold a serverless
   * function open until the platform kills it. One slow endpoint is not a reason
   * to be patient with all of them.
   */
  timeoutMs?: number;
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
  const { path, method = "GET", query, body, timeoutMs = TIMEOUT_MS } = options;

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
        // Rekaz honours this for most error strings (not all: see
        // `mapErrorResponse`). English keeps the server log readable by whoever
        // is on call. The raw string never reaches a user either way; at most a
        // scrubbed, truncated form of it does, on the one branch
        // `mapErrorResponse` names.
        "Accept-Language": "en",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
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
          ? `Rekaz did not respond within ${timeoutMs}ms: ${method} ${path}`
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
    // 🔴 `upstream_unavailable`, NOT `internal`, and the distinction is
    // load-bearing on the booking path.
    //
    // This branch only runs on a 2xx, which means Rekaz ACCEPTED the request. On
    // a POST that is a booking and an invoice that now exist; we simply cannot
    // read the confirmation. `server/services/booking.ts` treats
    // `upstream_unavailable` as "dispatched, no definitive answer" and refuses to
    // release the idempotency key, which is the correct handling here. Calling it
    // `internal` would release the key and let a retry create a duplicate.
    return err(
      errors.upstreamUnavailable(
        `Rekaz returned unparseable JSON on a ${response.status}: ${method} ${path}`,
        { cause }
      )
    );
  }
}

/**
 * Parses an upstream body far enough for `redact` to work on its KEYS.
 *
 * A ProblemDetails body is an object, and redaction operates on object keys, so
 * a raw string would sail straight through the denylist. Anything that is not
 * JSON is reported as a type rather than as content: an unparseable body from a
 * failing upstream is exactly the case where the content is least trustworthy
 * and least useful.
 */
function safeParse(text: string): unknown {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? parsed : "[non-object body]";
  } catch {
    return "[unparseable body]";
  }
}

/**
 * Turns a Rekaz failure into one of our error codes.
 *
 * 🔴 The RAW Rekaz body never reaches the caller, and the reason is NOT the one
 * previously written here.
 *
 * This comment used to claim the message arrives in Arabic regardless of
 * `Accept-Language`. Measured 2026-07-28: that is false. The header IS honoured
 * for most strings; we had simply never sent it. It is sent now, so the log
 * carries English.
 *
 * The body still must not reach a user, for the reason that does hold: it names
 * internal field names (`PriceId`, `MinQuantity`) and internal entity names
 * ("There is no entity Price with id ..."), which is upstream implementation
 * detail we should not be teaching the public. Localisation is also only PARTLY
 * honoured, so "it will be in the user's language" is not a property we can rely
 * on either. The detail goes to the log; the caller gets a code and renders its
 * own copy from `messages/*.json`.
 *
 * 🔴 BE PRECISE ABOUT WHICH CODES ARE SILENT, because most of them are not.
 * `toPublicError` discards the message for `internal` and for `internal` ALONE.
 * Every other code has its message forwarded verbatim, so anything interpolated
 * into one is a string a visitor can read. That is why:
 *
 * - `upstream_unavailable` (the 5xx branch) interpolates `describeFailure`,
 *   which is a shape, field NAMES, a traceId and a scrubbed sentence, and never
 *   the raw `text`;
 * - `forbidden` (the business 403) interpolates NOTHING at all;
 * - ⚠️ `not_found` still interpolates `context`, i.e. the status, our HTTP method
 *   and the upstream path. That predates this file's redaction work and is
 *   deliberately left alone here rather than changed as a side effect. It is
 *   worth closing, and closing it belongs in a change that owns the 404 path.
 *
 * A new branch inherits none of this. Check `toPublicError` before interpolating
 * anything into a code you have not checked.
 */
function mapErrorResponse(
  status: number,
  text: string,
  method: string,
  path: string
): AppError {
  const context = `Rekaz ${status} on ${method} ${path}`;
  // 🔴 Parsed ONCE. The 403 split below, the log line and every error message
  // all read this same answer, so they cannot disagree about what came back.
  const parsed = parseRekazError(text);
  const detail = describeFailure(parsed);

  // 🔴 Deliberately NOT logged under the key `message`: that key is on the
  // redaction denylist, so the one sentence upstream actually wrote would log as
  // "[redacted]" and the legacy envelope would carry no information at all. Same
  // trick as `delivered` and `deliveryFailure` in
  // `services/startup-application.ts`.
  const upstreamTitle = parsed.message
    ? scrubValue(summarise(parsed.message))
    : undefined;

  log.error("rekaz.request_failed", {
    status,
    method,
    path,
    // 🔴 The RAW upstream body is the one thing in this codebase's whole logging
    // surface whose content is neither ours nor bounded by a schema. Rekaz runs
    // ASP.NET Core, whose model-binding errors echo the submitted value
    // verbatim: `docs/rekaz-api-findings.md` holds a real captured 400 reading
    // `"errors": {"PriceId": ["The value 'BAD' is not valid for PriceId."]}`.
    //
    // Since every booking POST now carries `customerDetails` inline (the name,
    // mobile and email the visitor typed), a validation failure on any of those
    // fields would echo them straight into the log, defeating the denylist by
    // smuggling personal data through a key that does not match it. Redacting
    // the parsed shape keeps the field NAMES, which are the useful half, and
    // drops the values. Since 2026-07-28 `redact` ALSO scrubs mobile and email
    // shapes out of the VALUES, which is the half a key denylist cannot reach.
    detail: boundedBody(text),
    // 🔴 WHICH ENVELOPE. Two are live and they mean different things. `problem`
    // is our request shape being wrong, `legacy` is Rekaz's own code refusing a
    // business rule, and `opaque` never reached Rekaz at all. Logged beside the
    // traceId so the failure families are separable in a log search.
    shape: parsed.shape,
    // Field NAMES only. The values are where the submitted data lives.
    fields: parsed.fields,
    // Null on every failure observed. Logged so the day it stops being null is a
    // fact somebody can see rather than a rumour.
    upstreamCode: parsed.code,
    upstreamTitle,
    // Cloudflare's own refusal code, present only when the edge answered.
    edgeCode: parsed.edgeCode,
    // 🔴 The first thing Rekaz support asks for. It exists only in the
    // ProblemDetails envelope, which is why reading it off a real parse rather
    // than off a regex matters.
    traceId: parsed.traceId,
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
    case 403: {
      // 🔴 TWO DIFFERENT 403s ARRIVE HERE, and they are not the same event.
      //
      // Rekaz's own code refuses a BUSINESS rule and answers with the legacy
      // JSON envelope. Booking against a mobile that already belongs to another
      // customer returns exactly that, with `code: null` and an Arabic sentence.
      // A visitor CAN act on it. Returning `internal` here without ever looking
      // at the body printed "Something went wrong on our side. Please try again"
      // on a form that then failed identically on every retry, forever.
      //
      // The EDGE in front of Rekaz refuses an unrecognised client and answers
      // with a PLAIN TEXT body, `error code: 1010`. That request never reached
      // Rekaz code, and it is ours to fix: it means the User-Agent, not the
      // credential. Reading it as "our key lost access" sends you to the Rekaz
      // dashboard for an hour looking at a key that is fine.
      //
      // ⚠️ THE SPLIT IS A HEURISTIC AND IT FAILS SAFE. The exact body of a
      // business 403 has never been captured raw; what is recorded is the Arabic
      // sentence and the envelope Rekaz documents. So the branch does not test
      // for that envelope. It tests whether the body is RECOGNISABLY one of
      // Rekaz's own JSON shapes at all, and anything else, including an empty
      // body and any future text Cloudflare invents, keeps today's behaviour:
      // `internal` plus the User-Agent hint. That is the reading that cannot
      // mislead a visitor into thinking they broke a rule nobody broke.
      if (parsed.shape === "opaque") {
        return errors.internal(
          `${context}: refused before reaching Rekaz (${detail}). ` +
            `Check the User-Agent header before the credential`
        );
      }
      // 🔴 DELIBERATELY BARE, and it must stay bare. `forbidden` is one of the
      // codes `toPublicError` passes through with its message INTACT, unlike
      // `internal`, whose message it discards. So anything interpolated here is
      // a string a visitor can read: `context` alone would publish our upstream
      // method and path, and a traceId is a correlation id we hand to Rekaz
      // support, not to the public. That is the exact leak class this repo has
      // already shipped once onto the booking form. Every diagnostic detail is
      // in the `rekaz.request_failed` line above, which is where it belongs, and
      // the copy a visitor actually sees is rendered from messages/*.json keyed
      // on the code.
      return errors.forbidden("Rekaz refused this request.");
    }
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

/**
 * Collapses whitespace and caps a string at 300 characters.
 *
 * ⚠️ No longer log-only. It now also bounds the upstream sentence that
 * `describeFailure` puts into an `AppError.message`, and that message IS
 * forwarded to a client on the `upstream_unavailable` branch. `scrubValue` is
 * applied on top at every one of those call sites; truncation is a length
 * bound, never a redaction.
 */
function summarise(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > 300 ? `${collapsed.slice(0, 300)}...` : collapsed;
}

/**
 * Which of Rekaz's two live error envelopes a body is, and what is inside it.
 *
 * 🔴 THERE ARE TWO, and this client used to parse NEITHER, branching on the HTTP
 * status alone.
 *
 * RFC 9110 **ProblemDetails**, `{type, title, status, errors, traceId}`, comes
 * back from model binding and query validation, i.e. the 400s. The **legacy**
 * envelope Rekaz's own documentation promises,
 * `{error: {code, message, details, data, validationErrors}}`, comes back from
 * application and business failures, i.e. the 403s, 404s and 500s, always with
 * `code: null`.
 *
 * That split is why the traceId kept going missing. It exists ONLY in
 * ProblemDetails, so the identifier Rekaz support asks for first was being read
 * off the family of failures that rarely needs it, and was absent from the
 * family that does.
 *
 * 🔴 `opaque` means "no recognisable marker of either envelope", and it is the
 * FALLBACK rather than a fourth case. Only Rekaz's own application emits JSON in
 * one of these shapes, so anything else was written by the edge in front of it,
 * or by nothing at all. Classifying the unknown as `opaque` is what makes the
 * 403 split fail safe: the branch that says "check the User-Agent" is the one
 * that cannot mislead a visitor, so it is the one the doubtful case gets.
 */
type RekazErrorShape = "problem" | "legacy" | "opaque";

type ParsedRekazError = {
  shape: RekazErrorShape;
  /** ProblemDetails `title`, or the legacy envelope's `message`. */
  message?: string;
  /** Field NAMES. 🔴 Never the values: those echo what the visitor submitted. */
  fields?: string[];
  /** ProblemDetails only. The first thing Rekaz support asks for. */
  traceId?: string;
  /** The legacy envelope's `error.code`. Null on every failure observed. */
  code?: string | null;
  /** Cloudflare's `error code: 1010`, when the edge answered instead of Rekaz. */
  edgeCode?: string;
};

function parseRekazError(text: string): ParsedRekazError {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON at all, so it never reached Rekaz's application. The edge block
    // names itself: `error code: 1010` is Cloudflare refusing the client.
    return { shape: "opaque", edgeCode: /error code:\s*(\d+)/i.exec(text)?.[1] };
  }

  // 🔴 `typeof [] === "object"` and `typeof null === "object"`. Both are ruled
  // out here rather than relied on to behave downstream.
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { shape: "opaque" };
  }

  const obj = body as Record<string, unknown>;
  const traceId = typeof obj.traceId === "string" ? obj.traceId : undefined;

  // The legacy envelope announces itself with one key. Its VALUE is read
  // defensively because only the key is evidence of the shape.
  if ("error" in obj) {
    const envelope =
      typeof obj.error === "object" &&
      obj.error !== null &&
      !Array.isArray(obj.error)
        ? (obj.error as Record<string, unknown>)
        : {};
    return {
      shape: "legacy",
      message:
        typeof envelope.message === "string" ? envelope.message : undefined,
      fields: fieldNames(envelope.validationErrors),
      code: typeof envelope.code === "string" ? envelope.code : null,
      traceId,
    };
  }

  // 🔴 POSITIVE evidence required, never "it is JSON and it is not legacy".
  // Treating every other object as ProblemDetails would file a bare `{}` on a
  // 403 as a business refusal, which is the one reading with a visitor-facing
  // consequence and the one with the least support in the body.
  const looksLikeProblem =
    typeof obj.title === "string" ||
    typeof obj.type === "string" ||
    typeof obj.status === "number" ||
    traceId !== undefined ||
    fieldNames(obj.errors) !== undefined;

  if (looksLikeProblem) {
    return {
      shape: "problem",
      message: typeof obj.title === "string" ? obj.title : undefined,
      fields: fieldNames(obj.errors),
      traceId,
    };
  }

  return { shape: "opaque" };
}

/**
 * The KEYS of an upstream errors map, never its values.
 *
 * 🔴 The values are where the leak lives. ASP.NET Core's model binder writes
 * `"The value 'BAD' is not valid for PriceId."`, echoing the submitted value
 * verbatim, and on a booking that value is the visitor's name, mobile or email.
 * The names are the half that tells a developer what went wrong.
 *
 * ⚠️ An ARRAY is rejected explicitly. `typeof [] === "object"`, so without this
 * a JSON array would yield `["0", "1", "2"]` as field names: output that looks
 * like information and is not.
 */
function fieldNames(value: unknown): string[] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length > 0 ? keys : undefined;
}

/**
 * What may stand in for the upstream body inside an `AppError.message`.
 *
 * 🔴 The raw body used to go there, up to 300 characters of it. That is not a
 * dead end: the message is re-logged downstream under keys the denylist does not
 * match, it is persisted into Supabase on the booking path, and on the
 * `upstream_unavailable` branch `toPublicError` forwards it to the client
 * intact. Since Rekaz echoes submitted values verbatim and every booking POST
 * carries the visitor's name, mobile and email inline, the raw body was personal
 * data leaving this function under a name nothing downstream can see.
 *
 * So it does not leave. What leaves is the shape, the field NAMES, the traceId,
 * and upstream's own sentence with mobile and email shapes scrubbed out of it.
 * 🔴 Nothing personal may be added to this string later for the same reason.
 */
function describeFailure(parsed: ParsedRekazError): string {
  const parts: string[] = [parsed.shape];
  if (parsed.edgeCode) parts.push(`edge=${parsed.edgeCode}`);
  if (parsed.fields) parts.push(`fields=[${parsed.fields.join(", ")}]`);
  if (parsed.traceId) parts.push(`traceId=${parsed.traceId}`);
  if (parsed.message) parts.push(`"${scrubValue(summarise(parsed.message))}"`);
  return parts.join(" ");
}

/**
 * How much of a redacted upstream body reaches the log line.
 *
 * Generous on purpose: an ASP.NET error body is small, and the cap exists to
 * stop a pathological response filling a log store, not to hide anything. The
 * redaction above it is what does the hiding.
 */
const MAX_LOGGED_BODY_CHARS = 2_000;

/**
 * The upstream body, parsed, redacted, and only THEN bounded.
 *
 * ⚠️ The order is the fix. This used to be `safeParse(summarise(text))`, which
 * handed `JSON.parse` a body cut off mid-object, so every failure longer than
 * 300 characters logged the string "[unparseable body]" and nothing else:
 * exactly the large validation failures worth reading. Truncating a structure
 * before parsing it destroys the structure.
 *
 * A body that survives parsing and still exceeds the cap degrades to a truncated
 * string rather than being dropped, so the beginning of it is still readable and
 * the log says how much was cut.
 */
function boundedBody(text: string): unknown {
  const parsed = redact(safeParse(text));
  const serialised = JSON.stringify(parsed) ?? "";
  if (serialised.length <= MAX_LOGGED_BODY_CHARS) return parsed;
  return `${serialised.slice(0, MAX_LOGGED_BODY_CHARS)}... [truncated, ${serialised.length} chars]`;
}
