import { afterEach, describe, expect, it } from "vitest";

import { clientIp, idempotencyKey, proxyTrust, userAgent } from "./request";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  /**
   * 🔴 The single most important assertion in this file.
   *
   * The previous implementation returned the literal string "unknown" when no
   * header was present. `hashIp("unknown", salt)` is a CONSTANT, so every
   * header-less request on the site shared ONE rate-limit bucket, capped at
   * eight bookings an hour in total, and nothing anywhere reported it. A
   * fallback that quietly turns into a site-wide outage is precisely the kind
   * this project forbids.
   */
  it("returns null, never a magic string, when no address is present", () => {
    expect(clientIp(h({}), "none")).toEqual({ ip: null, attested: false });
    expect(clientIp(h({}), "vercel")).toEqual({ ip: null, attested: false });
    expect(clientIp(h({}), "cloudflare")).toEqual({ ip: null, attested: false });
  });

  it("treats an empty header as absent", () => {
    expect(clientIp(h({ "x-forwarded-for": "" }), "none").ip).toBeNull();
  });

  describe("on vercel", () => {
    /**
     * Vercel OVERWRITES x-forwarded-for and does not forward external IPs,
     * explicitly to prevent spoofing, so what arrives is platform-attested and
     * the header-rotation attack the audit described does not work here.
     * `x-real-ip` carries the same value and is what Vercel's own `ipAddress()`
     * helper reads, so it is preferred.
     */
    it("prefers x-real-ip and marks it attested", () => {
      expect(
        clientIp(h({ "x-real-ip": "81.10.0.1", "x-forwarded-for": "9.9.9.9" }), "vercel")
      ).toEqual({ ip: "81.10.0.1", attested: true });
    });

    it("accepts x-forwarded-for when x-real-ip is absent", () => {
      expect(clientIp(h({ "x-forwarded-for": "81.10.0.1" }), "vercel")).toEqual({
        ip: "81.10.0.1",
        attested: true,
      });
    });

    it("ignores cf-connecting-ip, which Vercel never sets", () => {
      // Anything in this header on Vercel came from a client, so honouring it
      // would hand an attacker a free bucket per request. The old fallback
      // chain tried it FIRST.
      expect(clientIp(h({ "cf-connecting-ip": "6.6.6.6" }), "vercel").ip).toBeNull();
    });
  });

  describe("behind cloudflare", () => {
    /**
     * Cloudflare APPENDS to x-forwarded-for rather than overwriting it, so the
     * leftmost entry there is whatever the client typed. Only cf-connecting-ip
     * means anything, and only because Cloudflare sets it itself.
     */
    it("uses cf-connecting-ip and marks it attested", () => {
      expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1" }), "cloudflare")).toEqual({
        ip: "1.1.1.1",
        attested: true,
      });
    });

    it("refuses the client-controlled x-forwarded-for outright", () => {
      expect(
        clientIp(h({ "x-forwarded-for": "81.10.0.1, 172.16.0.1" }), "cloudflare").ip
      ).toBeNull();
    });
  });

  describe("with nothing trusted in front", () => {
    it("still reads an address but never claims it is attested", () => {
      expect(clientIp(h({ "x-forwarded-for": "81.10.0.1" }), "none")).toEqual({
        ip: "81.10.0.1",
        attested: false,
      });
    });

    /**
     * Leftmost, not rightmost, and the original reasoning still holds: the
     * rightmost entry would put every visitor behind one CDN edge into a single
     * bucket and let one abuser throttle a whole city.
     */
    it("takes the leftmost entry and trims it", () => {
      expect(
        clientIp(h({ "x-forwarded-for": "  81.10.0.1 , 10.0.0.1, 10.0.0.2" }), "none").ip
      ).toBe("81.10.0.1");
    });
  });

  /**
   * 🔴 The value becomes a Postgres bucket key AND an audit pseudonym, so it must
   * actually be an address. It used to accept arbitrary text, and combined with
   * `hashIp` having no namespace that let a caller send
   * `X-Forwarded-For: mobile:+966500000000` and produce an `originHash`
   * byte-identical to that number's `submitterHash`: a forged collision between
   * the exact two fields the audit trail uses to tell an impersonator from an
   * account holder.
   */
  it("rejects a header value that is not an IP address", () => {
    for (const junk of [
      "mobile:+966500000000",
      "not-an-ip",
      "ip:81.10.0.1",
      "'; drop table --",
      "x".repeat(500),
    ]) {
      expect(clientIp(h({ "x-forwarded-for": junk }), "none").ip).toBeNull();
    }
  });

  it("accepts both IPv4 and IPv6", () => {
    expect(clientIp(h({ "x-forwarded-for": "81.10.0.1" }), "none").ip).toBe("81.10.0.1");
    expect(clientIp(h({ "x-forwarded-for": "2001:db8::1" }), "none").ip).toBe("2001:db8::1");
  });

  it("never reports attested without an address", () => {
    // The pair (null, true) is meaningless and must be unreachable: a caller
    // branching on `attested` would take the trusted path with nothing in hand.
    for (const trust of ["vercel", "cloudflare", "none"] as const) {
      const cases: Record<string, string>[] = [
        {},
        { "x-forwarded-for": "" },
        { "cf-connecting-ip": "" },
      ];
      for (const headers of cases) {
        const identity = clientIp(h(headers), trust);
        if (identity.ip === null) expect(identity.attested).toBe(false);
      }
    }
  });
});

describe("proxyTrust", () => {
  const original = process.env.IP_TRUST_PROXY;
  afterEach(() => {
    if (original === undefined) delete process.env.IP_TRUST_PROXY;
    else process.env.IP_TRUST_PROXY = original;
  });

  it("reads the configured platform", () => {
    process.env.IP_TRUST_PROXY = "vercel";
    expect(proxyTrust()).toBe("vercel");
    process.env.IP_TRUST_PROXY = "  CloudFlare  ";
    expect(proxyTrust()).toBe("cloudflare");
  });

  /**
   * 🔴 Defaults to the LEAST trusting reading. A missing variable can then only
   * make us treat a genuine address as untrustworthy, which costs a little
   * strictness. Defaulting the other way would make a forgeable header look
   * attested, which is the mistake that actually matters.
   */
  it("defaults to none, and rejects anything it does not recognise", () => {
    delete process.env.IP_TRUST_PROXY;
    expect(proxyTrust()).toBe("none");
    process.env.IP_TRUST_PROXY = "fly.io";
    expect(proxyTrust()).toBe("none");
    process.env.IP_TRUST_PROXY = "";
    expect(proxyTrust()).toBe("none");
  });
});

describe("idempotencyKey", () => {
  it("returns a well-formed key", () => {
    expect(idempotencyKey(h({ "idempotency-key": "a1b2c3d4e5" }))).toBe(
      "a1b2c3d4e5"
    );
  });

  it("returns null when absent", () => {
    expect(idempotencyKey(h({}))).toBeNull();
  });

  /** It becomes a database key, so an unbounded header is an unbounded row. */
  it("rejects a key that is too short or too long", () => {
    expect(idempotencyKey(h({ "idempotency-key": "short" }))).toBeNull();
    expect(idempotencyKey(h({ "idempotency-key": "x".repeat(201) }))).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(idempotencyKey(h({ "idempotency-key": "  a1b2c3d4e5  " }))).toBe(
      "a1b2c3d4e5"
    );
  });
});

describe("userAgent", () => {
  it("returns the header, truncated", () => {
    expect(userAgent(h({ "user-agent": "Mozilla/5.0" }))).toBe("Mozilla/5.0");
    expect(userAgent(h({ "user-agent": "x".repeat(900) }))).toHaveLength(400);
  });

  it("returns null when absent", () => {
    expect(userAgent(h({}))).toBeNull();
  });
});
