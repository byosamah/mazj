import { describe, expect, it } from "vitest";

import { isTicketableProduct } from "./event-tickets";
import { SPACES } from "../domain/spaces";
import { REKAZ_PRODUCT_TYPE } from "../rekaz/types";

/**
 * What may appear in the admin's ticket-price dropdown.
 *
 * 🔴 WHY THIS FILE EXISTS, rather than the assertion that used to live in
 * `test/rekaz.integration.test.ts`. That one proved the rule by checking a
 * SPECIFIC product slug was still on sale in the live Rekaz tenant, and it had
 * two faults that both came due at once:
 *
 * 1. It `skipIf`s away without merchant credentials, so a fresh clone and any
 *    CI runner ran no assertion on this rule at all.
 * 2. It pinned a row in somebody's production dashboard. The owner deleted that
 *    product on 2026-08-02, so the test went permanently red with no code
 *    change, on a suite whose own docblock says it asserts STRUCTURE and warns
 *    that "a test that goes red because someone raised the meeting-room rate is
 *    a test that gets deleted".
 *
 * The rule never depended on live data: it is two set memberships. Tested here
 * it runs offline, on every `npm run test`, and it is strictly more coverage
 * than before rather than less.
 *
 * 🔴 THE SECOND ASSERTION IS THE EXPENSIVE ONE. Two of the four rooms are
 * `subscription` products, which is an ADMISSIBLE ticket type, so the type rule
 * alone lets them through and only the slug rule stops them. A room reaching
 * this dropdown puts "private office, one year, 34,000 SAR" one mis-click from a
 * 50 SAR ticket, on the form that decides what a stranger is charged.
 *
 * `SPACES` is imported rather than transcribed so a room renamed in
 * `domain/spaces.ts` cannot leave a stale literal here passing while the real
 * exclusion list has moved on.
 */
describe("isTicketableProduct", () => {
  it("admits merchandise, which is what MAZJ actually sells tickets as", () => {
    expect(
      isTicketableProduct({
        type: REKAZ_PRODUCT_TYPE.merchandise,
        slug: "some-event-ticket",
      })
    ).toBe(true);
  });

  it("admits subscription, so an event pointed at one still works", () => {
    // Deliberate: a subscription product is genuinely buyable on the storefront
    // under its own path. Excluding the type would break an event nobody
    // touched. See the comment on TICKETABLE_TYPES.
    expect(
      isTicketableProduct({
        type: REKAZ_PRODUCT_TYPE.subscription,
        slug: "some-term-product",
      })
    ).toBe(true);
  });

  it("excludes reservation, which is only sellable against a free slot", () => {
    expect(
      isTicketableProduct({
        type: REKAZ_PRODUCT_TYPE.reservation,
        slug: "some-slot-product",
      })
    ).toBe(false);
  });

  it("🔴 excludes every ROOM, including the two whose TYPE is admissible", () => {
    for (const space of SPACES) {
      for (const type of Object.values(REKAZ_PRODUCT_TYPE)) {
        expect(
          isTicketableProduct({ type, slug: space.rekazSlug }),
          `${space.rekazSlug} (type ${type}) reached the ticket dropdown`
        ).toBe(false);
      }
    }
  });

  it("🔴 the room exclusion is doing real work, not riding on the type rule", () => {
    // Guards the guard. If SPACE_SLUGS were dropped, the test above would still
    // pass for the two reservation rooms (the type rule excludes those anyway)
    // and fail only for the subscription pair. This states that dependency
    // outright, so a future reader cannot mistake the type rule for sufficient.
    const admissibleTypeRooms = SPACES.filter(
      (s) => s.flow === "subscription"
    );
    expect(
      admissibleTypeRooms.length,
      "no room has an admissible type any more; re-read whether the slug rule is still load-bearing"
    ).toBeGreaterThan(0);

    for (const space of admissibleTypeRooms) {
      expect(
        isTicketableProduct({
          type: REKAZ_PRODUCT_TYPE.subscription,
          slug: space.rekazSlug,
        })
      ).toBe(false);
    }
  });

  it("excludes an unknown type rather than admitting it", () => {
    // Rekaz ships no changelog, so a new product type is a thing that can just
    // appear. Defaulting an unrecognised one INTO a payment dropdown is the
    // wrong direction to be wrong in.
    expect(isTicketableProduct({ type: 99, slug: "who-knows" })).toBe(false);
  });
});
