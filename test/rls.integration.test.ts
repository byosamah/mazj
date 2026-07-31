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
  const TABLES = [
    "idempotency_keys",
    "rate_limit_counters",
    "startup_applications",
    "events",
    "event_registrations",
    // 🔴 `bookings` is the sharpest one on this list. Every row pairs a live
    // Rekaz payment link, which anyone holding it can pay, with a salted hash
    // of the buyer's mobile. Reachable by the publishable key it would be a
    // purchase history served to whoever asked.
    "bookings",
  ] as const;

  describe("the publishable key cannot reach any table", () => {
    it.each(TABLES)("cannot read %s", async (table) => {
      // ⚠️ The cast is a stand-in for generated types, not a shortcut.
      // `bookings` is live in Postgres but absent from
      // `server/supabase/types.gen.ts`, because regenerating that file runs
      // `postgres-meta` in a container and Docker was not available when the
      // table shipped. `npm run db:types` with Docker running removes the need
      // for this line. Until then a table would silently fall out of this
      // sweep, which is the one thing this suite exists to prevent, so the
      // string list stays the source of truth and the client is loosened.
      // 🔴 Cast the CLIENT, never the method: `from` reads `this.rest`, so
      // pulling it off the object unbinds it and every row here fails with
      // "cannot read properties of undefined", which reads exactly like a
      // passing security test.
      const client = supabasePublic() as unknown as {
        from: (t: string) => {
          select: (columns: string) => PromiseLike<{
            data: unknown[] | null;
            error: unknown;
          }>;
        };
      };
      const { data, error } = await client.from(table).select("*");

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

    /**
     * 🔴 The startups table is the one on this list holding real personal data:
     * a founder's name, email, mobile and a description of an unlaunched
     * business. Reading it is a PDPL breach and a competitive leak in the same
     * request, so "closed" here has to be proven, not configured.
     */
    it("cannot insert a startup application", async () => {
      const { error } = await supabasePublic().from("startup_applications").insert({
        reference: "MZ-AAAAAA",
        founder_name: "Attacker",
        startup_name: "Attacker",
        email: "attacker@example.com",
        phone_e164: "+966500000000",
        pitch: "This should never reach the table at all.",
        stage: "idea",
        team_size: 1,
        space: "shared_seat",
      });

      expect(error).not.toBeNull();
    });

    it("cannot approve itself an offer code", async () => {
      // The write that would matter most: flipping a row to `approved` mints a
      // code MAZJ never agreed to and emails it out on the next resend.
      const { error } = await supabasePublic()
        .from("startup_applications")
        .update({ status: "approved", code: "MAZJ-AAAA-AAAA" })
        .neq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).not.toBeNull();
    });

    it("cannot delete a startup application", async () => {
      const { error } = await supabasePublic()
        .from("startup_applications")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      expect(error).not.toBeNull();
    });

    /**
     * 🔴 `events` holds 41 published rows, so "closed" here is not the usual
     * empty-table tautology: if grants were ever restored, this read would
     * return real data and the assertion above would genuinely fail. That makes
     * it the strongest row in this file.
     *
     * It also matters more than it looks for a table whose contents are
     * PUBLIC anyway: the rows carry DRAFT events too, which are unannounced
     * programme plans, and `status` is not a filter anonymous PostgREST would
     * apply for us.
     */
    it("cannot publish itself an event", async () => {
      const { error } = await supabasePublic().from("events").insert({
        slug: "attacker-event",
        status: "published",
        title_en: "Attacker",
        title_ar: "Attacker",
        summary_en: "This should never reach the table at all.",
        summary_ar: "This should never reach the table at all.",
        starts_at: "2030-01-01T09:00:00Z",
        ends_at: "2030-01-01T11:00:00Z",
      });

      expect(error).not.toBeNull();
    });

    /**
     * 🔴 The registrations table is the other one holding real personal data:
     * a member of the public's name, mobile number and email. Reading it is a
     * PDPL breach; writing to it mints seats at an event.
     */
    it("cannot register itself for an event", async () => {
      const { error } = await supabasePublic()
        .from("event_registrations")
        .insert({
          event_id: "00000000-0000-0000-0000-000000000000",
          full_name: "Attacker",
          phone_e164: "+966500000000",
        });

      expect(error).not.toBeNull();
    });

    it("cannot confirm a registration it never paid for", async () => {
      const { error } = await supabasePublic()
        .from("event_registrations")
        .update({ status: "confirmed", hold_expires_at: null })
        .neq("id", "00000000-0000-0000-0000-000000000000");

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

    /**
     * 🔴 `event_claim_seat` is `SECURITY DEFINER`: it writes a registration row
     * with the table owner's privileges, so an anonymous EXECUTE grant would
     * hand the public a way to write into a table RLS otherwise closes
     * completely. It is the single most dangerous function in the schema.
     */
    it("cannot call event_claim_seat", async () => {
      const { error } = await supabasePublic().rpc("event_claim_seat", {
        p_event_id: "00000000-0000-0000-0000-000000000000",
        p_full_name: "Attacker",
        p_phone_e164: "+966500000000",
        p_locale: "en",
        p_hold_seconds: 0,
        // Supabase's generator types every `text` parameter as non-nullable,
        // because a SQL signature does not record nullability. Both accept null
        // in Postgres; the cast states the gap. Same note as `server/db/events.ts`.
        p_email: null as unknown as string,
        p_ip_hash: null as unknown as string,
      });

      expect(error).not.toBeNull();
    });

    it("cannot call event_expire_holds", async () => {
      // Writes too: it would let anybody release every held seat at an event,
      // which is a denial of somebody else's paid-for place.
      const { error } = await supabasePublic().rpc("event_expire_holds", {
        p_event_id: "00000000-0000-0000-0000-000000000000",
      });

      expect(error).not.toBeNull();
    });

    it("cannot call event_seats_taken", async () => {
      // Read-only and it leaks only counts, but an endpoint nobody meant to
      // publish is an endpoint nobody is watching.
      const { error } = await supabasePublic().rpc("event_seats_taken", {
        p_event_ids: ["00000000-0000-0000-0000-000000000000"],
      });

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
