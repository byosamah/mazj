import { describe, expect, it } from "vitest";

import {
  ERROR_CODES,
  errors,
  fromUnknown,
  httpStatusFor,
  toPublicError,
} from "./errors";

describe("httpStatusFor", () => {
  it("maps every code to a status, with no gaps", () => {
    for (const code of ERROR_CODES) {
      expect(httpStatusFor(code)).toBeGreaterThanOrEqual(400);
    }
  });

  it("uses 429 for rate limiting and 422 for validation", () => {
    expect(httpStatusFor("rate_limited")).toBe(429);
    expect(httpStatusFor("validation_failed")).toBe(422);
  });
});

describe("toPublicError", () => {
  /**
   * The one that matters. An unexpected failure's message routinely carries
   * connection strings, SQL fragments, table names and occasionally row data,
   * and an error response is the easiest place in a web app to leak all of it.
   */
  it("never leaks the message of an internal error", () => {
    const secret = "connect ECONNREFUSED db.internal:5432 password=hunter2";
    const publicError = toPublicError(errors.internal(secret));

    expect(JSON.stringify(publicError)).not.toContain("hunter2");
    expect(JSON.stringify(publicError)).not.toContain("db.internal");
    expect(publicError.error.code).toBe("internal");
  });

  it("never leaks the cause of any error", () => {
    const publicError = toPublicError(
      errors.upstreamUnavailable("upstream failed", {
        cause: new Error("password=hunter2"),
      })
    );
    expect(JSON.stringify(publicError)).not.toContain("hunter2");
  });

  it("keeps the message for errors the caller can act on", () => {
    const publicError = toPublicError(
      errors.validation("Some of those details need another look.", {
        phone: "not a number we can reach",
      })
    );
    expect(publicError.error.message).toContain("another look");
    expect(publicError.error.fields).toEqual({
      phone: "not a number we can reach",
    });
  });

  it("omits fields entirely when there are none", () => {
    expect(toPublicError(errors.notFound("nope")).error.fields).toBeUndefined();
  });
});

describe("fromUnknown", () => {
  it("wraps an Error, keeping the context and the cause", () => {
    const cause = new Error("socket hang up");
    const wrapped = fromUnknown(cause, "rekaz call");
    expect(wrapped.code).toBe("internal");
    expect(wrapped.message).toBe("rekaz call: socket hang up");
    expect(wrapped.cause).toBe(cause);
  });

  it("survives a thrown non-Error", () => {
    expect(fromUnknown({ weird: true }, "somewhere").message).toBe(
      "somewhere: non-Error value thrown"
    );
    expect(fromUnknown("a string", "somewhere").message).toBe(
      "somewhere: a string"
    );
  });
});
