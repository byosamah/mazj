import { beforeEach, describe, expect, it, vi } from "vitest";

import { REKAZ_PAGE_MAX } from "./reservations";
import type { RekazProduct } from "./types";

/**
 * The catalog module: which branch takes the money, and how the product read is
 * cached. Two describes, and the shared mock setup below serves both.
 *
 * 🔴 `resolveBranchId` moved out of `server/services/booking.ts` on 2026-07-28,
 * when event tickets became its second caller, and it needed a test of its own
 * the moment it did. Before the move it was exercised only incidentally, by
 * booking tests whose product fixtures all carried a `branchIds` array, so the
 * FALLBACK path had never actually run in a test at all. That fallback is not a
 * nicety: the events hall ships an empty `branchIds` while the other three
 * products name the branch, so it is the path taken by MAZJ's single most
 * valuable product.
 *
 * ⚠️ `./client` is mocked rather than `./catalog`'s own `listBranches`. A
 * function calling a sibling in the SAME module uses its local binding, not the
 * module registry, so `vi.mock` on `./catalog` would be ignored by the very
 * call this test is about. Mocking the layer underneath is what actually
 * intercepts it.
 */

const rekazRequest = vi.fn();
const logError = vi.fn();

vi.mock("./client", () => ({
  rekazRequest: (...args: unknown[]) => rekazRequest(...args),
}));

// Mocked so the truncation alarm can be asserted on directly. `log.error`
// writes a JSON line to `console.error`, and asserting on that is asserting on
// a transport rather than on the decision the code actually made.
vi.mock("../core/logger", () => ({
  log: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: (...args: unknown[]) => logError(...args),
  },
  redact: (value: unknown) => value,
}));

// 🔴 Rebound in `beforeEach` rather than imported at the top, and that is not
// ceremony. `catalog.ts` holds a module-level TTL memo for `/products`, so a
// catalog fetched by one test would still be sitting there for the next one and
// the cases below would quietly assert against a cached success.
// `vi.resetModules()` plus a fresh import is what gives every test a cold cache.
// The alternative is exporting a reset hook from production code whose only
// caller is a test, which is a worse trade.
let resolveBranchId: typeof import("./catalog").resolveBranchId;
let listProducts: typeof import("./catalog").listProducts;

function product(branchIds: string[]): RekazProduct {
  return {
    id: "p",
    name: "x",
    nameAr: "x",
    nameEn: "x",
    description: null,
    shortDescription: null,
    slug: "qaah-alfaalyat-almaarj",
    type: 0,
    typeString: "Reservation",
    amount: 690,
    duration: 120,
    pricing: [],
    customFields: [],
    productProviders: [],
    branchIds,
    isOutOfStock: false,
    maximumQuantityPerOrder: 1,
  };
}

beforeEach(async () => {
  rekazRequest.mockReset();
  logError.mockReset();
  vi.resetModules();
  ({ resolveBranchId, listProducts } = await import("./catalog"));
});

describe("resolveBranchId", () => {
  it("uses the branch the product names, without asking Rekaz", async () => {
    const result = await resolveBranchId(product(["branch-from-product"]));

    expect(result).toEqual({ ok: true, value: "branch-from-product" });
    // The common path must not cost a network round trip on a tenant that
    // answers between 1.2 and 10.8 seconds.
    expect(rekazRequest).not.toHaveBeenCalled();
  });

  /**
   * 🔴 The events hall. Reading `branchIds[0]` and stopping there would return
   * `undefined` as a branch id and break booking for the highest-value product
   * in the catalog.
   */
  it("falls back to the tenant's only branch when the product names none", async () => {
    rekazRequest.mockResolvedValue({
      ok: true,
      value: [{ id: "the-only-branch", name: "MAZJ" }],
    });

    const result = await resolveBranchId(product([]));

    expect(result).toEqual({ ok: true, value: "the-only-branch" });
    expect(rekazRequest).toHaveBeenCalledWith({ path: "/branches" });
  });

  it("passes an upstream failure through rather than guessing a branch", async () => {
    rekazRequest.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "Rekaz timed out" },
    });

    const result = await resolveBranchId(product([]));

    expect(result.ok).toBe(false);
  });

  it("refuses rather than billing nothing when Rekaz reports no branches", async () => {
    // An empty list is not an error from Rekaz's side, and treating it as one
    // is the only safe reading: a booking has to be billed against something.
    rekazRequest.mockResolvedValue({ ok: true, value: [] });

    const result = await resolveBranchId(product([]));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("internal");
  });

  it("🔴 asks Rekaz every time, because this decides which branch takes the money", async () => {
    // `/products` is memoised and `/branches` deliberately is not. This is the
    // fallback the events hall takes on every one of its bookings, and what it
    // returns is billed against, so it stays live. Pinned because the obvious
    // "while we are here" follow-up is to cache it for symmetry.
    rekazRequest.mockResolvedValue({
      ok: true,
      value: [{ id: "the-only-branch", name: "MAZJ" }],
    });

    await resolveBranchId(product([]));
    await resolveBranchId(product([]));

    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });
});

/**
 * The catalog memo.
 *
 * 🔴 What it closes is a customer-visible wait, not a cost line. `client.ts`
 * sends `cache: "no-store"` and nothing sat in front of it, so a visitor who
 * opened a booking page, changed the duration twice and submitted paid FOUR
 * sequential full-catalog downloads of an endpoint measured between 1.2s and
 * 10.8s, for data that changes about monthly.
 *
 * 🔴 And the first test below is the one that matters most. The same call
 * resolves the price id both billing paths POST to Rekaz, and a price id rotates
 * whenever anyone edits an amount in the Rekaz dashboard, so a cached read on
 * that path is a 400 at the last click of a purchase. The memo is therefore
 * opt-IN: forgetting the parameter costs a slow page, never a wrong charge.
 */
describe("listProducts memo", () => {
  const page = { totalCount: 1, items: [{ id: "p1", slug: "s" }] };

  it("🔴 reads LIVE by default, so a caller that forgets cannot bill a stale price", async () => {
    rekazRequest.mockResolvedValue({ ok: true, value: page });

    await listProducts();
    await listProducts();
    await listProducts();

    expect(rekazRequest).toHaveBeenCalledTimes(3);
  });

  it("asks Rekaz once and serves the rest from memory when the caller opts in", async () => {
    rekazRequest.mockResolvedValue({ ok: true, value: page });

    await listProducts({ cached: true });
    await listProducts({ cached: true });
    await listProducts({ cached: true });

    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });

  it("stops reusing the copy once it is a minute old", async () => {
    rekazRequest.mockResolvedValue({ ok: true, value: page });
    vi.useFakeTimers();
    try {
      await listProducts({ cached: true });
      vi.advanceTimersByTime(59_000);
      await listProducts({ cached: true });
      expect(rekazRequest).toHaveBeenCalledTimes(1);

      // Past the TTL. Without this the "cache" is a permanent snapshot, and a
      // price edited in the Rekaz dashboard would never reach the site at all.
      vi.advanceTimersByTime(2_000);
      await listProducts({ cached: true });
      expect(rekazRequest).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("🔴 shares ONE download between callers that arrive together", async () => {
    // Asserted on the DEFAULT, live path, because that is where it matters: the
    // whole point is not to fire several full-catalog downloads at once at an
    // upstream that degrades sharply under concurrency (six parallel calls once
    // hung an endpoint past two minutes that answered in 1.5s alone).
    let release: (value: unknown) => void = () => {};
    rekazRequest.mockReturnValueOnce(
      new Promise<unknown>((resolve) => {
        release = resolve;
      })
    );

    const inFlight = [listProducts(), listProducts(), listProducts()];
    expect(rekazRequest).toHaveBeenCalledTimes(1);

    release({ ok: true, value: page });
    const results = await Promise.all(inFlight);

    expect(results.every((r) => r.ok)).toBe(true);
    expect(rekazRequest).toHaveBeenCalledTimes(1);
  });

  it("🔴 never stores a failure", async () => {
    // Caching an `upstream_unavailable` would turn one Rekaz blip into a full
    // minute of "booking unavailable" on every space page, with the upstream
    // already healthy again and nothing anywhere to say why.
    rekazRequest
      .mockResolvedValueOnce({
        ok: false,
        error: { code: "upstream_unavailable", message: "Rekaz timed out" },
      })
      .mockResolvedValueOnce({ ok: true, value: page });

    expect((await listProducts({ cached: true })).ok).toBe(false);
    expect((await listProducts({ cached: true })).ok).toBe(true);
    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });

  it("lets a caller demand a live read even where one is cached", async () => {
    // The shape a billing call site should use, so that reading it teaches the
    // requirement rather than relying on which way the default points today.
    rekazRequest.mockResolvedValue({ ok: true, value: page });

    await listProducts({ cached: true });
    await listProducts({ cached: true, fresh: true });

    expect(rekazRequest).toHaveBeenCalledTimes(2);
  });

  it("sends an explicit page size instead of taking Rekaz's default", async () => {
    rekazRequest.mockResolvedValue({ ok: true, value: page });

    await listProducts();

    expect(rekazRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/products",
        query: expect.objectContaining({ maxResultCount: REKAZ_PAGE_MAX }),
      })
    );
  });

  it("🔴 shouts when Rekaz returns fewer products than it says it has", async () => {
    // A short page is not an error from Rekaz's side and nothing else would ever
    // notice: the space whose product fell off the end simply answers "booking
    // unavailable" while the product sits plainly in the Rekaz dashboard.
    rekazRequest.mockResolvedValue({
      ok: true,
      value: { totalCount: 137, items: [{ id: "p1" }] },
    });

    await listProducts();

    expect(logError).toHaveBeenCalledWith("rekaz.catalog.truncated", {
      returned: 1,
      totalCount: 137,
      pageSize: REKAZ_PAGE_MAX,
    });
  });
});
