import { describe, expect, it } from "vitest";

import { hashIdentifier, hashIp } from "@/server/core/hash";
import { redact } from "@/server/core/logger";
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
