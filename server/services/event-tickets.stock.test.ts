import { describe, expect, it } from "vitest";

import { ticketStock } from "./event-tickets";
import type { RekazPrice, RekazProduct, RekazStock } from "../rekaz/types";

/**
 * How many tickets are left, and how carefully we are allowed to say it.
 *
 * 🔴 THE ASYMMETRY IS THE POINT, and it is a business rule rather than a coding
 * preference. Getting "sold out" wrong in one direction turns away a customer
 * who could have paid; getting it wrong in the other sells a seat that does not
 * exist. Those are not equally bad, and neither is cheap, so:
 *
 * - `isOutOfStock` is a plain boolean this codebase has always read, and it is
 *   trusted outright.
 * - The QUANTITY fields have never been observed carrying a value: both MAZJ
 *   ticket products sit on `isUnlimited: true`, so their meaning is inferred
 *   from their names. Anything missing, non-numeric or unexplained therefore
 *   resolves to "say nothing", NEVER to zero.
 *
 * The day somebody sets a real quantity in the Rekaz dashboard, this file is
 * where to come and check the inference held.
 */

// Only the three fields `ticketStock` reads are set. The casts keep the
// fixtures honest about that rather than inventing thirty irrelevant values
// that a reader would then have to scan past.
const product = (isOutOfStock: boolean): RekazProduct =>
  ({ isOutOfStock }) as unknown as RekazProduct;

const price = (stock?: RekazStock | null): RekazPrice =>
  ({ stock }) as unknown as RekazPrice;

const unlimited: RekazStock = {
  availableQuantity: null,
  allocatedQuantity: 0,
  isUnlimited: true,
  remainingQuantity: null,
};

const withRemaining = (remainingQuantity: number | null): RekazStock => ({
  availableQuantity: 100,
  allocatedQuantity: 0,
  isUnlimited: false,
  remainingQuantity,
});

describe("ticketStock", () => {
  it("trusts isOutOfStock above everything else", () => {
    // Even against a stock block claiming the opposite. This is the one signal
    // measured on the live tenant, and Rekaz owns the question.
    expect(ticketStock(product(true), price(unlimited))).toEqual({
      kind: "sold_out",
    });
    expect(ticketStock(product(true), price(withRemaining(50)))).toEqual({
      kind: "sold_out",
    });
  });

  it("says nothing at all when the merchant set no limit", () => {
    expect(ticketStock(product(false), price(unlimited))).toEqual({
      kind: "unlimited",
    });
    expect(ticketStock(product(false), price(null))).toEqual({
      kind: "unlimited",
    });
    expect(ticketStock(product(false), price(undefined))).toEqual({
      kind: "unlimited",
    });
  });

  it("🔴 treats an unreadable quantity as UNKNOWN, never as zero", () => {
    // The expensive direction. A null here means Rekaz did not tell us, and
    // rendering that as "Fully booked" turns away every buyer of an event that
    // is wide open, with nothing on any screen to explain it.
    expect(ticketStock(product(false), price(withRemaining(null)))).toEqual({
      kind: "unlimited",
    });
  });

  it("reports sold out at zero or below", () => {
    expect(ticketStock(product(false), price(withRemaining(0)))).toEqual({
      kind: "sold_out",
    });
    // Oversold is not a state anybody plans for, but it is representable, and
    // "minus two tickets left" must never reach a page.
    expect(ticketStock(product(false), price(withRemaining(-2)))).toEqual({
      kind: "sold_out",
    });
  });

  it("only counts down out loud once it is genuinely nearly gone", () => {
    expect(ticketStock(product(false), price(withRemaining(1)))).toEqual({
      kind: "running_low",
      left: 1,
    });
    expect(ticketStock(product(false), price(withRemaining(8)))).toEqual({
      kind: "running_low",
      left: 8,
    });
    // 9 is over the ceiling. "9 tickets left" on a room that holds 200 reads as
    // desperation, which is the same reason `lowSeatThreshold` exists for free
    // events.
    expect(ticketStock(product(false), price(withRemaining(9)))).toEqual({
      kind: "available",
    });
    expect(ticketStock(product(false), price(withRemaining(500)))).toEqual({
      kind: "available",
    });
  });
});
