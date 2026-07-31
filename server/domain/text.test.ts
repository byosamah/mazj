import { describe, expect, it } from "vitest";

import {
  cleanFreeText,
  cleanMultilineText,
  htmlToPlainText,
  looksLikeEmail,
} from "./text";

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

/**
 * The same protections, for text where a paragraph break is content.
 *
 * Used by the startups application's pitch and by the rejection reason an admin
 * writes, which is emailed to a founder verbatim.
 */
describe("cleanMultilineText", () => {
  it("keeps paragraph structure, which is the whole reason it exists", () => {
    expect(cleanMultilineText("First para.\n\nSecond para.", 2000)).toBe(
      "First para.\n\nSecond para."
    );
  });

  it("strips control characters while sparing the newline", () => {
    // Built with String.fromCharCode. A literal control byte in a .ts file is a
    // hard ESLint parse error, and this function's FIRST DRAFT shipped exactly
    // that: the character class rendered as three visible dashes and stripped
    // nothing, which is the bug this case exists to keep out.
    const nul = String.fromCharCode(0);
    const esc = String.fromCharCode(27);
    const c1 = String.fromCharCode(0x9b);

    expect(cleanMultilineText(`Build${nul}ing${esc}${c1}\nthings`, 2000)).toBe(
      "Building\nthings"
    );
  });

  it("normalises Windows and old-Mac line endings", () => {
    expect(cleanMultilineText("a\r\nb\rc", 2000)).toBe("a\nb\nc");
  });

  it("collapses a paste accident to one blank line", () => {
    expect(cleanMultilineText(`a${"\n".repeat(40)}b`, 2000)).toBe("a\n\nb");
  });

  it("collapses tabs and runs of spaces without eating the newline", () => {
    expect(cleanMultilineText("a \t  b\n   c", 2000)).toBe("a b\nc");
  });

  it("cannot be padded past the pitch floor with whitespace", () => {
    // The 20-character minimum on a pitch is the only quality gate on the form,
    // so newlines must not be a way to clear it with four words.
    expect(cleanMultilineText(`hi${"\n".repeat(60)}`, 2000).length).toBe(2);
    expect(cleanMultilineText(`hi${" ".repeat(60)}`, 2000).length).toBe(2);
  });

  it("bounds the length", () => {
    expect(cleanMultilineText("x".repeat(9000), 2000)).toHaveLength(2000);
  });

  it("leaves ordinary Arabic prose untouched", () => {
    const pitch = "نبني منصة تربط المصممين بالعملاء.\n\nبدأنا قبل سنة.";
    expect(cleanMultilineText(pitch, 2000)).toBe(pitch);
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

describe("htmlToPlainText", () => {
  it("unwraps what Rekaz actually stores", () => {
    // Measured on the live tenant, 2026-07-31.
    expect(htmlToPlainText("<p>بلا بلا بلا</p>")).toBe("بلا بلا بلا");
    expect(htmlToPlainText("<p>فعالية تجريبية بلا بلا بلا</p>")).toBe(
      "فعالية تجريبية بلا بلا بلا"
    );
  });

  it("keeps two paragraphs apart instead of running them together", () => {
    // 🔴 The whole reason block closers are handled before tags are stripped.
    expect(htmlToPlainText("<p>one</p><p>two</p>")).toBe("one\n\ntwo");
    expect(htmlToPlainText("a<br>b")).toBe("a\nb");
    expect(htmlToPlainText("<ul><li>a</li><li>b</li></ul>")).toBe("a\nb");
  });

  it("decodes entities without double-decoding an escaped one", () => {
    expect(htmlToPlainText("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(htmlToPlainText("&quot;quoted&quot;")).toBe('"quoted"');
    expect(htmlToPlainText("a&nbsp;b")).toBe("a b");
    // 🔴 `&amp;lt;` is an author writing the literal text "&lt;". Decoding
    // `&amp;` first would turn it into a `<` they never typed.
    expect(htmlToPlainText("&amp;lt;p&amp;gt;")).toBe("&lt;p&gt;");
  });

  it("leaves plain text alone", () => {
    expect(htmlToPlainText("just words")).toBe("just words");
    expect(htmlToPlainText("")).toBe("");
  });

  it("does not pretend to be a sanitiser, it just flattens", () => {
    // The output is TEXT, bound for a form control that React escapes. This
    // asserts the shape, not safety: nothing may render this as HTML.
    expect(htmlToPlainText("<script>alert(1)</script>hi")).toBe("alert(1)hi");
  });
});
