import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOOKING } from "@/lib/links";
import { WHATSAPP_NUMBER } from "@/lib/contact";
import { STARTUP_SPACES } from "@/server/domain/startup-offer";

/**
 * The constants the startups feature duplicates across the frontend/backend
 * boundary, and the assertion that they never drift.
 *
 * 🔴 WHY DUPLICATE AT ALL. `server/` may not import `@/lib/**`: ESLint enforces
 * it, and that rule is precisely what would let `server/` be lifted into its own
 * package or its own deployed service without a rewrite. One convenience import
 * ends that property quietly.
 *
 * So the repo's standing answer is to duplicate the VALUE and test the
 * agreement, which is the shape `leads.sync.test.ts` used before `leads` was
 * dropped. A test file is exempt from the boundary because it ships to nobody.
 *
 * The failure this prevents is genuinely nasty and genuinely silent: someone
 * renames a product in `lib/links.ts`, the form keeps submitting the old value,
 * the database check constraint rejects it, and a public form starts answering
 * 503 for one of the four options while the other three work.
 */

describe("startup offer constants", () => {
  /**
   * 🔴 WRITTEN OUT, not derived by transforming one side into the other.
   *
   * A snake_case-ing of `BOOKING`'s keys gets `shared_seat` and
   * `private_office` right and then quietly produces `meeting` and `event`,
   * because the two vocabularies genuinely disagree: `lib/links.ts` names the
   * ACT (book a meeting) and the database names the ROOM (`meeting_room`). A
   * clever mapping would have hidden that, and a test that reproduces the
   * production bug in its own assertion proves nothing.
   *
   * So the correspondence is stated by hand and both sides are checked for
   * exhaustiveness. Add a fifth product and this fails until somebody decides
   * what it is called on each side, which is the whole point.
   */
  const CORRESPONDENCE: Record<keyof typeof BOOKING, (typeof STARTUP_SPACES)[number]> = {
    sharedSeat: "shared_seat",
    privateOffice: "private_office",
    meeting: "meeting_room",
    event: "event_hall",
  };

  it("mirrors the four products in lib/links.ts BOOKING, one for one", () => {
    expect(Object.keys(CORRESPONDENCE).sort()).toEqual(Object.keys(BOOKING).sort());
    expect(Object.values(CORRESPONDENCE).sort()).toEqual([...STARTUP_SPACES].sort());
    expect(STARTUP_SPACES.length).toBe(Object.keys(BOOKING).length);
  });

  it("keeps the WhatsApp number in the approval email identical to the site's", () => {
    // The approved founder is told to message MAZJ with their code. If this
    // number drifts from `lib/contact.ts`, that message goes to a line nobody
    // is reading, and the only symptom is silence from people who were told yes.
    const templates = readFileSync("server/email/templates.ts", "utf8");
    const match = templates.match(/const WHATSAPP_NUMBER = "(\d+)"/);

    expect(match, "templates.ts must declare WHATSAPP_NUMBER").not.toBeNull();
    expect(match?.[1]).toBe(WHATSAPP_NUMBER);
  });

  it("keeps the generated-identifier alphabet identical in TypeScript and SQL", () => {
    // Three copies of this character class exist: the domain module, the
    // migration's `reference` check, and the migration's `code` check. A
    // mismatch means the application generates a value its own database
    // refuses, which surfaces as a 503 on a public form.
    const domain = readFileSync("server/domain/startup-offer.ts", "utf8");
    const migration = readFileSync(
      "supabase/migrations/20260728130000_startup_applications.sql",
      "utf8"
    );

    const alphabet = domain.match(/const ALPHABET = "([^"]+)"/)?.[1];
    expect(alphabet).toBe("23456789ABCDEFGHJKLMNPQRSTUVWXYZ");

    // The SQL side states the same set as a range. THREE occurrences, not two:
    // `reference` uses one group and `code` uses two, because the code is
    // printed in a `XXXX-XXXX` pair. Counting constraints instead of
    // occurrences would have missed a half-edited `code` pattern.
    const ranges = migration.match(/\[2-9A-HJ-NP-Z\]/g) ?? [];
    expect(ranges.length).toBe(3);
    expect(migration).toContain("'^MZ-[2-9A-HJ-NP-Z]{6}$'");
    expect(migration).toContain("'^MAZJ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'");

    // And the range genuinely denotes the same 32 symbols the TypeScript lists.
    const expanded = [...(alphabet ?? "")].every((ch) => /[2-9A-HJ-NP-Z]/.test(ch));
    expect(expanded).toBe(true);
    expect(new Set(alphabet).size).toBe(32);
  });
});
