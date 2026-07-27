import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOOKING, LEGACY_STORE_PATHS } from "@/lib/links";
import { SPACES } from "@/server/domain/spaces";

/**
 * The booking links, and the redirects that keep the old ones alive.
 *
 * Three separate places have to agree about four products: `lib/links.ts` (what
 * the site links to), `server/domain/spaces.ts` (how a URL maps to a Rekaz
 * product), and `next.config.mjs` (what happens to the legacy store paths). They
 * live apart on purpose, because the frontend/backend boundary forbids the
 * import that would unify them. This is the sync test `server/CLAUDE.md`
 * prescribes for exactly that situation.
 */
describe("booking links", () => {
  it("🔴 points at internal routes, never at the mazj.sa store", () => {
    // The whole reason Phase 2 exists. If any of these goes back to an absolute
    // mazj.sa URL, the launch breaks: those paths 404 the moment the domain
    // serves this app.
    for (const [key, href] of Object.entries(BOOKING)) {
      expect(href, key).toMatch(/^\/spaces\/[a-z-]+\/book$/);
      expect(href, key).not.toContain("mazj.sa");
      expect(href, key).not.toMatch(/^https?:/);
    }
  });

  it("has one booking link per space, matching the server's mapping", () => {
    const fromSpaces = SPACES.map((s) => `/spaces/${s.slug}/book`).sort();
    expect(Object.values(BOOKING).slice().sort()).toEqual(fromSpaces);
  });
});

describe("legacy store redirects", () => {
  const config = readFileSync("next.config.mjs", "utf8");

  it("every legacy path maps to a real booking route", () => {
    const valid = new Set(Object.values(BOOKING));
    for (const [from, to] of Object.entries(LEGACY_STORE_PATHS)) {
      expect(valid.has(to as (typeof BOOKING)[keyof typeof BOOKING]), from).toBe(
        true
      );
    }
  });

  it("🔴 each legacy path is redirected in BOTH shapes", () => {
    // The bare path AND the locale-prefixed one. mazj.sa 308s
    // `/subscription/<slug>` to `/ar/subscription/<slug>`, so real traffic
    // arrives on both, and the prefixed form is the one that would otherwise
    // slip past next-intl into the catch-all and render a branded 404.
    for (const from of Object.keys(LEGACY_STORE_PATHS)) {
      expect(config, `bare ${from}`).toContain(`source: "${from}"`);
      expect(config, `prefixed ${from}`).toContain(
        `source: "/:locale(en|ar)${from}"`
      );
    }
  });

  it("redirects permanently, so the equity transfers", () => {
    // A 307 tells Google the move is temporary and to keep the old URL indexed.
    // Every legacy-store rule must be permanent.
    const legacyRules = config
      .split("\n")
      .filter((l) => /source: "(\/:locale\(en\|ar\))?\/(subscription|reservation)\//.test(l));

    expect(legacyRules.length).toBe(Object.keys(LEGACY_STORE_PATHS).length * 2);
    for (const rule of legacyRules) {
      expect(rule).toContain("permanent: true");
    }
  });
});
