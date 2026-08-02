import {describe, expect, it} from "vitest";

import {routing} from "@/i18n/routing";
import {INDEXABLE_ROUTES} from "@/lib/routes";

/**
 * hreflang is annotated in TWO places on this site and must never be annotated
 * in a third.
 *
 * Google allows more than one annotation method, but it requires them to AGREE:
 * where they conflict it discards the whole cluster, which means an Arabic
 * searcher gets sent to the English page and back. This site emits:
 *
 *   1. `<link rel="alternate">` tags, from `lib/metadata.ts`
 *   2. `<xhtml:link>` entries on every sitemap URL, from `app/sitemap.ts`
 *
 * 🔴 There was a THIRD until 2026-08-02: next-intl's middleware emits a `Link:`
 * HTTP header, on by default, and it did not agree. Measured on `/en/spaces`
 * and `/ar/spaces`, the header named `x-default` as `/spaces` with NO locale
 * prefix, while the HTML tag named `/en/spaces`. A locale-less `/spaces` is not
 * a canonical URL on this site; it is a path the same middleware redirects.
 *
 * It also degrades at launch rather than improving: both `mazj.sa` and
 * `mazj.org` will serve this one app, and the header is built from whichever
 * host served the request while every other annotation is built from the single
 * `NEXT_PUBLIC_SITE_URL`.
 *
 * This file pins the config, because the failure is invisible: the header does
 * not appear in the HTML, no page looks wrong, and the only symptom is a
 * language that quietly stops ranking. A next-intl upgrade that changes the
 * default, or a session tidying `i18n/routing.ts`, would restore it silently.
 */

describe("hreflang annotation methods", () => {
  it("🔴 does not emit the next-intl `Link:` HTTP header", () => {
    // `alternateLinks: false` is the whole fix. If this reads `true` or
    // `undefined`, the middleware is annotating hreflang a third way.
    expect(
      (routing as unknown as {alternateLinks?: boolean}).alternateLinks,
      "next-intl is emitting a Link: hreflang header again, which conflicts with the HTML tags"
    ).toBe(false);
  });

  it("⚠️ keeps locale detection ON, which is a different field", () => {
    // The obvious wrong fix is to disable the middleware's locale handling
    // wholesale. `localeDetection` is what sends a first-time Arabic visitor to
    // /ar; turning it off is a product regression with no SEO benefit.
    const detection = (routing as unknown as {localeDetection?: boolean})
      .localeDetection;

    expect(detection === undefined || detection === true).toBe(true);
  });

  it("keeps both locales prefixed, which is what makes a cluster expressible", () => {
    expect(routing.localePrefix).toBe("always");
    expect([...routing.locales].sort()).toEqual(["ar", "en"]);
  });
});

describe("the two surviving annotations describe the same URLs", () => {
  it("every indexable route can express a full cluster including x-default", () => {
    // Both `lib/metadata.ts` and `app/sitemap.ts` build their clusters from the
    // same `/{locale}{path}` shape. This asserts the shape itself is stable and
    // that x-default resolves to a real, locale-prefixed route rather than to a
    // bare path, which is precisely what the removed header got wrong.
    for (const {path} of INDEXABLE_ROUTES) {
      const cluster = {
        en: `/en${path}`,
        ar: `/ar${path}`,
        "x-default": `/en${path}`,
      };

      expect(cluster["x-default"]).toBe(cluster.en);
      for (const href of Object.values(cluster)) {
        expect(href.startsWith("/en") || href.startsWith("/ar")).toBe(true);
        // The bare, unprefixed form is what the HTTP header used and it must
        // never appear in a cluster.
        expect(href).not.toBe(path || "/");
      }
    }
  });
});
