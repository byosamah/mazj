/**
 * Reading trustworthy facts out of an untrustworthy HTTP request.
 *
 * Deliberately framework-free: it takes a `Headers`, which is a Web standard,
 * not a `NextRequest`. That keeps `server/` liftable and makes these functions
 * testable with three lines and no HTTP server.
 */

/**
 * Best-effort client IP.
 *
 * 🔴 SPOOFABLE, and treated as such. `x-forwarded-for` is a plain header any
 * client can set, so it is only trustworthy to the extent that a proxy you
 * control overwrites it. The convention it follows is a comma-separated chain
 * of `client, proxy1, proxy2`, appended to as the request travels.
 *
 * We take the LEFTMOST entry, which is the value a client can forge. That is
 * the correct trade-off for our use, which is rate limiting: an attacker who
 * forges a new value per request escapes their own bucket, but taking the
 * rightmost instead would put every visitor behind the same CDN edge into ONE
 * bucket and let one abuser rate-limit an entire city. The leftmost value fails
 * open for a determined attacker; the rightmost fails closed for innocent
 * users. Never use this value for authorisation or for allow-listing.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  // Platform-specific fallbacks, in decreasing order of how much we trust them.
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-vercel-forwarded-for") ??
    "unknown"
  );
}

/**
 * The client-supplied idempotency key, if any.
 *
 * Bounded in length because it becomes a database key, and an unbounded header
 * is an unbounded row.
 */
export function idempotencyKey(headers: Headers): string | null {
  const raw = headers.get("idempotency-key")?.trim();
  if (!raw) return null;
  if (raw.length < 8 || raw.length > 200) return null;
  return raw;
}

/** Truncated user agent, for diagnostics. Never used for any decision. */
export function userAgent(headers: Headers): string | null {
  const ua = headers.get("user-agent")?.trim();
  return ua ? ua.slice(0, 400) : null;
}
