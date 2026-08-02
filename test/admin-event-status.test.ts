import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  eventOutcomeUrl,
  readEventOutcome,
  type EventOutcomeCode,
} from "@/app/admin/_lib/event-outcomes";
import {
  missingToPublish,
  type MissingForPublish,
} from "@/server/domain/events";

/**
 * The status and delete controls added to `/admin/events` on 2026-08-01.
 *
 * 🔴 This file exists because of a recorded incident rather than a policy.
 * `test/admin-booking-lookup.test.ts` was the ONLY assertion behind an admin
 * access check, was never committed, and went with the feature it guarded. The
 * controls covered here publish to the live site and delete other people's
 * sign-ups, so their rules get an assertion the moment they exist.
 *
 * What is NOT here, and why: `test/admin-page-guards.test.ts` already discovers
 * every `"use server"` export in `_lib` and fails when one does not call
 * `requireAdmin()`, so `changeEventStatus` and `removeEvent` are covered there
 * automatically and duplicating it would create a second place to update. There
 * is also no DOM environment in this repo (`vitest.config.ts` is
 * `environment: "node"`, with no jsdom and no testing-library), so the controls'
 * BEHAVIOUR is not machine-verified anywhere: only their pure rules and two
 * source properties are.
 */

const COMPLETE = {
  titleEn: "Coffee Sketch",
  titleAr: "قهوة ورسم",
  summaryEn: "An evening of drawing.",
  summaryAr: "أمسية رسم.",
};

describe("what an event must carry before it may go live", () => {
  it("passes an event with all four strings written", () => {
    expect(missingToPublish(COMPLETE)).toBeNull();
  });

  it.each([
    ["titleEn", { ...COMPLETE, titleEn: null }],
    ["titleAr", { ...COMPLETE, titleAr: null }],
    ["summaryEn", { ...COMPLETE, summaryEn: null }],
    ["summaryAr", { ...COMPLETE, summaryAr: null }],
  ])("names %s when it is null", (field, copy) => {
    expect(missingToPublish(copy)).toBe(field);
  });

  /**
   * 🔴 The whole reason this rule is a function rather than the four truthiness
   * tests it replaced, and the reason it is allowed to be STRICTER than the
   * database.
   *
   * `events_published_is_bilingual` asks only that the columns are NOT NULL, so
   * a row holding a space satisfies it and Postgres would publish an event with
   * a blank heading on both language pages. Nothing downstream would report a
   * problem: the page renders, the sitemap lists it, and the card in the
   * archive is simply empty.
   */
  it.each(["titleEn", "titleAr", "summaryEn", "summaryAr"] as const)(
    "treats a whitespace-only %s as missing, which the check constraint cannot",
    (field) => {
      expect(missingToPublish({ ...COMPLETE, [field]: "   " })).toBe(field);
    }
  );

  /**
   * The order is the form's reading order, so the field it names is the first
   * one an operator's eye reaches when they open the event to fix it. Reporting
   * the LAST missing field would send somebody to the bottom of the form and
   * then, on the next attempt, back to the top.
   */
  it("names the first missing field in the form's own reading order", () => {
    expect(
      missingToPublish({
        titleEn: null,
        titleAr: null,
        summaryEn: null,
        summaryAr: null,
      })
    ).toBe("titleEn");

    expect(
      missingToPublish({ ...COMPLETE, titleAr: null, summaryAr: null })
    ).toBe("titleAr");
  });
});

describe("the outcome a control reports back through the URL", () => {
  /**
   * 🔴 THE CROSS-MODULE CHECK, and the only one here that can catch a rename.
   *
   * `needsCode()` in `event-actions.ts` builds a code by interpolating a
   * `MissingForPublish` value into `needs-…`. TypeScript proves the result is
   * an `EventOutcomeCode`, but nothing proves the SENTENCE table in
   * `event-outcomes.ts` has an entry for it: an unknown code parses to `null`,
   * which renders no notice at all. So a blocked publish would refuse to
   * publish and then say nothing about why, which is exactly the failure the
   * owner's chosen behaviour ("say what is missing, stay put") rules out.
   */
  const FIELDS: MissingForPublish[] = [
    "titleEn",
    "titleAr",
    "summaryEn",
    "summaryAr",
  ];

  it.each(FIELDS)("has a sentence for a publish blocked on %s", (field) => {
    const outcome = readEventOutcome({ outcome: `needs-${field}` });

    expect(outcome).not.toBeNull();
    expect(outcome?.tone).toBe("destructive");
    // Every refusal has to say the event was left alone. A control that reports
    // a refusal without saying whether it half-happened is a control somebody
    // presses again, and this one sits beside a delete.
    expect(outcome?.detail).toMatch(/Nothing was changed/);
  });

  const EVERY_CODE: EventOutcomeCode[] = [
    "published",
    "drafted",
    "cancelled",
    "deleted",
    "needs-titleEn",
    "needs-titleAr",
    "needs-summaryEn",
    "needs-summaryAr",
    "gone",
    "moved",
    "failed",
  ];

  it.each(EVERY_CODE)("resolves %s to a sentence", (code) => {
    const outcome = readEventOutcome({ outcome: code });
    expect(outcome?.code).toBe(code);
    expect(outcome?.message.length).toBeGreaterThan(0);
  });

  it("reports the four successes as ok and every refusal as destructive", () => {
    const tone = (code: EventOutcomeCode) => readEventOutcome({ outcome: code })?.tone;

    // A delete is `ok`, deliberately. The tone reports whether the operator's
    // instruction was carried out, not how grave it was, and the warning about
    // a delete belongs on the control BEFORE the click, where it is.
    for (const code of ["published", "drafted", "cancelled", "deleted"] as const) {
      expect(tone(code)).toBe("ok");
    }
    for (const code of ["gone", "moved", "failed"] as const) {
      expect(tone(code)).toBe("destructive");
    }
  });

  /**
   * An unknown code is `null` rather than a generic message. A value that is not
   * in the table was not written by this application, so inventing a sentence
   * for it would report something we do not know to be true, on a page where
   * every other sentence is measured.
   */
  it.each([
    ["absent", {}],
    ["unknown", { outcome: "everything-is-fine" }],
    ["empty", { outcome: "" }],
    ["a near miss", { outcome: "needs-title" }],
  ])("renders nothing for %s", (_case, query) => {
    expect(readEventOutcome(query)).toBeNull();
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(readEventOutcome({ outcome: ["published", "deleted"] })?.code).toBe(
      "published"
    );
  });
});

describe("the event id carried beside an outcome", () => {
  const REAL = "3a14a1b1-1f18-24e9-bfb1-a77ce84ff72a";

  it("survives when it is a real uuid", () => {
    expect(readEventOutcome({ outcome: "published", event: REAL })?.eventId).toBe(
      REAL
    );
  });

  /**
   * 🔴 The id is rendered into an href on an authenticated page, so anything
   * that is not a uuid is DROPPED rather than escaped. The notice then simply
   * carries no link, which costs a convenience; passing it through would hand a
   * crafted URL a link on a page the operator trusts.
   */
  it.each([
    "../../somewhere",
    "https://example.com",
    "javascript:alert(1)",
    "not-a-uuid",
    "",
  ])("is dropped when it is %s", (event) => {
    expect(readEventOutcome({ outcome: "published", event })?.eventId).toBeUndefined();
  });
});

describe("where a control sends the operator afterwards", () => {
  const REAL = "3a14a1b1-1f18-24e9-bfb1-a77ce84ff72a";

  it("returns to the event's own page when that is where it was pressed", () => {
    expect(eventOutcomeUrl("detail", REAL, "published")).toBe(
      `/admin/events/${REAL}?outcome=published`
    );
  });

  it("returns to the list, naming the event, when it was pressed there", () => {
    expect(eventOutcomeUrl("list", REAL, "needs-titleAr")).toBe(
      `/admin/events?outcome=needs-titleAr&event=${REAL}`
    );
  });

  it("names no event after a delete, because there is none to open", () => {
    expect(eventOutcomeUrl("list", undefined, "deleted")).toBe(
      "/admin/events?outcome=deleted"
    );
  });

  /**
   * The detail URL is only reachable with an id. Without one the fallback is the
   * list rather than `/admin/events/undefined`, which would answer a completed
   * action with a 404 and leave the operator unsure which of the two failed.
   */
  it("falls back to the list when the detail scope has no id", () => {
    expect(eventOutcomeUrl("detail", undefined, "failed")).toBe(
      "/admin/events?outcome=failed"
    );
  });

  /**
   * 🔴 The id arrives in a form post, so it belongs in ONE path segment. A value
   * carrying a slash must not be able to steer the redirect somewhere else.
   * Same reasoning as `resendApplicationEmail` next door.
   */
  it("encodes an id so it cannot escape its path segment", () => {
    expect(eventOutcomeUrl("detail", "a/../../admin", "failed")).toBe(
      "/admin/events/a%2F..%2F..%2Fadmin?outcome=failed"
    );
  });
});

/* ========================================================================== *
 * Two source properties, because neither can be reached without a DOM.
 * ========================================================================== */

const EVENTS_DIR = join(process.cwd(), "app", "admin", "(protected)", "events");

describe("the edit form still posts a status", () => {
  /**
   * 🔴 THE SILENT DEMOTION. `saveEvent` reads `status` off the form and falls
   * back to `"draft"` when it is absent, and the visible select left this form
   * on 2026-08-01 when the control moved beside the title. What holds the line
   * is a hidden input round-tripping the event's current status.
   *
   * Delete that input and nothing errors, nothing fails to compile, and no
   * existing test goes red: a published event simply drops off the site the
   * next time anybody fixes a typo in it, from a control nobody touched.
   */
  it("carries the current status in a hidden input", () => {
    const code = readFileSync(join(EVENTS_DIR, "EventForm.tsx"), "utf8");

    expect(
      /<input\s+type="hidden"\s+name="status"/.test(code),
      'EventForm must send `status` on an existing event. saveEvent defaults a ' +
        'missing status to "draft", so without this a published event is taken ' +
        "off the site by any ordinary save."
    ).toBe(true);
  });
});

describe("the delete control never trusts the form for what it destroys", () => {
  /**
   * 🔴 The poster path used to arrive in a hidden input on the delete form and
   * is now read from the row. A Server Action is a public POST endpoint
   * reachable by its id from the client bundle, so a hidden field naming an
   * object in a public bucket is a field the caller chooses, and `removeEvent`
   * hands whatever it is given straight to `deletePoster`.
   *
   * Asserted as the ABSENCE of the field, which is the only half a source scan
   * can see. The database read needs no assertion: `removeEvent` has nothing
   * else left to delete a poster with.
   *
   * ⚠️ SCOPED TO `EventActions.tsx`, and `EventForm.tsx` is deliberately NOT in
   * it. That file still posts a `posterPath`, legitimately and for a different
   * action: `saveEvent` reads it to know which object to clean up after a poster
   * is REPLACED. The same shape of exposure exists on that path, it predates
   * this change, its blast radius is one image, and it is reachable only by a
   * signed-in `@mazj.org` admin crafting a POST. Widening this rule to cover it
   * would fail a file nobody has touched, which is how a correct assertion gets
   * relaxed instead of a real problem getting fixed.
   */
  it("sends no posterPath field from the delete control", () => {
    const code = readFileSync(join(EVENTS_DIR, "EventActions.tsx"), "utf8");

    expect(
      /name="posterPath"/.test(code),
      "EventActions posts a posterPath. removeEvent reads the poster from the " +
        "row on purpose, so a form field here is an object path a caller chooses."
    ).toBe(false);
  });
});
