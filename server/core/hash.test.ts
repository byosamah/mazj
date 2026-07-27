import { describe, expect, it } from "vitest";

import { fingerprint, hashIp, safeEqual } from "./hash";

describe("hashIp", () => {
  const SALT = "a-salt-of-sufficient-length-for-tests";

  it("is deterministic", () => {
    expect(hashIp("81.10.0.1", SALT)).toBe(hashIp("81.10.0.1", SALT));
  });

  it("separates different addresses", () => {
    expect(hashIp("81.10.0.1", SALT)).not.toBe(hashIp("81.10.0.2", SALT));
  });

  /** Rotating the salt must sever the link to previously stored hashes. */
  it("changes completely when the salt changes", () => {
    expect(hashIp("81.10.0.1", SALT)).not.toBe(
      hashIp("81.10.0.1", `${SALT}-rotated`)
    );
  });

  it("never contains the address it hashed", () => {
    expect(hashIp("81.10.0.1", SALT)).not.toContain("81.10");
  });

  it("is a fixed 128-bit hex string", () => {
    expect(hashIp("2001:16a2::1", SALT)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("fingerprint", () => {
  /**
   * The whole point. A client retrying a request may serialise its JSON with
   * keys in a different order; without stable ordering it would be told its
   * idempotency key had been reused for a different request.
   */
  it("ignores key order", () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it("ignores key order at depth", () => {
    expect(fingerprint({ x: { a: 1, b: [1, { c: 3, d: 4 }] } })).toBe(
      fingerprint({ x: { b: [1, { d: 4, c: 3 }], a: 1 } })
    );
  });

  it("respects array order, which is meaningful", () => {
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
  });

  it("distinguishes different values", () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });

  it("distinguishes a missing key from a null one", () => {
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 1, b: null }));
  });

  it("treats undefined as absent, matching JSON transport", () => {
    expect(fingerprint({ a: 1, b: undefined })).toBe(fingerprint({ a: 1 }));
  });
});

describe("safeEqual", () => {
  it("matches identical strings", () => {
    expect(safeEqual("abc123", "abc123")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(safeEqual("abc123", "abc124")).toBe(false);
  });

  it("rejects different lengths without throwing", () => {
    expect(safeEqual("abc", "abcdef")).toBe(false);
  });

  it("handles empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("", "x")).toBe(false);
  });
});
