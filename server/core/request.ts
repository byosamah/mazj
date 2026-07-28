/**
 * Reading trustworthy facts out of an untrustworthy HTTP request.
 *
 * Deliberately framework-free: it takes a `Headers`, which is a Web standard,
 * not a `NextRequest`. That keeps `server/` liftable and makes these functions
 * testable with three lines and no HTTP server.
 */

import { isIP } from "node:net";

/**
 * Which proxy, if any, sits in front of this deployment.
 *
 * 🔴 This is CONFIGURATION, not something to detect. Whether a forwarded header
 * can be trusted is a property of the deployment topology, and the request
 * cannot tell you its own topology: every header that would reveal it is set by
 * the same client you are trying to evaluate. Sniffing "does cf-connecting-ip
 * exist" asks the attacker whether to trust the attacker.
 *
 * Set `IP_TRUST_PROXY` to match where this is actually deployed.
 */
export type ProxyTrust = "vercel" | "cloudflare" | "none";

/**
 * A client IP, and whether the platform vouches for it.
 *
 * `attested` means a proxy we trust replaced whatever the client sent, so the
 * value identifies a real network peer. `unattested` means we have a value but
 * the client could have chosen it. `null` means we have nothing.
 *
 * The distinction is the point: a caller that treats all three the same is the
 * bug this type exists to prevent.
 */
export type ClientIdentity = {
  ip: string | null;
  attested: boolean;
};

/**
 * The client IP, with an honest statement of how much it is worth.
 *
 * 🔴 The previous version of this function had a comment arguing that taking the
 * LEFTMOST `x-forwarded-for` entry was the right trade, because taking the
 * rightmost would collapse everyone behind one CDN edge into a single bucket and
 * let one abuser throttle a city. That argument is sound and it is preserved
 * below. What it got wrong was assuming the leftmost value is always forgeable.
 * It depends entirely on what is in front:
 *
 * - **Vercel OVERWRITES `x-forwarded-for`** and does not forward external IPs,
 *   explicitly to prevent spoofing. So on Vercel the leftmost entry is attested,
 *   and the header-rotation attack simply does not work. Vercel's own
 *   `ipAddress()` helper reads `x-real-ip`, which carries the same value.
 * - **Cloudflare APPENDS**, preserving whatever the client sent, so behind
 *   Cloudflare the leftmost entry IS attacker-controlled and only
 *   `cf-connecting-ip` is meaningful, and even that only if the origin cannot be
 *   reached directly.
 * - With nothing in front, every one of these headers is client input.
 *
 * The old chain read `x-forwarded-for` first and, only when that was absent,
 * fell through `cf-connecting-ip`, `x-real-ip`, `x-vercel-forwarded-for`. So its
 * ordering was not simply reversed; the flaw was that it applied ONE order
 * everywhere, which cannot be right for both platforms at once, and it ranked
 * the header Vercel actually sets (`x-vercel-forwarded-for`) below two that a
 * client can set.
 *
 * 🔴 And it returned the literal string `"unknown"` when no header was present.
 * That is worse than it looks. `hashIp("unknown", salt)` is a CONSTANT, so every
 * header-less request in the world shared one rate-limit bucket: eight bookings
 * per hour across the entire site, from a single attacker, with no signal
 * anywhere. A fallback that silently degrades into a site-wide outage is exactly
 * the kind this project forbids. Absent is now `null`, and callers must say what
 * they want to do about it.
 */
export function clientIp(
  headers: Headers,
  trust: ProxyTrust = proxyTrust()
): ClientIdentity {
  const first = (name: string): string | null => {
    const raw = headers.get(name);
    if (!raw) return null;
    // Comma-separated chain of `client, proxy1, proxy2`. The leftmost entry is
    // the originating client, whoever wrote it.
    const head = raw.split(",")[0]?.trim();
    if (!head) return null;

    // 🔴 It must actually BE an address. This value becomes a Postgres bucket key
    // and an audit pseudonym, and it previously accepted arbitrary text: sending
    // `X-Forwarded-For: mobile:+966500000000` produced an `originHash` identical
    // to that number's `submitterHash`, letting an attacker forge a collision
    // between the two fields the audit trail uses to tell them apart.
    return isIP(head) ? head : null;
  };

  if (trust === "vercel") {
    // Both carry the same platform-attested address. `x-real-ip` is what
    // Vercel's own helper reads, so it goes first.
    const ip = first("x-real-ip") ?? first("x-forwarded-for");
    return { ip, attested: ip !== null };
  }

  if (trust === "cloudflare") {
    // The ONLY header Cloudflare sets itself. `x-forwarded-for` is appended to
    // here, so its leftmost entry is the client's own claim and worthless.
    const ip = first("cf-connecting-ip");
    return { ip, attested: ip !== null };
  }

  // Nothing trusted in front. Take a value if one is there, because a
  // best-effort bucket still slows a naive script, but never claim it is worth
  // anything. The second rate-limit dimension is what actually holds here.
  const ip = first("x-forwarded-for") ?? first("x-real-ip");
  return { ip, attested: false };
}

/**
 * The configured topology.
 *
 * Defaults to `none`, the least trusting reading, so a missing variable can only
 * ever make us treat a real IP as untrustworthy. The opposite default would make
 * a forgeable header look attested, which is the mistake that matters.
 *
 * 🔴 Set `IP_TRUST_PROXY=vercel` when the Vercel deployment goes live. Until it
 * is set, both rate limits lean entirely on their second dimension.
 */
export function proxyTrust(): ProxyTrust {
  const configured = process.env.IP_TRUST_PROXY?.trim().toLowerCase();
  return configured === "vercel" || configured === "cloudflare"
    ? configured
    : "none";
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
