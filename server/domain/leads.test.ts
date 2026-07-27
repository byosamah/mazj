import { describe, expect, it } from "vitest";

import { normalizeLead, type LeadInput } from "./leads";

const NOW = new Date("2026-07-27T09:00:00.000Z");

function input(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    interest: "meeting_room",
    locale: "en",
    email: "someone@example.com",
    ...overrides,
  };
}

function expectOk(result: ReturnType<typeof normalizeLead>) {
  if (!result.ok) throw new Error(`expected ok, got: ${result.error.message}`);
  return result.value;
}

describe("normalizeLead", () => {
  it("lowercases the email so case variants do not become duplicates", () => {
    const lead = expectOk(
      normalizeLead(input({ email: "  Someone@Example.COM " }), NOW)
    );
    expect(lead.email).toBe("someone@example.com");
  });

  it("canonicalises the phone to E.164", () => {
    const lead = expectOk(
      normalizeLead(input({ email: null, phone: "٠٥٣٤٦٠٠٤٨٨" }), NOW)
    );
    expect(lead.phoneE164).toBe("+966534600488");
  });

  it("collapses whitespace and strips zero-width characters from names", () => {
    const lead = expectOk(
      normalizeLead(input({ fullName: "  أسامة​   خليل  " }), NOW)
    );
    expect(lead.fullName).toBe("أسامة خليل");
  });

  it("treats a whitespace-only field as absent", () => {
    const lead = expectOk(normalizeLead(input({ fullName: "   " }), NOW));
    expect(lead.fullName).toBeNull();
  });

  /** Mirrors the `leads_needs_a_contact_channel` constraint in the migration. */
  it("rejects a lead with no way to contact anyone", () => {
    const result = normalizeLead(input({ email: null, phone: null }), NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("email");
  });

  it("rejects an unparseable phone rather than storing it raw", () => {
    const result = normalizeLead(
      input({ email: null, phone: "call me maybe" }),
      NOW
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("phone");
  });

  it("accepts a phone-only lead", () => {
    const lead = expectOk(
      normalizeLead(input({ email: null, phone: "0534600488" }), NOW)
    );
    expect(lead.email).toBeNull();
    expect(lead.phoneE164).toBe("+966534600488");
  });

  it("records consent only when it was actually given", () => {
    expect(expectOk(normalizeLead(input({ consent: true }), NOW)).consentAt).toBe(
      NOW.toISOString()
    );
    expect(
      expectOk(normalizeLead(input({ consent: false }), NOW)).consentAt
    ).toBeNull();
    expect(expectOk(normalizeLead(input(), NOW)).consentAt).toBeNull();
  });

  it("defaults source to web", () => {
    expect(expectOk(normalizeLead(input(), NOW)).source).toBe("web");
    expect(
      expectOk(normalizeLead(input({ source: "instagram" }), NOW)).source
    ).toBe("instagram");
  });

  /**
   * Regression: a NUL byte passed JSON.parse, passed zod's `z.string()`, and
   * survived whitespace collapsing, then reached Postgres, which cannot store
   * one in a text column. The driver answered `unsupported Unicode escape
   * sequence`, which our db layer mapped to `upstream_unavailable`: a 503
   * blaming our database for the caller's input, and telling them to retry
   * something that could never work. Found by adversarial review, reproduced
   * against the live database.
   */
  describe("control characters are stripped before they reach Postgres", () => {
    it.each([
      ["NUL", "\u0000"],
      ["backspace", "\u0008"],
      ["escape", "\u001B"],
      ["delete", "\u007F"],
      ["C1 control", "\u0085"],
    ])("removes %s from a name", (_label, ch) => {
      const lead = expectOk(
        normalizeLead(input({ fullName: `Ahmed${ch} Ali` }), NOW)
      );
      expect(lead.fullName).toBe("Ahmed Ali");
      expect(lead.fullName).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
    });

    it("removes them from every free-text field, not just the name", () => {
      const lead = expectOk(
        normalizeLead(
          input({
            fullName: "A\u0000B",
            note: "n\u0000ote",
            source: "s\u0000rc",
            pagePath: "/en\u0000/spaces",
          }),
          NOW
        )
      );
      for (const value of [lead.fullName, lead.note, lead.source, lead.pagePath]) {
        expect(value).not.toMatch(/[\u0000-\u001F\u007F-\u009F]/);
      }
      expect(lead.note).toBe("note");
      expect(lead.pagePath).toBe("/en/spaces");
    });

    it("still turns real whitespace into a single space rather than deleting it", () => {
      const lead = expectOk(
        normalizeLead(input({ note: "line one\n\tline two" }), NOW)
      );
      expect(lead.note).toBe("line one line two");
    });

    it("treats a field of only control characters as absent", () => {
      expect(
        expectOk(normalizeLead(input({ fullName: "\u0000\u0001" }), NOW)).fullName
      ).toBeNull();
    });
  });

  it("is pure: the same input and clock give the same output", () => {
    const a = normalizeLead(input({ phone: "0534600488" }), NOW);
    const b = normalizeLead(input({ phone: "0534600488" }), NOW);
    expect(a).toEqual(b);
  });
});
