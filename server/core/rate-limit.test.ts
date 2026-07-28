import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("../supabase/admin", () => ({ supabaseAdmin: () => ({ rpc }) }));

const { checkRateLimits } = await import("./rate-limit");

/** One `rate_limit_hit` row. */
const row = (allowed: boolean, remaining: number) => ({
  data: [
    {
      allowed,
      remaining,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
    },
  ],
  error: null,
});

const bucket = (scope: string, identity: string) => ({
  scope,
  identity,
  limit: 8,
  windowSeconds: 3600,
});

beforeEach(() => rpc.mockReset());

describe("checkRateLimits", () => {
  /**
   * 🔴 The assertion that matters most.
   *
   * An empty list means every identity was absent: no attested address, no
   * mobile number, nothing to key on. That is not a normal browser, and it is
   * exactly the moment when opening the gate is worst. It must refuse.
   */
  it("REFUSES when there is nothing to limit on", async () => {
    const result = await checkRateLimits([]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("rate_limited");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows when every bucket allows, and reports the tightest one", async () => {
    rpc
      .mockResolvedValueOnce(row(true, 7))
      .mockResolvedValueOnce(row(true, 2));

    const result = await checkRateLimits([
      bucket("booking:create", "ip-hash"),
      bucket("booking:mobile", "mobile-hash"),
    ]);

    expect(result.ok).toBe(true);
    // 2, not 7: a caller surfacing "requests remaining" must quote the ceiling
    // the visitor will actually hit, not the roomiest one.
    if (result.ok) expect(result.value).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("refuses when any single bucket refuses", async () => {
    rpc
      .mockResolvedValueOnce(row(true, 7))
      .mockResolvedValueOnce(row(false, 0));

    const result = await checkRateLimits([
      bucket("booking:create", "ip-hash"),
      bucket("booking:mobile", "mobile-hash"),
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.allowed).toBe(false);
  });

  /**
   * Every bucket is a counter describing one actor. Short-circuiting after the
   * first refusal would let a caller who is already over the IP limit consume
   * the mobile allowance for free, which is the opposite of the intent.
   */
  it("records every bucket even once one has refused", async () => {
    rpc
      .mockResolvedValueOnce(row(false, 0))
      .mockResolvedValueOnce(row(true, 4));

    await checkRateLimits([
      bucket("booking:create", "ip-hash"),
      bucket("booking:mobile", "mobile-hash"),
    ]);

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("passes each bucket through as its own scoped key", async () => {
    rpc.mockResolvedValue(row(true, 5));

    await checkRateLimits([
      bucket("booking:create", "ip-hash"),
      bucket("booking:mobile", "mobile-hash"),
    ]);

    const keys = rpc.mock.calls.map((c) => c[1].p_bucket);
    expect(keys).toEqual([
      "booking:create:ip-hash",
      "booking:mobile:mobile-hash",
    ]);
  });

  /**
   * Fails CLOSED, inherited from `checkRateLimit`. The moment the database
   * struggles is the moment an abusive client can do the most damage, so "the
   * limiter is down, let everyone in" is precisely backwards. A half-applied
   * limit is not a limit either, so one broken bucket fails the whole check.
   */
  it("fails closed when a bucket cannot be recorded", async () => {
    rpc
      .mockResolvedValueOnce(row(true, 7))
      .mockResolvedValueOnce({ data: null, error: { message: "connection lost" } });

    const result = await checkRateLimits([
      bucket("booking:create", "ip-hash"),
      bucket("booking:mobile", "mobile-hash"),
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("upstream_unavailable");
  });

  it("works with a single bucket, which is the no-attested-address case", async () => {
    rpc.mockResolvedValueOnce(row(true, 3));

    const result = await checkRateLimits([bucket("booking:mobile", "mobile-hash")]);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.remaining).toBe(3);
  });
});
