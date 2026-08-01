import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOOKING, LEGACY_STORE_PATHS, bookingUrl } from "@/lib/links";
import { SPACES } from "@/server/domain/spaces";
import { REKAZ_STORE_ORIGIN } from "@/server/rekaz/store";

/**
 * Where a buyer is sent when they press Book, and what happens to anyone still
 * holding a link to the on-site flow.
 *
 * 🔴 **THIS FILE PINS A TEMPORARY STATE, 2026-08-01.** Owner decision: until
 * Rekaz fix their API, nobody touches the on-site booking flow. Every Book
 * control links out to the mazj.sa storefront in a new tab, and the four
 * `/spaces/<space>/book` routes 307 out to the same pages. Reasoning lives in
 * `lib/links.ts` under `bookingUrl()`.
 *
 * When on-site booking comes back, this file goes back with it: the pre-change
 * version is on `feature/onsite-booking`, and it asserted the exact opposite of
 * the first block below. **Reverting the code without reverting this test leaves
 * a suite that fails green** — it would still be checking that booking links
 * leave the site.
 *
 * Four places have to agree about four products: `lib/links.ts` (where the site
 * links), `server/domain/spaces.ts` (how a URL maps to a Rekaz product),
 * `server/rekaz/store.ts` (the storefront's origin) and `next.config.mjs` (what
 * happens to the on-site routes). They live apart because the frontend/backend
 * boundary forbids the import that would unify them; this is the sync test
 * `server/CLAUDE.md` prescribes for exactly that situation.
 */
describe("booking links (TEMPORARY: out to the mazj.sa store)", () => {
  /**
   * All eight finished URLs, written out by hand.
   *
   * `bookingUrl()` derives them by inverting `LEGACY_STORE_PATHS`, which is
   * correct and unreadable. A literal table is the only version of this test
   * that tells a future reader what a customer actually sees, and it is what
   * catches an inversion that silently pairs the wrong slug to the wrong space.
   */
  const EXPECTED = {
    sharedSeat: {
      en: "https://mazj.sa/en/subscription/adwyh-almsahh-almshtrkh",
      ar: "https://mazj.sa/ar/subscription/adwyh-almsahh-almshtrkh",
    },
    privateOffice: {
      en: "https://mazj.sa/en/subscription/private-office",
      ar: "https://mazj.sa/ar/subscription/private-office",
    },
    meeting: {
      en: "https://mazj.sa/en/reservation/ghrfh-alajtmaaat-almlqa",
      ar: "https://mazj.sa/ar/reservation/ghrfh-alajtmaaat-almlqa",
    },
    event: {
      en: "https://mazj.sa/en/reservation/qaah-alfaalyat-almaarj",
      ar: "https://mazj.sa/ar/reservation/qaah-alfaalyat-almaarj",
    },
  } as const;

  it("builds the exact store URL for all four spaces in both locales", () => {
    for (const [space, byLocale] of Object.entries(EXPECTED)) {
      for (const [locale, url] of Object.entries(byLocale)) {
        expect(
          bookingUrl(space as keyof typeof BOOKING, locale),
          `${space}/${locale}`
        ).toBe(url);
      }
    }
  });

  it("covers every space, and invents none", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(BOOKING).sort());
  });

  it("🔴 always writes the locale into the path", () => {
    // A locale-less `mazj.sa/subscription/<slug>` answers 308 to `/ar/...`, so
    // omitting it would silently land an English buyer in Arabic at the moment
    // of purchase. Every URL must carry a locale segment straight after the
    // origin, and an unrecognised locale must resolve to `en` rather than
    // producing `/undefined/`.
    for (const space of Object.keys(BOOKING) as Array<keyof typeof BOOKING>) {
      expect(bookingUrl(space, "en")).toMatch(/^https:\/\/mazj\.sa\/en\//);
      expect(bookingUrl(space, "ar")).toMatch(/^https:\/\/mazj\.sa\/ar\//);
      expect(bookingUrl(space, "fr")).toBe(bookingUrl(space, "en"));
      expect(bookingUrl(space, "")).toBe(bookingUrl(space, "en"));
    }
  });

  it("🔴 uses the same storefront origin the backend does", () => {
    // The origin is spelled in two files because `lib/` may not import
    // `server/`. Duplicated-then-pinned is the house pattern; this is the pin.
    // Drift here points half the site's Book buttons at a host the ticket
    // links do not use.
    for (const space of Object.keys(BOOKING) as Array<keyof typeof BOOKING>) {
      expect(bookingUrl(space, "en").startsWith(`${REKAZ_STORE_ORIGIN}/`), space).toBe(
        true
      );
    }
  });

  it("⚠️ uses the bare host, not www", () => {
    // Both serve the same site from the same addresses, but `www.mazj.sa` 301s
    // to the bare host on every one of these paths (verified live 2026-08-01),
    // which puts an extra round trip on the last click before payment.
    for (const space of Object.keys(BOOKING) as Array<keyof typeof BOOKING>) {
      expect(bookingUrl(space, "en"), space).not.toContain("www.");
    }
  });

  it("leaves BOOKING itself untouched, so the revert stays a revert", () => {
    // `BOOKING` is no longer linked from anywhere, but it is still the
    // canonical list of which `/book` routes exist: `bookingUrl()` keys off it
    // and the redirect block below is built from it. If someone "cleans it up"
    // to absolute URLs, restoring on-site booking stops being a one-commit
    // revert and the redirect rules below lose their source of truth.
    for (const [key, href] of Object.entries(BOOKING)) {
      expect(href, key).toMatch(/^\/spaces\/[a-z-]+\/book$/);
      expect(href, key).not.toMatch(/^https?:/);
    }
  });

  it("has one booking route per space, matching the server's mapping", () => {
    const fromSpaces = SPACES.map((s) => `/spaces/${s.slug}/book`).sort();
    expect(Object.values(BOOKING).slice().sort()).toEqual(fromSpaces);
  });

  it("every store path is a real product path", () => {
    const valid = new Set(Object.values(BOOKING));
    for (const [from, to] of Object.entries(LEGACY_STORE_PATHS)) {
      expect(valid.has(to as (typeof BOOKING)[keyof typeof BOOKING]), from).toBe(
        true
      );
    }
  });
});

describe("the /book routes redirect out to the store", () => {
  const config = readFileSync("next.config.mjs", "utf8");

  /** Every `redirects()` line that mentions a `/spaces/<space>/book` source. */
  const bookRules = config
    .split("\n")
    .filter((l) => /source: "(\/:locale\(en\|ar\))?\/spaces\/[a-z-]+\/book"/.test(l));

  it("🔴 redirects each route in BOTH shapes", () => {
    // The bare path AND the locale-prefixed one. `redirects()` runs before
    // middleware in Next's routing order, so next-intl never gets to add a
    // prefix first: a rule for the prefixed shape alone would miss a bare
    // `/spaces/coworking/book` entirely and render the live Rekaz flow, which
    // is the exact path this change exists to close.
    for (const route of Object.values(BOOKING)) {
      expect(config, `bare ${route}`).toContain(`source: "${route}"`);
      expect(config, `prefixed ${route}`).toContain(
        `source: "/:locale(en|ar)${route}"`
      );
    }
    expect(bookRules.length).toBe(Object.keys(BOOKING).length * 2);
  });

  it("🔴 redirects TEMPORARILY (307), never permanently", () => {
    // The most consequential word in the block. A permanent redirect is cached
    // by browsers and by Google indefinitely, so it would SURVIVE THE REVERT:
    // customers would keep being thrown out to mazj.sa long after on-site
    // booking returned, and no deploy could call them back.
    for (const rule of bookRules) {
      expect(rule).toContain("permanent: false");
      expect(rule).not.toContain("permanent: true");
    }
  });

  it("sends every route to the mazj.sa store", () => {
    for (const rule of bookRules) {
      expect(rule).toContain('destination: "https://mazj.sa/');
    }
  });

  it("🔴 does NOT also redirect the store paths back INTO the site", () => {
    // The loop guard, and the reason the eight `LEGACY_STORE_PATHS` rules were
    // deleted rather than left alone. Holding both directions between the same
    // two URLs is an infinite bounce the day this app serves `mazj.sa`: their
    // rule sends the buyer in, ours sends them straight back out, and the
    // browser gives up with ERR_TOO_MANY_REDIRECTS on the revenue path.
    //
    // Restoring those rules is correct ONLY in the same commit that removes the
    // outbound ones above. Both directions is never correct.
    for (const from of Object.keys(LEGACY_STORE_PATHS)) {
      expect(config, `bare ${from} must not redirect inward`).not.toContain(
        `source: "${from}"`
      );
      expect(config, `prefixed ${from} must not redirect inward`).not.toContain(
        `source: "/:locale(en|ar)${from}"`
      );
    }
  });
});
