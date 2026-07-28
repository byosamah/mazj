import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The availability retry must actually issue a request.
 *
 * 🔴 It shipped inert. The handler called `setLoaded(null)`, which looks like
 * "clear it and refetch" and is the opposite: the fetch lives in an effect keyed
 * on the price, the space and the flow, none of which a retry changes, so no
 * request was made. Clearing `loaded` also flipped `loadingSlots` true and
 * `slotsFailed` false, so the error box unmounted and "checking what is free"
 * rendered forever. Worse than the dead end the retry was added to fix, and only
 * a full reload escaped it.
 *
 * Asserted on the source rather than by rendering, because the defect is in the
 * DEPENDENCY LIST. A render test that mocked the fetch would pass against the
 * broken version: the bug is that the effect never re-runs, not that the fetch
 * misbehaves.
 */
const SRC = readFileSync("components/booking/BookingFlow.tsx", "utf8");

describe("availability retry", () => {
  it("🔴 the retry handler feeds something the fetch effect depends on", () => {
    const handler = /onClick=\{\(\) => (setRetryNonce\(\(n\) => n \+ 1\)|[^}]+)\}/.exec(SRC);
    expect(handler, "retry button handler not found").not.toBeNull();

    const deps = /\}, \[isReservation, priceId, space\.slug([^\]]*)\]\);/.exec(SRC);
    expect(deps, "availability effect dependency list not found").not.toBeNull();

    expect(
      deps![1],
      "the fetch effect depends only on price/space/flow, so a retry cannot re-run it"
    ).toContain("retryNonce");
    expect(
      handler![0],
      "retry must bump the nonce the effect depends on, not clear `loaded`"
    ).toContain("setRetryNonce");
  });

  it("does not clear `loaded` on retry, which would blank the explanation", () => {
    // Keeping the error visible until the new result lands is deliberate: the
    // visitor should not watch the reason for the failure disappear.
    expect(SRC).not.toContain("onClick={() => setLoaded(null)}");
  });
});
