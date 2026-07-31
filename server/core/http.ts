import {
  fromUnknown,
  httpStatusFor,
  toPublicError,
  type AppError,
} from "./errors";
import { log } from "./logger";
import type { Result } from "./result";

/**
 * Turning a `Result` into an HTTP response.
 *
 * Lives here rather than in `app/api/` so that every endpoint maps failures the
 * same way. Route handlers stay about five lines, which is the point: a route
 * handler with branching in it is a service that has escaped into the framework.
 *
 * Uses the Web `Response`, not `NextResponse`, so `server/` keeps its promise of
 * having no framework dependency. Next accepts a plain `Response` from a route
 * handler without complaint.
 */

export type JsonInit = {
  status?: number;
  headers?: Record<string, string>;
};

export function json(body: unknown, init: JsonInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // These endpoints are per-request and often carry personal data. A shared
      // cache storing one visitor's response and serving it to the next is a
      // disclosure bug, not a performance win.
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

export function errorResponse(error: AppError): Response {
  const status = httpStatusFor(error.code);

  // Unexpected failures are logged in full server-side; the client gets a code.
  // This is the only place that detail is allowed to diverge, and it is the
  // reason `toPublicError` discards the message for `internal`.
  //
  // 🔴 `forbidden` is on this list, and it was added the day something started
  // returning it. `server/rekaz/client.ts` now answers a Rekaz business refusal
  // with `forbidden` rather than `internal`, and its client-facing message is
  // deliberately bare, so if this line did not fire the single most diagnostic
  // failure on the booking path would produce no `request.failed` entry at all.
  // A code that carries no detail to the caller MUST carry it to the log.
  if (
    error.code === "internal" ||
    error.code === "upstream_unavailable" ||
    error.code === "forbidden"
  ) {
    log.error("request.failed", {
      code: error.code,
      reason: error.message,
      cause: error.cause,
    });
  }

  const headers: Record<string, string> = {};
  if (error.code === "rate_limited" && error.retryAfterSeconds !== undefined) {
    headers["retry-after"] = String(error.retryAfterSeconds);
  }

  return json(toPublicError(error), { status, headers });
}

/** Maps a `Result` to a response, using `onOk` for the success shape. */
export function respond<T>(
  result: Result<T, AppError>,
  onOk: (value: T) => { body: unknown; status?: number }
): Response {
  if (!result.ok) return errorResponse(result.error);
  const { body, status } = onOk(result.value);
  return json(body, { status });
}

/**
 * Wraps a route handler so that nothing can escape as an unhandled exception.
 *
 * 🔴 Without this, one `throw` anywhere below the route (a misconfigured
 * environment, a client library raising instead of returning, a genuine bug)
 * escapes the `Result` discipline entirely: Next catches it and renders its own
 * error page. An API endpoint then answers a JSON request with HTML, a caller
 * expecting `{error:{code}}` gets a parse failure, and in development that page
 * includes a stack trace with file paths and source.
 *
 * Every route handler goes through here. It is the backstop that makes "no
 * exceptions cross a layer boundary" true even when a layer misbehaves.
 */
export function route(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (cause) {
      return errorResponse(fromUnknown(cause, "unhandled route error"));
    }
  };
}

/**
 * Parses a JSON request body without throwing.
 *
 * A malformed body is a client mistake, so it becomes a 422 like any other
 * validation failure rather than an unhandled exception and a 500.
 */
export async function readJson(
  request: Request
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return { ok: false };
  }
}
