import { describe, expect, it } from "vitest";

import { supabaseAdmin } from "@/server/supabase/admin";
import { supabasePublic } from "@/server/supabase/public";

import { hasSupabaseCredentials } from "./setup";

/**
 * Proves the database is actually closed.
 *
 * "RLS is enabled" is a configuration claim, and configuration claims rot. The
 * migrations enable RLS, create no policies and revoke privileges from `anon`
 * and `authenticated`, and every one of those three could be undone by a
 * well-meaning change six months from now without anybody noticing.
 *
 * So this test does what an attacker would do. It takes the publishable key,
 * which is public by design and would be printed in every browser bundle the day
 * there is a browser client, and tries to read, write and call everything. Each
 * attempt must fail. If someone opens a table or a function wider than they
 * realised, this goes red.
 *
 * Skipped rather than failed without credentials: a fresh clone has no keys, and
 * a red suite that means "you have not configured anything yet" trains people to
 * ignore red suites.
 */
describe.skipIf(!hasSupabaseCredentials)("row level security", () => {
  const TABLES = ["idempotency_keys", "rate_limit_counters"] as const;

  describe("the publishable key cannot reach any table", () => {
    it.each(TABLES)("cannot read %s", async (table) => {
      const { data, error } = await supabasePublic().from(table).select("*");

      // Either PostgREST refuses outright (grants revoked) or RLS filters every
      // row away. Both are closed; returning rows is not.
      if (!error) expect(data ?? []).toHaveLength(0);
      expect(data ?? []).toHaveLength(0);
    });

    // Each table is keyed differently (`idempotency_keys` on `id`,
    // `rate_limit_counters` on `bucket`), so the filter column is per-table
    // rather than shared. A delete needs SOME filter or PostgREST refuses it for
    // its own reasons, which would pass this test without proving anything.
    it("cannot delete idempotency keys", async () => {
      const { error } = await supabasePublic()
        .from("idempotency_keys")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).not.toBeNull();
    });

    it("cannot delete rate limit counters", async () => {
      const { error } = await supabasePublic()
        .from("rate_limit_counters")
        .delete()
        .neq("bucket", "___nonexistent___");

      expect(error).not.toBeNull();
    });

    it("cannot insert an idempotency key", async () => {
      const { error } = await supabasePublic().from("idempotency_keys").insert({
        scope: "attacker",
        idempotency_key: "attacker-key-1",
        request_fingerprint: "x",
      });

      expect(error).not.toBeNull();
    });
  });

  describe("the publishable key cannot call any function", () => {
    /**
     * Postgres grants EXECUTE to PUBLIC by default, which would expose these
     * over PostgREST's /rpc/ endpoint. Exhausting the rate limiter anonymously
     * would defeat the thing that protects every future endpoint.
     */
    it("cannot call rate_limit_hit", async () => {
      const { error } = await supabasePublic().rpc("rate_limit_hit", {
        p_bucket: "rls-test:probe",
        p_limit: 1,
        p_window_seconds: 60,
      });

      expect(error).not.toBeNull();
    });

    it("cannot call idempotency_begin", async () => {
      const { error } = await supabasePublic().rpc("idempotency_begin", {
        p_scope: "rls-test",
        p_key: "rls-test-key",
        p_fingerprint: "x",
      });

      expect(error).not.toBeNull();
    });

    it("cannot call health_ping", async () => {
      const { error } = await supabasePublic().rpc("health_ping");

      expect(error).not.toBeNull();
    });
  });

  describe("the secret key can, which is what makes the test meaningful", () => {
    it("reaches the liveness probe", async () => {
      const { data, error } = await supabaseAdmin().rpc("health_ping");

      expect(error).toBeNull();
      expect(Date.parse(String(data))).not.toBeNaN();
    });

    it("drives the rate limiter, and the limit is exact", async () => {
      const bucket = "rls-test:limit";
      const results: boolean[] = [];

      for (let i = 0; i < 4; i++) {
        const { data, error } = await supabaseAdmin().rpc("rate_limit_hit", {
          p_bucket: bucket,
          p_limit: 3,
          p_window_seconds: 60,
        });
        expect(error).toBeNull();
        const row = Array.isArray(data) ? data[0] : data;
        results.push(Boolean(row?.allowed));
      }

      expect(results).toEqual([true, true, true, false]);

      await supabaseAdmin()
        .from("rate_limit_counters")
        .delete()
        .eq("bucket", bucket);
    });
  });

  describe("the leads table is gone and must stay gone", () => {
    /**
     * `leads` was the foundation's proving slice, dropped once it had done its
     * job because nothing on the site used it. This asserts the drop actually
     * took, so a stale migration or a hand-run SQL snippet cannot quietly bring
     * a speculative table back into production.
     */
    it("no longer exists", async () => {
      const { error } = await supabaseAdmin()
        .from("leads" as never)
        .select("*")
        .limit(1);

      expect(error).not.toBeNull();
    });
  });
});
