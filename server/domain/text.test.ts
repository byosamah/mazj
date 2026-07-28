import { describe, expect, it } from "vitest";

import { cleanFreeText, looksLikeEmail } from "./text";

/**
 * Free text from a public form, before it becomes an operations record.
 *
 * These values stopped being throwaway when bookings stopped adopting an
 * existing Rekaz customer id: every booking now writes the submitted name and
 * email upstream and renders them on the admin dashboard.
 */
describe("cleanFreeText", () => {
  it("strips C0 and C1 control characters", () => {
    // Built with String.fromCharCode: a literal control byte in a .ts file is a
    // hard ESLint parse error, which is why the source uses \u escapes too.
    const nul = String.fromCharCode(0);
    const esc = String.fromCharCode(27);
    const c1 = String.fromCharCode(0x9b);

    expect(cleanFreeText(`Osamah${nul}${esc}${c1}`, 120)).toBe("Osamah");
  });

  it("keeps tab and newline by collapsing them to a space, not deleting them", () => {
    expect(cleanFreeText("Osamah\tAl\nKhalil", 120)).toBe("Osamah Al Khalil");
  });

  it("collapses runs of whitespace and trims", () => {
    expect(cleanFreeText("   Osamah    Khalil   ", 120)).toBe("Osamah Khalil");
  });

  it("bounds the length", () => {
    expect(cleanFreeText("x".repeat(5000), 120)).toHaveLength(120);
  });

  it("leaves ordinary Arabic and Latin names untouched", () => {
    expect(cleanFreeText("أسامة الخليل", 120)).toBe("أسامة الخليل");
    expect(cleanFreeText("Jean-Luc O'Brien", 120)).toBe("Jean-Luc O'Brien");
  });

  it("cannot be padded past a minimum-length check", () => {
    // A single character surrounded by whitespace must not read as a long name.
    expect(cleanFreeText("          a          ", 120)).toBe("a");
  });
});

describe("looksLikeEmail", () => {
  it("accepts ordinary addresses, including unusual but valid ones", () => {
    for (const value of [
      "someone@example.com",
      "o.khalil@mazj.org",
      "first+tag@sub.example.co.uk",
      "x_y-z@example.io",
    ]) {
      expect(looksLikeEmail(value), value).toBe(true);
    }
  });

  it("rejects rubbish that would land on a customer record", () => {
    for (const value of [
      "",
      "not-an-email",
      "@example.com",
      "someone@",
      "a@b",
      "two@at@example.com",
      "spaces in@example.com",
      "someone@example.",
      "someone@.com",
      `${"x".repeat(300)}@example.com`,
    ]) {
      expect(looksLikeEmail(value), value).toBe(false);
    }
  });

  /**
   * 🔴 It is NOT the authority on who may use the admin. `domain/admin-access.ts`
   * owns that and applies the RFC 5321 last-`@` rule; this deliberately rejects
   * the quoted-local-part form outright rather than trying to parse it.
   */
  it("is not a substitute for the admin domain rule", () => {
    expect(looksLikeEmail('"anything@mazj.org"@evil.com')).toBe(false);
  });
});
