import { describe, expect, it, vi } from "vitest";

import { hashIdentifier, hashIp } from "@/server/core/hash";
import { log, redact } from "@/server/core/logger";
import { normalizePhone } from "@/server/domain/phone";

/**
 * The booking audit trail must actually survive being logged.
 *
 * `core/logger.ts` redacts any key whose name CONTAINS "name", "mobile", "ip",
 * "email", "key" and more, case-insensitively, at every depth. That denylist is
 * correct and stays: MAZJ operates under PDPL and a log aggregator is exactly
 * the secondary copy that turns a lawful collection into an unlawful one.
 *
 * The trap is that it is a SUBSTRING match on the key, so it silently swallows
 * fields whose contents are already safe. `booking.attempt` shipped carrying
 * `submittedName` and `mobileSuffix`, both of which matched, so the log line
 * that the code comment describes as the answer to "who actually booked this?"
 * recorded "[redacted]" and nothing else, on every booking, from the day it was
 * written.
 *
 * A field surviving because its name happens not to collide is luck, not a
 * design. This test converts it into a guarantee: add "hash" or "origin" or
 * "submitter" to the denylist and this goes red instead of the audit trail
 * quietly going blank again.
 */

const SALT = "test-salt-not-a-real-secret";

/** The exact shape `services/booking.ts` emits for `booking.attempt`. */
function attemptFields(mobile: string, ip: string) {
  return {
    space: "meeting-room",
    flow: "reservation",
    priceImmutableId: "price-abc",
    originHash: hashIp(ip, SALT),
    submitterHash: hashIdentifier(mobile, SALT, "mobile"),
  };
}

describe("the booking audit trail survives redaction", () => {
  const mobile = "+966534600488";
  const ip = "81.10.0.1";
  const logged = redact(attemptFields(mobile, ip)) as Record<string, unknown>;

  it("keeps the origin pseudonym", () => {
    expect(logged.originHash).toBe(hashIp(ip, SALT));
    expect(logged.originHash).not.toBe("[redacted]");
  });

  it("keeps the submitter pseudonym", () => {
    expect(logged.submitterHash).toBe(hashIdentifier(mobile, SALT, "mobile"));
    expect(logged.submitterHash).not.toBe("[redacted]");
  });

  it("records the space and price, which are not personal data", () => {
    // The non-sensitive half must not be collateral damage of the denylist:
    // without these the line cannot be tied to a booking at all.
    expect(logged.space).toBe("meeting-room");
    expect(logged.flow).toBe("reservation");
    expect(logged.priceImmutableId).toBe("price-abc");
  });

  it("leaks neither the number nor the address in any value", () => {
    const serialised = JSON.stringify(logged);

    expect(serialised).not.toContain(mobile);
    expect(serialised).not.toContain(ip);
    // Not even the tail of the number, which the previous version kept.
    expect(serialised).not.toContain("488");
  });

  it("still redacts a genuinely personal field if one is added", () => {
    // The denylist must keep working. This is the half that must NOT regress
    // while making the hashes survive.
    const withPersonal = redact({
      ...attemptFields(mobile, ip),
      submittedName: "Osamah",
      customerEmail: "someone@example.com",
    }) as Record<string, unknown>;

    expect(withPersonal.submittedName).toBe("[redacted]");
    expect(withPersonal.customerEmail).toBe("[redacted]");
  });
});

describe("the pseudonyms behave like pseudonyms", () => {
  it("gives the same submitter the same value across bookings", () => {
    // This is the property that makes "these 40 bookings are one actor" visible.
    expect(hashIdentifier("+966534600488", SALT, "mobile")).toBe(
      hashIdentifier("+966534600488", SALT, "mobile")
    );
  });

  it("distinguishes the impersonator from the account holder", () => {
    // The whole point of logging the ORIGIN as well as the number: an attacker
    // booking on a victim's number produces an identical submitterHash, so only
    // originHash separates them.
    const victimMobile = "+966534600488";
    const attackerOrigin = hashIp("203.0.113.9", SALT);
    const victimOrigin = hashIp("81.10.0.1", SALT);

    expect(hashIdentifier(victimMobile, SALT, "mobile")).toBe(
      hashIdentifier(victimMobile, SALT, "mobile")
    );
    expect(attackerOrigin).not.toBe(victimOrigin);
  });

  /**
   * 🔴 The forged-collision case. `hashIp` used to be a bare HMAC with no
   * namespace while `hashIdentifier` prefixed its input, so feeding the literal
   * text `mobile:<number>` to `hashIp` reproduced that number's `submitterHash`
   * exactly. Both sides are namespaced now.
   */
  it("cannot be made to collide by feeding hashIp a namespaced string", () => {
    const number = "+966500000000";

    expect(hashIp(`mobile:${number}`, SALT)).not.toBe(
      hashIdentifier(number, SALT, "mobile")
    );
  });

  it("separates namespaces, so a mobile never collides with an address", () => {
    const shared = "12345678";

    expect(hashIdentifier(shared, SALT, "mobile")).not.toBe(
      hashIdentifier(shared, SALT, "ip")
    );
    expect(hashIdentifier(shared, SALT, "mobile")).not.toBe(hashIp(shared, SALT));
  });

  it("is not reversible without the salt", () => {
    expect(hashIdentifier("+966534600488", SALT, "mobile")).not.toBe(
      hashIdentifier("+966534600488", "a-different-salt", "mobile")
    );
  });
});

describe("the per-mobile rate-limit bucket cannot be escaped by reformatting", () => {
  /**
   * 🔴 The obvious way to defeat a per-mobile ceiling: type the same number a
   * different way each time and land in a fresh bucket.
   *
   * It fails only because `createBooking` normalises BEFORE hashing. If a future
   * change ever hashes `request.customer.mobile` instead of the normalised
   * `mobile`, the second rate-limit dimension silently stops working while every
   * other test still passes. This is the test that notices.
   */
  const variants = [
    "0534600488",
    "+966534600488",
    "966534600488",
    "+966 53 460 0488",
    // The standard both-domestic-and-international print form, whose redundant
    // trunk 0 this codebase strips.
    "+966 (0)53 460 0488",
    // An Arabic keyboard emits these. Half the site is Arabic.
    "٠٥٣٤٦٠٠٤٨٨",
    "0534-600-488",
    "  0534600488  ",
  ];

  it("normalises every written form of one number to a single value", () => {
    const normalised = new Set(variants.map((v) => normalizePhone(v)));

    expect(normalised).toEqual(new Set(["+966534600488"]));
  });

  it("puts every one of those forms in the SAME bucket", () => {
    const buckets = new Set(
      variants.map((v) => hashIdentifier(normalizePhone(v)!, SALT, "mobile"))
    );

    expect(buckets.size).toBe(1);
  });

  it("still separates two genuinely different numbers", () => {
    expect(hashIdentifier("+966534600488", SALT, "mobile")).not.toBe(
      hashIdentifier("+966534600489", SALT, "mobile")
    );
  });
});

/**
 * A Rekaz error body can carry OUR customer's details back to us.
 *
 * Rekaz runs ASP.NET Core, whose model binding echoes the submitted value into
 * the error it returns. Every booking POST carries `customerDetails` inline (the
 * name, the mobile and the email a visitor typed), so a validation failure on
 * any of those fields puts personal data in the upstream response body, and
 * `server/rekaz/client.ts` logs a bounded slice of that body on every failed
 * request. Logging a raw upstream body is the normal, recommended way to debug a
 * third-party API, which is exactly what makes this trap effective.
 *
 * TWO independent controls stand behind it, and this block pins both:
 *
 * 1. The body is PARSED before it is logged, so `redact` sees object KEYS rather
 *    than one opaque string, and the key denylist can act.
 * 2. Since 2026-07-28 `redact` also scrubs mobile and email SHAPES out of string
 *    values, which is the half a key denylist can never reach.
 *
 * The fixtures are the two real envelopes, both live, neither of which Rekaz's
 * documentation describes on its own.
 */

/** RFC 9110 ProblemDetails: model binding and query validation, HTTP 400. */
const PROBLEM_DETAILS = {
  type: "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  title: "One or more validation errors occurred.",
  status: 400,
  errors: {
    "CustomerDetails.MobileNumber": [
      "The value '+966534600488' is not valid for CustomerDetails.MobileNumber.",
    ],
    "CustomerDetails.Email": [
      "The value 'someone@example.com' is not valid for CustomerDetails.Email.",
    ],
  },
  traceId: "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01",
};

/** The legacy envelope: application and business failures, 403 / 404 / 500. */
const LEGACY_ENVELOPE = {
  error: {
    code: null,
    message:
      "Mobile number already exists with different customer: +966534600488",
    details: null,
    data: null,
    validationErrors: null,
  },
};

describe("a Rekaz error body never carries personal data into a log line", () => {
  // MAZJ's own published WhatsApp line, used throughout this file. A real
  // customer's number does not go into a repository to test a redactor.
  const mobile = "+966534600488";
  const email = "someone@example.com";

  it("redacts both values out of a ProblemDetails body", () => {
    const serialised = JSON.stringify(redact(PROBLEM_DETAILS));

    expect(serialised).not.toContain(mobile);
    expect(serialised).not.toContain(email);

    // The half that must NOT be collateral damage: the field NAMES are the
    // entire diagnostic value of an upstream validation error, and redaction
    // keeps them because it replaces values, not keys.
    expect(serialised).toContain("CustomerDetails.MobileNumber");
    expect(serialised).toContain("traceId");
  });

  it("redacts the legacy envelope's message, which is where a 403 names the number", () => {
    const redacted = redact(LEGACY_ENVELOPE) as {
      error: Record<string, unknown>;
    };

    expect(JSON.stringify(redacted)).not.toContain(mobile);

    // The key is literally called `message`, which the denylist eats whole. That
    // is a coincidence of Rekaz's field naming rather than a control anybody
    // designed, which is why the value scrubber below matters more than this
    // assertion does. `error.code` is null in every legacy body observed, so
    // `message` is also the only field carrying any information at all, which is
    // why it keeps getting logged.
    expect(redacted.error.message).toBe("[redacted]");
  });

  it("emits nothing personal on the line the Rekaz client actually writes", () => {
    // The real transport, not a stand-in. `emit` redacts and THEN stringifies,
    // and the stringify step is where a value that slipped past the denylist
    // would finally become visible.
    const written: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        written.push(args.map((a) => String(a)).join(" "));
      });

    try {
      // The field shape of `rekaz.request_failed`.
      log.error("rekaz.request_failed", {
        status: 400,
        method: "POST",
        path: "/reservations/bulk",
        detail: PROBLEM_DETAILS,
        traceId: PROBLEM_DETAILS.traceId,
      });
    } finally {
      spy.mockRestore();
    }

    expect(written).toHaveLength(1);
    expect(written[0]).not.toContain(mobile);
    expect(written[0]).not.toContain(email);
    // Not even the tail, which is the part a support person would recognise.
    expect(written[0]).not.toContain("0488");
  });
});

describe("nothing personal reaches the row that outlives the request", () => {
  /**
   * The shape `markIndeterminate` writes into `idempotency_keys.response_body`.
   *
   * That row is the one artefact of a booking attempt that OUTLIVES the request:
   * it sits in our own database, it is replayed to any later retry carrying the
   * same key, and a human reads it when working out what happened to somebody's
   * money. Mirrored here rather than imported because `services/booking.ts`
   * builds it inline, exactly as `attemptFields` above mirrors `booking.attempt`.
   */
  function indeterminateRecord(reason: string, reference: string | null) {
    return {
      __mazj_booking_indeterminate__: true,
      space: "meeting-room",
      reason,
      at: "2026-07-28T09:00:00.000Z",
      reference,
    };
  }

  it("carries no customer field at all", () => {
    // The body a Rekaz 5xx on a write actually returns: a fixed sentence with
    // nothing echoed back. This is the only class of failure that can reach
    // `markIndeterminate`, because only `upstream_unavailable` holds the key.
    const record = indeterminateRecord(
      'Rekaz 500 on POST /reservations/bulk: {"error":{"code":null,"message":"An internal error occurred during your request!"}}',
      "R-10241"
    );

    expect(Object.keys(record).sort()).toEqual([
      "__mazj_booking_indeterminate__",
      "at",
      "reason",
      "reference",
      "space",
    ]);
    expect(JSON.stringify(record)).not.toContain("+966534600488");
    expect(JSON.stringify(record)).not.toContain("someone@example.com");
  });

  /**
   * 🔴 GUARDING THE FIX, NOT THE BUG.
   *
   * `reason` is `AppError.message`, which `server/rekaz/client.ts` builds as
   * `<context>: <a bounded slice of the raw upstream body>`. The key `reason`
   * matches nothing on the denylist, and a key denylist cannot reach inside a
   * string anyway, so for a while the only thing keeping this row clean was that
   * every 5xx observed on a write happened to echo nothing back. That is an
   * upstream property, not a control of ours, and this row is persisted and
   * replayed.
   *
   * Closed on 2026-07-28: `redact` now runs `scrubValue` over every string
   * value, and `scrubValue` is exported so `server/rekaz/client.ts` can apply it
   * to the message before it is ever persisted. This test pins that closure. If
   * it goes red, a number is reaching `idempotency_keys.response_body` again:
   * fix the source, do not relax the assertion.
   */
  it("🔴 scrubs a number out of the persisted reason, even under an innocent key", () => {
    const leaked = indeterminateRecord(
      "Rekaz 500 on POST /reservations/bulk: the value '+966534600488' is not valid",
      null
    );

    const serialised = JSON.stringify(redact(leaked));

    expect(serialised).not.toContain("+966534600488");
    // Not the tail either, and the placeholder proves the scrubber ran rather
    // than the number simply never having been in the fixture.
    expect(serialised).not.toContain("0488");
    expect(serialised).toContain("[mobile]");
    // The diagnostic half survives: without it the row says nothing about which
    // call failed, which is the whole reason a human opens it.
    expect(serialised).toContain("POST /reservations/bulk");
  });
});
