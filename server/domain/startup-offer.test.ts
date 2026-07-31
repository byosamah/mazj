import { describe, expect, it } from "vitest";

import {
  CODE_VALIDITY_DAYS,
  asSpace,
  asStage,
  generateOfferCode,
  generateReference,
  isCodeExpired,
  offerCodeExpiry,
} from "./startup-offer";

/**
 * The code is the thing a founder is handed as proof MAZJ said yes, so the
 * properties worth pinning are the ones that would embarrass us in a room: a
 * character nobody can read back over the phone, a shape the database check
 * constraint rejects, or a generator whose output is guessable.
 */

/** The same set the migration's check constraints encode as `[2-9A-HJ-NP-Z]`. */
const ALLOWED = /^[2-9A-HJ-NP-Z]+$/;

describe("generateReference", () => {
  it("matches the shape the database check constraint enforces", () => {
    // 🔴 This exact pattern is duplicated in the migration. If one changes and
    // the other does not, every insert fails its own check at runtime, which is
    // a 503 on a public form rather than a test failure. Pinned in both places
    // on purpose.
    for (let i = 0; i < 200; i += 1) {
      expect(generateReference()).toMatch(/^MZ-[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it("never emits a glyph that can be misread aloud", () => {
    const body = Array.from({ length: 300 }, () => generateReference().slice(3)).join("");
    expect(body).toMatch(ALLOWED);
    // The pairs that were dropped, named individually so a future edit to the
    // alphabet that reintroduces one fails here rather than at a front desk.
    for (const glyph of ["0", "O", "1", "I"]) {
      expect(body).not.toContain(glyph);
    }
  });
});

describe("generateOfferCode", () => {
  it("matches the shape the database check constraint enforces", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateOfferCode()).toMatch(/^MAZJ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
    }
  });

  it("does not repeat itself", () => {
    // Not a proof of entropy, and not trying to be. It is the smoke alarm for
    // the failure that actually happens: a generator wired to a constant seed,
    // or one that accidentally returns the same value inside a single tick.
    const seen = new Set(Array.from({ length: 2000 }, generateOfferCode));
    expect(seen.size).toBe(2000);
  });

  it("draws every symbol in the alphabet, roughly evenly", () => {
    // 🔴 The modulo-bias guard. With today's 32-symbol alphabet `% 32` happens
    // to be unbiased, so this passes either way TODAY. It exists for the day
    // somebody drops a symbol: at 31 symbols a naive modulo makes the first 8
    // about 1.6% more likely, and nothing else in the suite would notice.
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      for (const ch of generateOfferCode().replace(/^MAZJ-|-/g, "")) {
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
      }
    }

    expect(counts.size).toBe(32);

    const values = [...counts.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    // Generous: 32000 draws over 32 symbols is 1000 each, and a 25% band is far
    // wider than sampling noise while still catching a systematic skew.
    for (const count of values) {
      expect(count).toBeGreaterThan(mean * 0.75);
      expect(count).toBeLessThan(mean * 1.25);
    }
  });
});

describe("offerCodeExpiry", () => {
  it("is exactly the configured number of days out", () => {
    const from = new Date("2026-07-28T09:00:00.000Z");
    const expiry = offerCodeExpiry(from);
    expect(expiry.getTime() - from.getTime()).toBe(
      CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000
    );
  });

  it("is the owner's thirty days", () => {
    expect(CODE_VALIDITY_DAYS).toBe(30);
  });
});

describe("isCodeExpired", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("is false for a future instant", () => {
    expect(isCodeExpired("2026-08-02T00:00:00.000Z", now)).toBe(false);
  });

  it("is true at and after the instant", () => {
    expect(isCodeExpired("2026-08-01T12:00:00.000Z", now)).toBe(true);
    expect(isCodeExpired("2026-07-31T00:00:00.000Z", now)).toBe(true);
  });

  it("treats a missing expiry as not expired, never as expired", () => {
    // A rejected application has no code and no expiry. Reading that as
    // "expired" would render an alarming red state on a row where nothing is
    // wrong.
    expect(isCodeExpired(null, now)).toBe(false);
  });

  it("treats an unparseable value as not expired", () => {
    // Same reasoning: garbage in this column is a data problem to investigate,
    // not a reason to tell an admin a live code has lapsed.
    expect(isCodeExpired("not a date", now)).toBe(false);
  });
});

describe("narrowing", () => {
  it("accepts only the values the check constraint allows", () => {
    expect(asStage("idea")).toBe("idea");
    expect(asStage("earning")).toBe("earning");
    expect(asSpace("event_hall")).toBe("event_hall");
  });

  it("rejects anything else, including near-misses from a crafted form", () => {
    for (const bad of ["", "IDEA", "growth", "shared seat", "sharedSeat", null, 7, {}]) {
      expect(asStage(bad)).toBeNull();
      expect(asSpace(bad)).toBeNull();
    }
  });
});
