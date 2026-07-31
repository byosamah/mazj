import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A ticketed event may not be registered for on this site.
 *
 * 🔴 THIS IS AN ACCESS-CONTROL TEST, not a tidiness one, and the reason it
 * exists is that the page it protects looks like it already does the job.
 *
 * Since 2026-07-30 a paid event renders a LINK to the Rekaz storefront instead
 * of a form, because Rekaz publishes no write endpoint for a one-time product.
 * It is tempting to conclude the write path is therefore unreachable. It is not:
 * `submitRegistration` is a Server Action, which is a public POST endpoint
 * reachable by its id straight out of the client bundle, and the only thing the
 * caller supplies is a slug. So without the guard below, anyone could post a
 * paid event's slug and be handed a FREE confirmed seat, then turn up at the
 * door holding it.
 *
 * The two assertions that matter, and both are load-bearing:
 *
 * 1. It is REFUSED at all.
 * 2. It is refused BEFORE `claimSeat` is called. A refusal that happens after
 *    the row is written is not a refusal, it is a cleanup problem, and the seat
 *    would already have been counted against the event by everything that reads
 *    `event_seats_taken`.
 */

const claimSeat = vi.fn();
const releaseSeat = vi.fn();
const getEventBySlug = vi.fn();

// 🔴 Mocked at the DB layer, one level BELOW the module under test. A `vi.mock`
// cannot intercept a call between two functions inside the same module, so
// mocking anything in `event-registration.ts` itself would silently do nothing.
vi.mock("../db/events", () => ({
  claimSeat: (...args: unknown[]) => claimSeat(...args),
  releaseSeat: (...args: unknown[]) => releaseSeat(...args),
  getEventBySlug: (...args: unknown[]) => getEventBySlug(...args),
}));

const { registerForEvent } = await import("./event-registration");
const { ok } = await import("../core/result");

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "event-id",
    slug: "zz-test",
    status: "published",
    title: { en: "T", ar: "ت" },
    summary: { en: "S", ar: "س" },
    description: { en: null, ar: null },
    host: { en: null, ar: null },
    location: { en: null, ar: null },
    series: null,
    edition: null,
    // Far enough out that `registrationIsOpen` cannot be the thing refusing.
    startsAt: "2099-01-01T10:00:00+00:00",
    endsAt: "2099-01-01T12:00:00+00:00",
    datePrecision: "exact",
    posterPath: null,
    capacity: 30,
    rekazPriceImmutableId: null,
    ticketAmount: null,
    createdAt: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

const request = {
  eventSlug: "zz-test",
  customer: { name: "Test Person", mobile: "+966534600488" },
  locale: "en",
  // No IP, so the origin rate limiter is skipped and cannot be what refuses.
  ip: { ip: null, attested: false },
};

describe("registerForEvent, on a ticketed event", () => {
  beforeEach(() => {
    claimSeat.mockReset();
    releaseSeat.mockReset();
    getEventBySlug.mockReset();
  });

  it("refuses, and never reaches the seat claim", async () => {
    getEventBySlug.mockResolvedValue(
      ok(event({ rekazPriceImmutableId: "3a22bf80-6d12-fdab-c1c5-fa9ac86fc0b0" }))
    );

    const result = await registerForEvent(request);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.error.code).toBe("conflict");

    // 🔴 The reason rides in `fields` because `ErrorCode` is a closed union and
    // "closed", "fully booked" and "bought elsewhere" are all `conflict`. The
    // page renders `error.conflict_ticketed` off this exact string, so changing
    // it silently falls back to the generic conflict copy.
    expect(result.error.fields?.reason).toBe("ticketed");

    // The whole point. A refusal after the write is not a refusal.
    expect(claimSeat).not.toHaveBeenCalled();
    expect(releaseSeat).not.toHaveBeenCalled();
  });

  it("still lets a free event through to the seat claim", async () => {
    // The control. Without it, a guard that refused EVERY event would pass the
    // test above while quietly breaking every free sign-up on the site.
    getEventBySlug.mockResolvedValue(ok(event()));
    claimSeat.mockResolvedValue(
      ok({ outcome: "duplicate", registrationId: "r1", seatsLeft: 29 })
    );

    const result = await registerForEvent(request);

    expect(claimSeat).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.value.kind).toBe("already_registered");
  });

  it("passes holdSeconds 0, because nothing holds a seat for payment now", async () => {
    getEventBySlug.mockResolvedValue(ok(event()));
    claimSeat.mockResolvedValue(
      ok({ outcome: "duplicate", registrationId: "r1", seatsLeft: 29 })
    );

    await registerForEvent(request);

    expect(claimSeat).toHaveBeenCalledWith(
      expect.objectContaining({ holdSeconds: 0 })
    );
  });
});
