import { describe, expect, it } from "vitest";

import { clientIp, idempotencyKey, userAgent } from "./request";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  /**
   * Leftmost, not rightmost, and the reasoning is in the module comment: the
   * rightmost entry would put every visitor behind one CDN edge into a single
   * rate-limit bucket, letting one abuser throttle a whole city.
   */
  it("takes the leftmost entry of x-forwarded-for", () => {
    expect(clientIp(h({ "x-forwarded-for": "81.10.0.1, 10.0.0.1, 10.0.0.2" }))).toBe(
      "81.10.0.1"
    );
  });

  it("trims whitespace around the entry", () => {
    expect(clientIp(h({ "x-forwarded-for": "  81.10.0.1 , 10.0.0.1" }))).toBe(
      "81.10.0.1"
    );
  });

  it("handles a single-entry header", () => {
    expect(clientIp(h({ "x-forwarded-for": "81.10.0.1" }))).toBe("81.10.0.1");
  });

  it("falls back through the platform headers in order", () => {
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1" }))).toBe("1.1.1.1");
    expect(clientIp(h({ "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
  });

  it("prefers x-forwarded-for over the fallbacks", () => {
    expect(
      clientIp(h({ "x-forwarded-for": "81.10.0.1", "x-real-ip": "2.2.2.2" }))
    ).toBe("81.10.0.1");
  });

  it("reports 'unknown' rather than throwing when nothing is present", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("ignores an empty header", () => {
    expect(clientIp(h({ "x-forwarded-for": "" }))).toBe("unknown");
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
