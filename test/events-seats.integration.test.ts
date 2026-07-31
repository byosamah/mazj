import { afterAll, describe, expect, it } from "vitest";

import { supabaseAdmin } from "@/server/supabase/admin";

import { hasSupabaseCredentials } from "./setup";

/**
 * Proves an event cannot be oversold.
 *
 * The guarantee is not "the code counts carefully", it is that
 * `public.event_claim_seat` takes a row lock on the event so only one claim for
 * that event runs at a time. That property lives in Postgres and cannot be
 * tested by calling a TypeScript function: the bug it prevents only appears
 * under genuine concurrency, where two requests both read "one seat left"
 * before either writes.
 *
 * ⚠️ THIS TEST WRITES TO THE PRODUCTION DATABASE, because there is no other
 * one. It is bounded deliberately:
 *
 *   • the event is created, exercised and deleted inside this file, and the
 *     deletion cascades to its registrations;
 *   • its slug is obviously a fixture, and `afterAll` removes it even if an
 *     assertion fails;
 *   • it is dated years out, so it can never collide with a real programme;
 *   • it must be `published` for the claim function to accept it at all, so it
 *     is briefly visible on `/events`. The site is pre-launch and serving
 *     `Disallow: /`, and the window is under a second.
 *
 * Skipped rather than failed without credentials: a fresh clone has no keys.
 */

const SLUG = "zz-test-seat-race-fixture";

describe.skipIf(!hasSupabaseCredentials)("an event cannot be oversold", () => {
  afterAll(async () => {
    await supabaseAdmin().from("events").delete().eq("slug", SLUG);
  });

  async function createEvent(capacity: number | null): Promise<string> {
    // Removed first, so a previous run that died mid-test cannot fail this one
    // on the unique slug.
    await supabaseAdmin().from("events").delete().eq("slug", SLUG);

    const { data, error } = await supabaseAdmin()
      .from("events")
      .insert({
        slug: SLUG,
        status: "published",
        title_en: "Seat race fixture",
        title_ar: "Seat race fixture",
        summary_en: "Created and deleted by the test suite.",
        summary_ar: "Created and deleted by the test suite.",
        starts_at: "2099-01-01T09:00:00Z",
        ends_at: "2099-01-01T11:00:00Z",
        capacity,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    return data!.id;
  }

  function claim(eventId: string, n: number, holdSeconds = 0) {
    return supabaseAdmin().rpc("event_claim_seat", {
      p_event_id: eventId,
      p_full_name: `Racer ${n}`,
      p_email: null as unknown as string,
      p_phone_e164: `+96650000${String(n).padStart(4, "0")}`,
      p_locale: "en",
      p_ip_hash: null as unknown as string,
      p_hold_seconds: holdSeconds,
    });
  }

  const outcomeOf = (r: { data: { outcome: string }[] | null }) =>
    r.data?.[0]?.outcome;

  /**
   * 🔴 The assertion this whole file exists for.
   *
   * Twelve simultaneous requests, one seat. Counting rows and then inserting
   * from application code passes a sequential test and fails this one, because
   * the gap is BETWEEN the two statements rather than inside either.
   */
  it("sells exactly one seat to twelve simultaneous claims", async () => {
    const eventId = await createEvent(1);

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => claim(eventId, i))
    );

    const outcomes = results.map(outcomeOf);
    expect(outcomes.filter((o) => o === "claimed")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "full")).toHaveLength(11);

    // And the database agrees with what the function reported.
    const { count } = await supabaseAdmin()
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    expect(count).toBe(1);
  });

  it("tells a returning number it is already on the list", async () => {
    const eventId = await createEvent(10);

    expect(outcomeOf(await claim(eventId, 1))).toBe("claimed");
    // Reported as `duplicate`, which the service renders as good news rather
    // than an error: from the visitor's side, being already registered is.
    expect(outcomeOf(await claim(eventId, 1))).toBe("duplicate");

    const { count } = await supabaseAdmin()
      .from("event_registrations")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId);
    expect(count).toBe(1);
  });

  /**
   * 🔴 The 30-minute hold, and the reason it needs no scheduled job.
   *
   * A held seat stops counting the moment its hold lapses, because the counter
   * and the claim ask the same question. Simulated by moving the expiry into
   * the past rather than by sleeping, so the test stays fast and deterministic.
   */
  it("releases a seat whose payment hold has lapsed", async () => {
    const eventId = await createEvent(1);

    expect(outcomeOf(await claim(eventId, 1, 1800))).toBe("claimed");
    // Held, so the room is full for anybody else.
    expect(outcomeOf(await claim(eventId, 2))).toBe("full");

    await supabaseAdmin()
      .from("event_registrations")
      .update({ hold_expires_at: "2020-01-01T00:00:00Z" })
      .eq("event_id", eventId);

    // The seat is back on sale, with no sweep having run.
    const seats = await supabaseAdmin().rpc("event_seats_taken", {
      p_event_ids: [eventId],
    });
    expect(seats.data?.[0]?.taken).toBe(0);
    expect(outcomeOf(await claim(eventId, 2))).toBe("claimed");
  });

  it("refuses an event that is not published", async () => {
    const eventId = await createEvent(10);
    await supabaseAdmin()
      .from("events")
      .update({ status: "draft" })
      .eq("id", eventId);

    expect(outcomeOf(await claim(eventId, 1))).toBe("closed");
  });

  it("refuses an event that has already started", async () => {
    const eventId = await createEvent(10);
    await supabaseAdmin()
      .from("events")
      .update({
        starts_at: "2020-01-01T09:00:00Z",
        ends_at: "2020-01-01T11:00:00Z",
      })
      .eq("id", eventId);

    expect(outcomeOf(await claim(eventId, 1))).toBe("closed");
  });

  it("never runs out of seats when there is no capacity", async () => {
    const eventId = await createEvent(null);

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => claim(eventId, i))
    );

    expect(results.map(outcomeOf)).toEqual(Array(5).fill("claimed"));
    // `seats_left` is null rather than a number, so a card knows to say nothing
    // instead of "0 seats left".
    expect(results[0]!.data?.[0]?.seats_left).toBeNull();
  });

  it("reports how many are left, so a card can count down honestly", async () => {
    const eventId = await createEvent(3);

    const first = await claim(eventId, 1);
    expect(first.data?.[0]?.seats_left).toBe(2);

    const second = await claim(eventId, 2);
    expect(second.data?.[0]?.seats_left).toBe(1);
  });
});
