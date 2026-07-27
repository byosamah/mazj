import { afterAll, describe, expect, it } from "vitest";

import { supabaseAdmin } from "@/server/supabase/admin";
import { supabasePublic } from "@/server/supabase/public";

import { hasSupabaseCredentials } from "./setup";

/**
 * Proves the database is actually closed.
 *
 * "RLS is enabled" is a configuration claim, and configuration claims rot. The
 * migration enables RLS, creates no policies and revokes privileges from `anon`
 * and `authenticated`, and every one of those three could be undone by a
 * well-meaning change six months from now without anybody noticing.
 *
 * So this test does what an attacker would do. It takes the publishable key,
 * which is public by design and printed in every browser bundle the day there
 * is a browser client, and tries to read and write every table. Each attempt
 * must fail. If someone opens a table wider than they realised, this goes red.
 *
 * Skipped rather than failed without credentials: a fresh clone has no keys,
 * and a red suite that means "you have not configured anything yet" trains
 * people to ignore red suites.
 */
describe.skipIf(!hasSupabaseCredentials)("row level security", () => {
  const createdLeadIds: string[] = [];

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await supabaseAdmin().from("leads").delete().in("id", createdLeadIds);
    }
  });

  describe("the publishable key cannot reach any table", () => {
    it.each(["leads", "idempotency_keys", "rate_limit_counters"] as const)(
      "cannot read %s",
      async (table) => {
        const { data, error } = await supabasePublic().from(table).select("*");

        // Either PostgREST refuses outright (grants revoked) or RLS filters
        // every row away. Both are closed; returning rows is not.
        if (!error) expect(data ?? []).toHaveLength(0);
        expect(data ?? []).toHaveLength(0);
      }
    );

    it("cannot insert a lead", async () => {
      const { error } = await supabasePublic()
        .from("leads")
        .insert({ interest: "other", email: "attacker@example.com" });

      expect(error).not.toBeNull();
    });

    it("cannot call the rate limiter, which would let it be exhausted", async () => {
      const { error } = await supabasePublic().rpc("rate_limit_hit", {
        p_bucket: "rls-test:probe",
        p_limit: 1,
        p_window_seconds: 60,
      });

      expect(error).not.toBeNull();
    });

    it("cannot delete leads", async () => {
      const { error } = await supabasePublic()
        .from("leads")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).not.toBeNull();
    });
  });

  describe("the secret key can, which is what makes the test meaningful", () => {
    it("inserts and reads back a lead", async () => {
      const { data, error } = await supabaseAdmin()
        .from("leads")
        .insert({
          interest: "meeting_room",
          email: "rls-test@example.com",
          source: "vitest",
        })
        .select("id, interest, status")
        .single();

      expect(error).toBeNull();
      expect(data?.interest).toBe("meeting_room");
      // Confirms the column default, not just the value we sent.
      expect(data?.status).toBe("new");

      if (data?.id) createdLeadIds.push(data.id);
    });
  });

  describe("database constraints hold regardless of the client", () => {
    it("refuses a lead with no contact channel", async () => {
      const { error } = await supabaseAdmin()
        .from("leads")
        .insert({ interest: "other", source: "vitest" });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("leads_needs_a_contact_channel");
    });

    it("refuses a phone that is not E.164", async () => {
      const { error } = await supabaseAdmin()
        .from("leads")
        .insert({
          interest: "other",
          phone_e164: "0534600488",
          source: "vitest",
        });

      expect(error).not.toBeNull();
    });

    it("refuses an interest outside the allowed set", async () => {
      const { error } = await supabaseAdmin()
        .from("leads")
        // Deliberately invalid: the check constraint is the subject here.
        .insert({
          interest: "penthouse" as never,
          email: "x@example.com",
          source: "vitest",
        });

      expect(error).not.toBeNull();
    });
  });
});
