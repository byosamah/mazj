import { describe, expect, it, vi } from "vitest";

import { absolutePaymentLink } from "./booking";
import { SPACES, spaceBySlug, isSpaceSlug } from "../domain/spaces";

const API_BASE = "https://platform.rekaz.io/api/public";

/**
 * `absolutePaymentLink` exists because of a real, measured surprise: Rekaz's
 * documentation promises an absolute checkout URL and the live API returns a
 * relative path. Redirecting a browser to that raw value sends the buyer to our
 * own origin, so the final click of a purchase lands on a 404.
 */
describe("absolutePaymentLink", () => {
  it("🔴 absolutises the relative path Rekaz actually returns", () => {
    // The exact shape observed from a real booking on 2026-07-27.
    expect(absolutePaymentLink("/orders/pay/RMogHOPQc47FStqK", API_BASE)).toBe(
      "https://platform.rekaz.io/orders/pay/RMogHOPQc47FStqK"
    );
  });

  it("resolves against the ORIGIN, not the API path", () => {
    // Naively joining onto the base would yield
    // `/api/public/orders/pay/...`, which 404s. Verified live: the checkout
    // lives at the origin.
    const link = absolutePaymentLink("/orders/pay/abc", API_BASE);
    expect(link).not.toContain("/api/public");
    expect(link).toBe("https://platform.rekaz.io/orders/pay/abc");
  });

  it("passes an absolute URL through untouched", () => {
    // So the day Rekaz starts honouring its own docs, nothing breaks.
    const absolute = "https://platform.rekaz.io/i/NcRo";
    expect(absolutePaymentLink(absolute, API_BASE)).toBe(absolute);
    expect(absolutePaymentLink("http://example.com/x", API_BASE)).toBe(
      "http://example.com/x"
    );
  });

  it("is case-insensitive about the scheme", () => {
    expect(absolutePaymentLink("HTTPS://x.test/pay", API_BASE)).toBe(
      "HTTPS://x.test/pay"
    );
  });
});

describe("space mapping", () => {
  it("covers all four spaces with unique slugs on both sides", () => {
    expect(SPACES).toHaveLength(4);
    expect(new Set(SPACES.map((s) => s.slug)).size).toBe(4);
    expect(new Set(SPACES.map((s) => s.rekazSlug)).size).toBe(4);
  });

  it("splits into two of each booking flow", () => {
    const reservations = SPACES.filter((s) => s.flow === "reservation");
    const subscriptions = SPACES.filter((s) => s.flow === "subscription");
    expect(reservations.map((s) => s.slug).sort()).toEqual([
      "event-hall",
      "meeting-room",
    ]);
    expect(subscriptions.map((s) => s.slug).sort()).toEqual([
      "coworking",
      "private-office",
    ]);
  });

  it("rejects an unknown slug rather than guessing", () => {
    // `spaceBySlug` gates the whole booking service. Returning a default here
    // would let `/spaces/anything/book` bill against a real product.
    expect(spaceBySlug("nope")).toBeNull();
    expect(spaceBySlug("")).toBeNull();
    expect(spaceBySlug("../coworking")).toBeNull();
    expect(isSpaceSlug("nope")).toBe(false);
    expect(isSpaceSlug(null)).toBe(false);
    expect(isSpaceSlug("coworking")).toBe(true);
  });
});

describe("subscription paging", () => {
  it("🔴 pages past the 100-row cap the tenant is about to cross", async () => {
    // 98 of 100 used at time of writing. A single-page read starts silently
    // undercounting the Active tile and dropping people off the renewal list
    // after two more sign-ups, with no error to notice.
    const pages = [
      { totalCount: 250, items: Array.from({ length: 100 }, (_, i) => ({ id: `a${i}` })) },
      { totalCount: 250, items: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}` })) },
      { totalCount: 250, items: Array.from({ length: 50 }, (_, i) => ({ id: `c${i}` })) },
    ];
    let call = 0;
    vi.doMock("./client", () => ({
      rekazRequest: async () => ({ ok: true, value: pages[call++] }),
    }));
    vi.resetModules();
    const { fetchAllSubscriptions } = await import("./subscriptions");

    const result = await fetchAllSubscriptions();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items).toHaveLength(250);
      expect(new Set(result.value.items.map((s) => s.id)).size).toBe(250);
      expect(result.value.totalCount).toBe(250);
    }
    expect(call, "should stop as soon as it has them all").toBe(3);
    vi.doUnmock("./client");
    vi.resetModules();
  });
});
