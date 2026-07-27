import { describe, expect, it } from "vitest";

import { BOOKING } from "@/lib/links";

import { BOOKING_KEY_TO_INTEREST, LEAD_INTERESTS } from "./leads";

/**
 * The price of the frontend/backend boundary, paid.
 *
 * `server/` is forbidden from importing `lib/`, because an import edge back
 * into frontend code is exactly what would stop the folder being liftable into
 * its own service later. The cost of that rule is that the four product
 * identifiers exist in two places, and two places drift.
 *
 * This test is the thing that stops them drifting. It is the ONLY file in
 * `server/` allowed to import from `lib/` (see the exemption in
 * eslint.config.mjs), and it may only do so to compare, never to use.
 *
 * If this fails, someone changed the products in `lib/links.ts`. Update
 * `BOOKING_KEY_TO_INTEREST`, and add a migration altering the `leads_interest_check`
 * constraint. Do not "fix" it by deleting the assertion.
 */
describe("lead interests stay in sync with lib/links.ts", () => {
  it("covers every BOOKING product exactly once", () => {
    expect(Object.keys(BOOKING_KEY_TO_INTEREST).sort()).toEqual(
      Object.keys(BOOKING).sort()
    );
  });

  it("maps every product to a value the database will accept", () => {
    for (const interest of Object.values(BOOKING_KEY_TO_INTEREST)) {
      expect(LEAD_INTERESTS).toContain(interest);
    }
  });

  it("maps no two products to the same interest", () => {
    const mapped = Object.values(BOOKING_KEY_TO_INTEREST);
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  it("keeps 'other' as the only interest with no product behind it", () => {
    const mapped = new Set<string>(Object.values(BOOKING_KEY_TO_INTEREST));
    const unmapped = LEAD_INTERESTS.filter((i) => !mapped.has(i));
    expect(unmapped).toEqual(["other"]);
  });
});
