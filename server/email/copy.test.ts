import { describe, expect, it } from "vitest";

import { STARTUP_EMAIL_COPY, fill, formatEmailDate } from "./copy";
import {
  renderApprovedEmail,
  renderReceivedEmail,
  renderRejectedEmail,
} from "./templates";

/**
 * The guarantees the site gets from the i18n rule, applied to email copy that
 * cannot live in `messages/*.json` (see the header of `copy.ts`).
 *
 * Everything here is a rule from `TONE.md` or `CLAUDE.md` that would otherwise
 * only be caught by a native reader looking at a real inbox.
 */

/** Every leaf key path in an object, so two locales can be compared by shape. */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

describe("bilingual parity", () => {
  it("carries identical key paths in both locales", () => {
    // 🔴 Key PATHS, never values. Comparing values false-fails the moment the
    // Arabic says something different, which is the entire job of the Arabic.
    expect(leafPaths(STARTUP_EMAIL_COPY.ar).sort()).toEqual(
      leafPaths(STARTUP_EMAIL_COPY.en).sort()
    );
  });

  it("leaves no string empty in either locale", () => {
    for (const locale of ["en", "ar"] as const) {
      for (const path of leafPaths(STARTUP_EMAIL_COPY[locale])) {
        const value = path
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], STARTUP_EMAIL_COPY[locale]);
        expect(typeof value, `${locale}.${path}`).toBe("string");
        expect((value as string).trim().length, `${locale}.${path}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("TONE.md constraints", () => {
  const everything = JSON.stringify(STARTUP_EMAIL_COPY);

  it("contains no em-dash", () => {
    // Banned site-wide, Arabic and English. They hid as list bullets in the
    // legal routes and survived every read-through, so this is grepped, not read.
    expect(everything).not.toContain("—");
  });

  it("spells the city with the damma", () => {
    // `الخُبر` is settled. Bare `الخبر` also reads as "the news".
    expect(STARTUP_EMAIL_COPY.ar.signOff).toContain("الخُبر");
    expect(STARTUP_EMAIL_COPY.ar.footerAddress).toContain("الخُبر");
  });

  it("uses the settled Arabic room names", () => {
    // Coining a synonym has failed native review before.
    expect(STARTUP_EMAIL_COPY.ar.rejected.openDoor).toContain("الملقى");
    expect(STARTUP_EMAIL_COPY.ar.rejected.openDoor).toContain("المعارج");
    expect(STARTUP_EMAIL_COPY.ar.rejected.openDoor).toContain("المكتب المرن");
  });

  it("uses no Arabic-Indic digits", () => {
    // Reserved for dated archives. Product copy is Western digits throughout.
    expect(JSON.stringify(STARTUP_EMAIL_COPY.ar)).not.toMatch(/[٠-٩]/);
  });

  it("keeps the offer a closed envelope", () => {
    // 🔴 The owner's standing ruling, and the one an eager copy edit is most
    // likely to break: nowhere may these emails state a price, a percentage or
    // a duration of the offer itself. The code's own 30-day validity is a
    // property of the code, not a term of the offer, and it is interpolated
    // rather than written into the copy, so it cannot trip this.
    expect(everything).not.toMatch(/\d+\s*%/);
    expect(everything).not.toMatch(/SAR|ريال|ر\.س/);
    expect(everything.toLowerCase()).not.toMatch(/discount|free month|خصم|مجان/);
  });
});

describe("the approval email", () => {
  const rendered = renderApprovedEmail({
    locale: "en",
    siteOrigin: "https://mazj.example",
    startupName: "Acme",
    code: "MAZJ-K7P3-QN42",
    expiresAt: "2026-08-27T09:00:00.000Z",
  });

  it("says a person honours the code, not a checkout", () => {
    // 🔴 The load-bearing sentence in the whole feature. Rekaz has no coupon
    // API, so if this line is ever trimmed for brevity every approved founder
    // hunts for a discount box that does not exist.
    expect(rendered.html).toContain("our team applies the offer for you");
    expect(rendered.text).toContain("our team applies the offer for you");
    expect(rendered.html).toContain("not a checkout coupon");
  });

  it("carries the code and its expiry in both parts", () => {
    for (const part of [rendered.html, rendered.text]) {
      expect(part).toContain("MAZJ-K7P3-QN42");
      expect(part).toContain("27 August 2026");
    }
  });

  it("always ships a plain-text part", () => {
    // An HTML-only message is a spam signal and is unreadable in a watch
    // notification or with images off.
    expect(rendered.text.trim().length).toBeGreaterThan(80);
  });
});

describe("Arabic rendering", () => {
  it("sets rtl on the document", () => {
    const rendered = renderReceivedEmail({
      locale: "ar",
      siteOrigin: "https://mazj.example",
      founderName: "أسامة",
      reference: "MZ-7K3QD9",
    });
    expect(rendered.html).toContain('dir="rtl"');
    expect(rendered.html).toContain('lang="ar"');
    expect(rendered.html).toContain("MZ-7K3QD9");
  });

  it("dates in Arabic use the Gregorian calendar and Western digits", () => {
    // 🔴 Two silent traps in one call. `ar-SA` defaults to the Umm al-Qura
    // (Hijri) calendar, so an expiry would render as a correct date in the
    // wrong system beside a deadline somebody must act on, and nobody reviewing
    // the English would ever see it. It also defaults to Arabic-Indic digits,
    // which TONE.md reserves for dated archives.
    const formatted = formatEmailDate("2026-08-27T09:00:00.000Z", "ar");
    expect(formatted).toContain("2026");
    expect(formatted).not.toMatch(/[٠-٩]/);
    expect(formatted).not.toContain("١٤"); // no Hijri year
  });
});

describe("escaping", () => {
  it("escapes hostile input from the public form", () => {
    // 🔴 `founderName` and `startupName` are typed by a stranger, and this HTML
    // is sent from MAZJ's own verified sending domain. An unescaped tag here is
    // a phishing primitive, not a rendering bug. React is escaping nothing on
    // this path, because none of it is React.
    const rendered = renderRejectedEmail({
      locale: "en",
      siteOrigin: "https://mazj.example",
      founderName: '<script>alert(1)</script>',
      startupName: '"><img src=x onerror=alert(1)>',
      reason: "Not this time, because <b>reasons</b> that we explain here.",
    });

    // ⚠️ Assert on the TAG, not on the payload. `onerror=` survives as literal
    // text and that is correct and harmless: it is the `<` that decides whether
    // a browser reads it as an attribute or as five characters of prose. A
    // first draft of this test banned the substring and failed against
    // perfectly-escaped output, which is a test that would eventually be
    // "fixed" by weakening the escaping.
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).not.toContain("<b>reasons</b>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    // The only `<img` in the document is the wordmark we put there ourselves.
    expect(rendered.html.match(/<img /g)?.length).toBe(1);
  });

  it("keeps the admin's line breaks in the reason", () => {
    const rendered = renderRejectedEmail({
      locale: "en",
      siteOrigin: "https://mazj.example",
      founderName: "Sam",
      startupName: "Acme",
      reason: "First line here.\nSecond line here.",
    });
    expect(rendered.html).toContain("First line here.<br />Second line here.");
  });
});

describe("fill", () => {
  it("substitutes only the placeholders it was given", () => {
    expect(fill("Hi {founder}, {other}", { founder: "Sam" })).toBe("Hi Sam, {other}");
  });

  it("replaces every occurrence", () => {
    expect(fill("{a} and {a}", { a: "x" })).toBe("x and x");
  });
});
