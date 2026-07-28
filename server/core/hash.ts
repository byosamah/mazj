import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Hashing helpers.
 *
 * Everything here is deterministic and salted with a server-side secret, which
 * is what separates "we can recognise a repeat visitor" from "we are storing
 * personal data".
 */

/**
 * Hashes a client IP address for storage and rate limiting.
 *
 * 🔴 The raw address never touches the database. Under PDPL an IP address is
 * personal data, and it is the single least useful piece of personal data to
 * retain: we need to tell one client from another, not identify a human.
 *
 * HMAC rather than a plain hash because the input space is tiny. There are
 * about 4.3 billion IPv4 addresses, so an unsalted SHA-256 of an address is
 * reversible by brute force in minutes on a laptop. Keying it with a secret
 * makes that impossible without also stealing the secret, and rotating
 * `IP_HASH_SALT` deliberately severs the link to every previously stored hash,
 * which is a useful thing to be able to do on purpose.
 *
 * Truncated to 32 hex characters (128 bits). Still far beyond collision range
 * for this data set, and half the storage.
 */
export function hashIp(ip: string, salt: string): string {
  // 🔴 Namespaced, like every other pseudonym. Without the `ip:` prefix this was
  // a bare HMAC of attacker-controlled text while `hashIdentifier` prefixed its
  // input, so a caller sending `X-Forwarded-For: mobile:+966500000000` produced
  // an `originHash` byte-identical to that number's `submitterHash`. The audit
  // trail exists to separate an impersonator from an account holder, and that
  // let an attacker forge a collision between exactly those two values.
  return hashIdentifier(ip, salt, "ip");
}

/**
 * Pseudonymises any identifier for an audit trail.
 *
 * Same construction and same reasoning as `hashIp`, generalised: a Saudi mobile
 * number has an even smaller input space than an IPv4 address (roughly 10^8
 * live `05XXXXXXXX` values), so a plain SHA-256 of one is a lookup table, not a
 * pseudonym. The secret key is what makes it a pseudonym.
 *
 * `domain` separates namespaces, so the hash of a mobile can never equal the
 * hash of an IP that happens to share its digits, and so a leaked table from one
 * use is not a rainbow table for another. Pass a short constant, not user input.
 *
 * What this buys an investigator: "these 40 bookings came from the same place"
 * and "confirm or deny that it was THIS number", without the log ever holding a
 * phone book. What it deliberately does not buy: reading an identifier back out.
 *
 * ⚠️ Two things to know before relying on it.
 *
 * It shares `IP_HASH_SALT` with `hashIp`, which couples two rotation decisions:
 * rotating that salt to sever the link to stored IP hashes ALSO severs every
 * historical booking-submitter correlation. That is a reasonable trade and it is
 * written here so nobody rotates the salt in the middle of an investigation and
 * destroys the trail they were following.
 *
 * And pseudonymous is not anonymous. A hash whose key the controller holds is
 * still personal data under PDPL. This makes a log line defensible to keep; it
 * does not put the data outside the regime.
 */
export function hashIdentifier(
  value: string,
  salt: string,
  domain: string
): string {
  return createHmac("sha256", salt)
    .update(`${domain}:${value}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * A stable fingerprint of a request body, for idempotency-key checking.
 *
 * Keys are sorted recursively before serialisation, so `{a:1,b:2}` and
 * `{b:2,a:1}` fingerprint identically. Without that, a client that happens to
 * serialise its JSON in a different key order on a retry would be told its
 * idempotency key had been reused for a different request, which is both wrong
 * and impossible to debug from the outside.
 */
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(",")}}`;
}

/**
 * Constant-time string comparison, for secrets and signatures.
 *
 * A plain `===` on a signature leaks its contents through timing: it returns as
 * soon as two bytes differ, so an attacker can recover a valid signature one
 * character at a time. Needed the day Rekaz webhooks arrive (their review notes
 * those payloads are currently unsigned, so we will be verifying by refetch and
 * by a hard-to-guess path secret, and this is what compares that secret).
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // Length is not secret, and timingSafeEqual throws on a length mismatch.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
