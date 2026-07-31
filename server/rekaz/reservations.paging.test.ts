import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchAllReservations, REKAZ_PAGE_MAX } from "./reservations";
import type { RekazReservation } from "./types";

/**
 * Paging over `GET /reservations`, which had no mocked test at all until
 * 2026-07-28 and was losing a third of the tenant on every dashboard render.
 *
 * 🔴 THE BUG THIS SUITE EXISTS FOR. The old loop stopped after 4 pages, i.e.
 * 400 rows, against a tenant already holding 562, and it stopped again once a
 * page's oldest `creationTime` passed 180 days. Both cuts are measured in
 * CREATION time while every consumer filters on `startAt`, so an events hall
 * booked in March for a wedding in September fell through both of them: the
 * admin board rendered the hall as free while the customer was standing in it.
 * When the lookback cut fired first, the truncation warning was skipped
 * entirely, so the worst case logged nothing at all.
 *
 * ⚠️ `./client` is mocked rather than `./reservations`'s own `listReservations`.
 * `fetchAllReservations` calls a sibling in the SAME module through its local
 * binding, not the module registry, so mocking `./reservations` would be
 * ignored by the very call under test. Mocking the layer underneath is what
 * actually intercepts it. Same reasoning as `catalog.test.ts`.
 */

type RekazCall = { path: string; query?: Record<string, unknown> };

const rekazRequest = vi.fn();

vi.mock("./client", () => ({
  rekazRequest: (...args: unknown[]) => rekazRequest(...args),
}));

function reservation(
  overrides: Partial<RekazReservation> = {}
): RekazReservation {
  return {
    id: "res-1",
    startAt: "2026-09-12T15:00:00Z",
    endAt: "2026-09-12T18:00:00Z",
    status: "Pending",
    customStatus: null,
    customerId: "cus-1",
    customerName: "",
    customerMobile: "966512345678",
    reservationNumber: 4211,
    productName: "Events hall",
    priceName: "Evening",
    quantity: 1,
    providers: null,
    branchId: "b1",
    branchName: "MAZJ",
    orderPaymentStatusString: "Unpaid",
    reservationTotalAmount: 690,
    remainingAmount: 690,
    cancellationReason: null,
    creationTime: "2026-03-02T09:00:00Z",
    source: null,
    ...overrides,
  };
}

function skipOf(options: RekazCall): number {
  return Number(options.query?.skipCount ?? 0);
}

/**
 * One page of a fake tenant of `totalCount` rows. Every row gets a distinct id
 * derived from its absolute position, so a duplicated or skipped window shows
 * up in the assertions rather than hiding inside a matching length.
 */
function pageOf(
  totalCount: number,
  skip: number,
  rowOverrides: Partial<RekazReservation> = {}
) {
  const count = Math.max(0, Math.min(REKAZ_PAGE_MAX, totalCount - skip));
  return {
    totalCount,
    items: Array.from({ length: count }, (_, i) =>
      reservation({ id: `r${skip + i}`, ...rowOverrides })
    ),
  };
}

function serveTenant(
  totalCount: number,
  rowOverrides: Partial<RekazReservation> = {}
): void {
  rekazRequest.mockImplementation(async (options: RekazCall) => ({
    ok: true,
    value: pageOf(totalCount, skipOf(options), rowOverrides),
  }));
}

function skipCounts(): number[] {
  return rekazRequest.mock.calls.map((call) => skipOf(call[0] as RekazCall));
}

beforeEach(() => {
  rekazRequest.mockReset();
});

describe("fetchAllReservations", () => {
  it("🔴 pages to Rekaz's own totalCount, not to a fixed page count", async () => {
    // 562 rows on the live tenant against a 4-page cap: 162 real reservations
    // dropped on every single call, silently, with the occupancy board
    // rendering the gap as free rooms.
    serveTenant(562);

    const result = await fetchAllReservations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(562);
    expect(new Set(result.value.items.map((r) => r.id)).size).toBe(562);
    expect(result.value.totalCount).toBe(562);
    expect(result.value.truncated).toBe(false);
    // Sequential, one page at a time, stopping the moment it has them all.
    // 🔴 The order of this array is the assertion: Rekaz degrades badly under
    // concurrent load and that same API serves mazj.sa's live checkout.
    expect(skipCounts()).toEqual([0, 100, 200, 300, 400, 500]);
  });

  it("asks once when the whole tenant fits on one page", async () => {
    serveTenant(42);

    const result = await fetchAllReservations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(42);
    expect(result.value.truncated).toBe(false);
    expect(skipCounts()).toEqual([0]);
  });

  it("🔴 keeps paging past rows created years ago", async () => {
    // The deleted creation-time cutoff. It can never bound a start-time
    // question: the long-lead booking is BOTH old enough to be cut and still in
    // the future, which is exactly the row the occupancy board must not miss.
    serveTenant(250, { creationTime: "2023-01-04T09:00:00Z" });

    const result = await fetchAllReservations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(250);
    expect(result.value.truncated).toBe(false);
  });

  it("🔴 stops at the sanity ceiling and SAYS SO", async () => {
    serveTenant(5_000);

    const result = await fetchAllReservations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 20 pages of 100. The ceiling sits an order of magnitude above today's
    // volume, so reaching it means MAZJ grew, not that the cap is wrong. The
    // flag is what makes that visible on screen instead of in a log nobody
    // reads.
    expect(result.value.items).toHaveLength(2_000);
    expect(result.value.totalCount).toBe(5_000);
    expect(result.value.truncated).toBe(true);
    expect(rekazRequest).toHaveBeenCalledTimes(20);
  });

  it("🔴 flags truncation when a page fails, rather than only logging it", async () => {
    // A partial list still beats an error nobody can act on, but the reader has
    // to be able to tell one from the other. "0 bookings" and "we lost half the
    // table" must not render identically.
    rekazRequest.mockImplementation(async (options: RekazCall) =>
      skipOf(options) === 300
        ? {
            ok: false,
            error: { code: "upstream_unavailable", message: "Rekaz timed out" },
          }
        : { ok: true, value: pageOf(562, skipOf(options)) }
    );

    const result = await fetchAllReservations();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(300);
    expect(result.value.totalCount).toBe(562);
    expect(result.value.truncated).toBe(true);
  });

  it("returns the failure when the very first page fails", async () => {
    // Nothing was collected, so there is no partial answer to offer and the
    // dashboard must show "could not reach Rekaz" rather than a confident zero.
    rekazRequest.mockResolvedValue({
      ok: false,
      error: { code: "upstream_unavailable", message: "Rekaz timed out" },
    });

    const result = await fetchAllReservations();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("upstream_unavailable");
  });
});
