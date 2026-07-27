import { describe, expect, it } from "vitest";

import { isE164, normalizePhone, toAsciiDigits } from "./phone";

const MAZJ = "+966534600488";

describe("toAsciiDigits", () => {
  it("transliterates Arabic-Indic digits", () => {
    expect(toAsciiDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("transliterates Extended Arabic-Indic (Persian/Urdu) digits", () => {
    expect(toAsciiDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("leaves Arabic letters and ASCII alone", () => {
    expect(toAsciiDigits("مزج 12")).toBe("مزج 12");
  });
});

describe("normalizePhone", () => {
  it("normalises a Saudi mobile in national format", () => {
    expect(normalizePhone("0534600488")).toBe(MAZJ);
  });

  /**
   * The reason this module exists. An Arabic keyboard emits U+0660..U+0669, so
   * a visitor typing their own number on the Arabic side of the site produces a
   * string that no ASCII-digit validator accepts.
   */
  it("normalises a Saudi mobile typed with Arabic-Indic digits", () => {
    expect(normalizePhone("٠٥٣٤٦٠٠٤٨٨")).toBe(MAZJ);
  });

  it("normalises Persian digits too", () => {
    expect(normalizePhone("۰۵۳۴۶۰۰۴۸۸")).toBe(MAZJ);
  });

  it("accepts spaces, dashes and parentheses", () => {
    expect(normalizePhone("+966 53 460 0488")).toBe(MAZJ);
    expect(normalizePhone("966-534-600-488")).toBe(MAZJ);
    expect(normalizePhone("(053) 460 0488")).toBe(MAZJ);
  });

  it("accepts the 00 international access prefix", () => {
    expect(normalizePhone("00966534600488")).toBe(MAZJ);
  });

  it("accepts a bare national significant number", () => {
    expect(normalizePhone("534600488")).toBe(MAZJ);
  });

  it("accepts a Saudi landline, not just mobiles", () => {
    // MAZJ's own Al Khobar number, area code 13.
    expect(normalizePhone("013 3300 337")).toBe("+966133300337");
  });

  it("strips the directional marks Arabic input methods insert", () => {
    expect(normalizePhone("‏0534600488‎")).toBe(MAZJ);
  });

  it("passes through a valid non-Saudi number unchanged", () => {
    expect(normalizePhone("+442071234567")).toBe("+442071234567");
  });

  it.each([
    ["empty", ""],
    ["letters", "call me maybe"],
    ["too short", "123"],
    ["too long for E.164", "+9665346004881234567890"],
    ["a Saudi number with the wrong digit count", "05346004"],
    ["a national number that is not 5x or 1x", "0934600488"],
  ])("rejects %s", (_label, input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  /**
   * Regression: `hadPlus` used to be read from the raw string, before
   * punctuation was stripped. A leading bracket therefore hid the `+`, the
   * number fell through to the Saudi-only branches, matched none of them, and a
   * real UAE mobile was rejected as unreachable. Found by adversarial review.
   */
  describe("a bracketed country code still counts as international", () => {
    it.each([
      ["(+971) 50 123 4567", "+971501234567"],
      ["(+44) 20 7123 4567", "+442071234567"],
      [" (+966) 53 460 0488 ", "+966534600488"],
    ])("%s -> %s", (input, expected) => {
      expect(normalizePhone(input)).toBe(expected);
    });
  });

  /**
   * Regression: the `+` branch skipped Saudi validation entirely and just
   * concatenated digits, so `+966 (0)53…` (the standard way of printing a
   * number that works both domestically and internationally) produced a
   * THIRTEEN digit value. It satisfied a generic E.164 shape check and the SQL
   * constraint, so it was stored as canonical: an undialable number, often as
   * the only contact channel on the lead. Found by adversarial review.
   */
  describe("the redundant trunk zero in +966 (0)5… is removed", () => {
    it.each([
      "+966 (0)53 460 0488",
      "+966 0534600488",
      "00966 0534600488",
      "966 0534600488",
      "+9660534600488",
    ])("%s normalises to the 12-digit form", (input) => {
      expect(normalizePhone(input)).toBe(MAZJ);
    });

    it("never emits a Saudi number of the wrong length", () => {
      for (const input of [
        "+966 (0)53 460 0488",
        "+966 0534600488",
        "0534600488",
        "534600488",
        "013 3300 337",
      ]) {
        const out = normalizePhone(input);
        expect(out).not.toBeNull();
        // +966 plus a 9-digit national significant number.
        expect(out).toMatch(/^\+966[15]\d{8}$/);
        expect(out).toHaveLength(13);
      }
    });

    it("rejects a Saudi number that is short even with a country code", () => {
      expect(normalizePhone("+966 05346004")).toBeNull();
      expect(normalizePhone("+96653460048")).toBeNull();
    });

    it("rejects rather than silently swallowing an extension", () => {
      expect(normalizePhone("+966534600488 ext 12")).toBeNull();
    });

    it("still agrees between the + and non-+ paths", () => {
      // These two spellings of the same number used to disagree: one stored a
      // broken value, the other returned null.
      expect(normalizePhone("+966 0534600488")).toBe(
        normalizePhone("966 0534600488")
      );
    });
  });

  it("never returns a value that fails its own E.164 check", () => {
    for (const input of ["0534600488", "٠٥٣٤٦٠٠٤٨٨", "+442071234567"]) {
      const out = normalizePhone(input);
      expect(out).not.toBeNull();
      expect(isE164(out!)).toBe(true);
    }
  });
});
