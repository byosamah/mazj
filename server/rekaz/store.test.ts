import { describe, expect, it } from "vitest";

import {
  REKAZ_STORE_ORIGIN,
  rekazStoreUrl,
  storeSharesDomainWith,
} from "./store";
import { REKAZ_PRODUCT_TYPE } from "./types";

const merchandise = {
  slug: "faalyh-tjrybyh",
  type: REKAZ_PRODUCT_TYPE.merchandise,
};
const subscription = {
  slug: "adwyh-almsahh-almshtrkh",
  type: REKAZ_PRODUCT_TYPE.subscription,
};
const reservation = {
  slug: "qaah-alfaalyat-almaarj",
  type: REKAZ_PRODUCT_TYPE.reservation,
};

describe("rekazStoreUrl", () => {
  it("builds the merchandise path a one-time ticket actually lives at", () => {
    // Verified 200 against the live storefront on 2026-07-30. If this shape
    // ever changes, every paid event's button leads to a 404 with the ticket
    // unsold, which is why it is pinned rather than assumed.
    expect(rekazStoreUrl(merchandise, "en")).toBe(
      "https://mazj.sa/en/merchandise/faalyh-tjrybyh"
    );
    expect(rekazStoreUrl(merchandise, "ar")).toBe(
      "https://mazj.sa/ar/merchandise/faalyh-tjrybyh"
    );
  });

  it("uses a different path segment per product type", () => {
    expect(rekazStoreUrl(subscription, "ar")).toBe(
      "https://mazj.sa/ar/subscription/adwyh-almsahh-almshtrkh"
    );
    expect(rekazStoreUrl(reservation, "ar")).toBe(
      "https://mazj.sa/ar/reservation/qaah-alfaalyat-almaarj"
    );
  });

  it("always writes a locale, because the bare path redirects to Arabic", () => {
    // `mazj.sa/merchandise/<slug>` answers 308 to `/ar/...`, so an English
    // reader who followed a locale-less link would land in Arabic.
    expect(rekazStoreUrl(merchandise, "en")).toContain("/en/");
    expect(rekazStoreUrl(merchandise, "fr")).toContain("/en/");
    expect(rekazStoreUrl(merchandise, "")).toContain("/en/");
  });

  it("returns null for a product type it does not know", () => {
    // 🔴 Never interpolate an unmapped type: `undefined` in a path builds a
    // real-looking URL that 404s. These types describe untrusted JSON, so a
    // value outside the union is a live possibility rather than a hypothetical.
    expect(rekazStoreUrl({ slug: "whatever", type: 7 }, "en")).toBeNull();
  });

  it("keeps the origin in exactly one place", () => {
    expect(REKAZ_STORE_ORIGIN).toBe("https://mazj.sa");
    expect(rekazStoreUrl(merchandise, "en")?.startsWith(REKAZ_STORE_ORIGIN)).toBe(
      true
    );
  });

  it("agrees with REKAZ_PRODUCT_TYPE, which it deliberately does not import", () => {
    // 🔴 `store.ts` writes these numbers literally so that `check:env`, which
    // runs under Node's raw TypeScript stripping rather than a bundler, can
    // import it at all. This is the assertion that stops the duplicate drifting:
    // renumber the enum without touching the segment map and this goes red,
    // instead of every ticket button quietly pointing at the wrong path.
    expect(REKAZ_PRODUCT_TYPE.reservation).toBe(0);
    expect(REKAZ_PRODUCT_TYPE.subscription).toBe(1);
    expect(REKAZ_PRODUCT_TYPE.merchandise).toBe(2);
  });
});

describe("storeSharesDomainWith", () => {
  it("catches the launch collision, with or without www", () => {
    // The day this site is served from mazj.sa, every store link points at a
    // route this app does not have.
    expect(storeSharesDomainWith("https://mazj.sa")).toBe(true);
    expect(storeSharesDomainWith("https://www.mazj.sa")).toBe(true);
    expect(storeSharesDomainWith("https://WWW.MAZJ.SA/")).toBe(true);
  });

  it("is quiet for every origin that does not collide", () => {
    expect(storeSharesDomainWith("https://mazj-tau.vercel.app")).toBe(false);
    expect(storeSharesDomainWith("https://www.mazj.org")).toBe(false);
    expect(storeSharesDomainWith("https://mazj.example")).toBe(false);
    expect(storeSharesDomainWith(undefined)).toBe(false);
    expect(storeSharesDomainWith("not a url")).toBe(false);
  });
});
