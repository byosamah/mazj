import { describe, expect, it } from "vitest";

import {
  ADMIN_EMAIL_DOMAIN,
  isAllowedAdminEmail,
  normaliseAdminEmail,
} from "./admin-access";

/**
 * This function is the door. Every test below is an attempt to walk through it.
 *
 * The cases that matter are not the happy ones; they are the addresses that a
 * suffix check would wave through. Those are marked.
 */

const OWNER = "o.khalil@mazj.org";

describe("isAllowedAdminEmail: addresses that must be let in", () => {
  it("accepts the owner's address", () => {
    expect(isAllowedAdminEmail(OWNER)).toBe(true);
  });

  it("accepts any local part on the domain", () => {
    for (const email of [
      "info@mazj.org",
      "a@mazj.org",
      "first.last+tag@mazj.org",
      "under_score@mazj.org",
      "has-hyphen@mazj.org",
    ]) {
      expect(isAllowedAdminEmail(email), email).toBe(true);
    }
  });

  it("is case-insensitive, because DNS is", () => {
    for (const email of [
      "O.Khalil@MAZJ.ORG",
      "o.khalil@Mazj.Org",
      "O.KHALIL@mazj.org",
    ]) {
      expect(isAllowedAdminEmail(email), email).toBe(true);
    }
  });

  it("tolerates surrounding whitespace from a copy-paste", () => {
    expect(isAllowedAdminEmail(`  ${OWNER}  `)).toBe(true);
    expect(isAllowedAdminEmail(`\t${OWNER}\n`)).toBe(true);
  });
});

describe("isAllowedAdminEmail: the attacks a suffix check would miss", () => {
  it("🔴 rejects a quoted local part ending in the allowed domain", () => {
    // Valid per RFC 5321, delivered to evil.com, and `endsWith("@mazj.org")`
    // returns true for it. This single case is why the function exists.
    expect(isAllowedAdminEmail('"anything@mazj.org"@evil.com')).toBe(false);
    expect(isAllowedAdminEmail('"o.khalil@mazj.org"@evil.com')).toBe(false);
  });

  it("🔴 rejects the domain appearing before another @", () => {
    expect(isAllowedAdminEmail("a@mazj.org@evil.com")).toBe(false);
    expect(isAllowedAdminEmail("a@mazj.org.evil.com")).toBe(false);
  });

  it("rejects subdomains of the allowed domain", () => {
    // `mail.mazj.org` can be delegated separately and is not the same trust
    // boundary as the apex.
    expect(isAllowedAdminEmail("a@mail.mazj.org")).toBe(false);
    expect(isAllowedAdminEmail("a@sub.sub.mazj.org")).toBe(false);
  });

  it("rejects domains that merely contain or extend the allowed one", () => {
    for (const email of [
      "a@notmazj.org",
      "a@mazj.org.uk",
      "a@mazj.orgx",
      "a@xmazj.org",
      "a@mazj.sa",
      "a@mazj.com",
    ]) {
      expect(isAllowedAdminEmail(email), email).toBe(false);
    }
  });

  it("rejects a trailing dot on the domain", () => {
    // `mazj.org.` is the fully-qualified form and resolves identically in DNS,
    // but it is a different string and Supabase would store it as one.
    expect(isAllowedAdminEmail("a@mazj.org.")).toBe(false);
  });

  it("🔴 rejects homograph domains that render identically", () => {
    // Cyrillic а (U+0430) in place of ASCII a. Indistinguishable in most fonts.
    expect(isAllowedAdminEmail("a@mаzj.org")).toBe(false);
    // Cyrillic о (U+043E) in place of ASCII o.
    expect(isAllowedAdminEmail("a@mazj.оrg")).toBe(false);
  });

  it("🔴 rejects embedded control characters and header injection", () => {
    // A trailing newline is how a copied address smuggles a second header into
    // a mail send. `trim()` alone would remove it and accept the rest.
    expect(isAllowedAdminEmail("a@mazj.org\u0000")).toBe(false);
    expect(isAllowedAdminEmail("a@mazj.org\nbcc:evil@x.com")).toBe(false);
    expect(isAllowedAdminEmail("a@mazj.org\r\nbcc:evil@x.com")).toBe(false);
    expect(isAllowedAdminEmail("a\u0000@mazj.org")).toBe(false);
    expect(isAllowedAdminEmail("a@mazj\u007f.org")).toBe(false);
  });

  it("rejects internal whitespace", () => {
    expect(isAllowedAdminEmail("a b@mazj.org")).toBe(false);
    expect(isAllowedAdminEmail("a@mazj .org")).toBe(false);
    expect(isAllowedAdminEmail("a @mazj.org")).toBe(false);
  });
});

describe("isAllowedAdminEmail: malformed input", () => {
  it("rejects non-strings without throwing", () => {
    for (const value of [
      null,
      undefined,
      42,
      true,
      {},
      [],
      { email: OWNER },
      // A crafted object whose toString would pass a naive coercion.
      { toString: () => OWNER },
    ]) {
      expect(isAllowedAdminEmail(value), JSON.stringify(value) ?? "?").toBe(
        false
      );
    }
  });

  it("rejects structurally invalid addresses", () => {
    for (const email of [
      "",
      "   ",
      "mazj.org",
      "@mazj.org",
      "a@",
      "@",
      "a",
      "a@@mazj.org",
    ]) {
      expect(isAllowedAdminEmail(email), JSON.stringify(email)).toBe(false);
    }
  });

  it("rejects an address longer than RFC 5321 permits", () => {
    const long = `${"a".repeat(250)}@${ADMIN_EMAIL_DOMAIN}`;
    expect(long.length).toBeGreaterThan(254);
    expect(isAllowedAdminEmail(long)).toBe(false);
  });
});

describe("normaliseAdminEmail", () => {
  it("lowercases the whole address so one person is one account", () => {
    expect(normaliseAdminEmail("O.Khalil@MAZJ.ORG")).toBe(OWNER);
    expect(normaliseAdminEmail(`  ${OWNER}  `)).toBe(OWNER);
  });

  it("returns null for everything isAllowedAdminEmail rejects", () => {
    for (const value of [
      '"a@mazj.org"@evil.com',
      "a@notmazj.org",
      "a@mail.mazj.org",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(normaliseAdminEmail(value), JSON.stringify(value) ?? "?").toBeNull();
    }
  });

  it("agrees with isAllowedAdminEmail on every input", () => {
    const inputs = [
      OWNER,
      "O.Khalil@MAZJ.ORG",
      '"a@mazj.org"@evil.com',
      "a@mail.mazj.org",
      "a@notmazj.org",
      "a@mazj.org.",
      "",
      null,
      123,
    ];
    for (const input of inputs) {
      expect(
        normaliseAdminEmail(input) !== null,
        JSON.stringify(input) ?? "?"
      ).toBe(isAllowedAdminEmail(input));
    }
  });
});
