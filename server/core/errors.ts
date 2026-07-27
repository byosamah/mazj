/**
 * Typed application errors.
 *
 * Every failure that can cross a layer boundary is one of these. The `code` is
 * the contract: it is stable, machine-readable, and safe to branch on. Callers
 * must never parse `message`, which exists for humans reading logs and is free
 * to change.
 *
 * Nothing here is an `Error` subclass. These travel inside `Result`, get
 * serialised into HTTP responses and compared in tests, and a plain object does
 * all three without dragging a stack trace along. Stack traces belong on the
 * `cause`, which stays server-side.
 */

export const ERROR_CODES = [
  /** Input failed validation. The caller can fix it and retry. */
  "validation_failed",
  /** Too many requests from this client in the current window. */
  "rate_limited",
  /** An identical request is already in flight, or the state moved underneath us. */
  "conflict",
  /** An idempotency key was reused with a different request body. */
  "idempotency_key_reused",
  /** The thing asked for does not exist. */
  "not_found",
  /** No credentials, or credentials we could not verify. */
  "unauthorized",
  /** Valid credentials, insufficient rights. */
  "forbidden",
  /** A third party (Rekaz, Supabase) failed or timed out. Retryable. */
  "upstream_unavailable",
  /** Everything else. Never leaks detail to the client. */
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type AppError = {
  readonly code: ErrorCode;
  /** For logs and developers. Never shown verbatim to end users. */
  readonly message: string;
  /** Field-level detail, only ever populated for `validation_failed`. */
  readonly fields?: Readonly<Record<string, string>>;
  /** Seconds until a retry may succeed. Set for `rate_limited`. */
  readonly retryAfterSeconds?: number;
  /** The underlying failure. Stays server-side; never serialised to a client. */
  readonly cause?: unknown;
};

type ErrorOptions = Omit<AppError, "code" | "message">;

function make(code: ErrorCode) {
  return (message: string, options: ErrorOptions = {}): AppError => ({
    code,
    message,
    ...options,
  });
}

export const errors = {
  validation: (
    message: string,
    fields?: Record<string, string>
  ): AppError => ({ code: "validation_failed", message, fields }),
  rateLimited: (message: string, retryAfterSeconds: number): AppError => ({
    code: "rate_limited",
    message,
    retryAfterSeconds,
  }),
  conflict: make("conflict"),
  idempotencyKeyReused: make("idempotency_key_reused"),
  notFound: make("not_found"),
  unauthorized: make("unauthorized"),
  forbidden: make("forbidden"),
  upstreamUnavailable: make("upstream_unavailable"),
  internal: make("internal"),
} as const;

/**
 * HTTP status for each code.
 *
 * One table, so a status can never drift between two endpoints that report the
 * same failure.
 */
const HTTP_STATUS: Record<ErrorCode, number> = {
  validation_failed: 422,
  rate_limited: 429,
  conflict: 409,
  idempotency_key_reused: 422,
  not_found: 404,
  unauthorized: 401,
  forbidden: 403,
  upstream_unavailable: 503,
  internal: 500,
};

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/**
 * The client-facing shape of an error.
 *
 * 🔴 `internal` deliberately discards the real message. An unexpected failure's
 * text routinely contains connection strings, SQL fragments, table names and
 * occasionally row data, and an error response is the single easiest place in a
 * web application to leak all of it. The detail is logged; the client gets a
 * code it can act on and nothing else.
 */
export type PublicError = {
  error: {
    code: ErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
};

export function toPublicError(e: AppError): PublicError {
  if (e.code === "internal") {
    return {
      error: {
        code: "internal",
        message: "Something went wrong on our side. Please try again.",
      },
    };
  }
  return {
    error: {
      code: e.code,
      message: e.message,
      ...(e.fields ? { fields: { ...e.fields } } : {}),
    },
  };
}

/**
 * Wraps an unknown thrown value as an `AppError`.
 *
 * Used at the few places where third-party code can still throw (a network
 * client, `JSON.parse`) to bring it back into the `Result` world.
 */
export function fromUnknown(cause: unknown, context: string): AppError {
  const detail =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : "non-Error value thrown";
  return errors.internal(`${context}: ${detail}`, { cause });
}
