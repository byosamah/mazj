import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The i18n content-sync rule, enforced.
 *
 * `CLAUDE.md` states it as the most important rule in the repo and prescribes
 * the check by hand: "diff the two files' leaf-key PATHS (including array
 * indices) with a quick node script, not by eye". This is that script, kept.
 *
 * 🔴 KEY PATHS, NEVER VALUES. The Arabic file uses Arabic-Indic numerals in the
 * events archive and says entirely different words everywhere else, so
 * comparing values false-fails on exactly the content that is doing its job.
 * Array LENGTH is compared, because an `en` list of three rendered against an
 * `ar` list of two drops a card silently on one locale only.
 *
 * The failure this catches is real and has happened here: keys drift when copy
 * is regenerated, especially by an agent, and a missing key renders as the raw
 * key path on screen or throws, in one language, on one route, which is the
 * half of the site the author is least likely to be reading.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function leafPaths(value: Json, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => leafPaths(v, `${prefix}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k)
    );
  }
  return [prefix];
}

const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Json;
const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Json;

describe("messages/en.json and messages/ar.json", () => {
  it("share an identical set of leaf key paths", () => {
    const enPaths = new Set(leafPaths(en));
    const arPaths = new Set(leafPaths(ar));

    // Reported as two named lists rather than one diff, because "missing from
    // Arabic" and "missing from English" are different mistakes with different
    // fixes, and a raw set difference makes you work out which you are looking
    // at.
    expect(
      [...enPaths].filter((p) => !arPaths.has(p)).sort(),
      "present in en.json, missing from ar.json"
    ).toEqual([]);
    expect(
      [...arPaths].filter((p) => !enPaths.has(p)).sort(),
      "present in ar.json, missing from en.json"
    ).toEqual([]);
  });

  it("carries no empty string in either language", () => {
    for (const [name, doc] of [
      ["en", en],
      ["ar", ar],
    ] as const) {
      const empties: string[] = [];
      const walk = (value: Json, path: string) => {
        if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`));
        if (value !== null && typeof value === "object") {
          return Object.entries(value).forEach(([k, v]) =>
            walk(v, path ? `${path}.${k}` : k)
          );
        }
        if (typeof value === "string" && value.trim() === "") empties.push(path);
      };
      walk(doc, "");
      expect(empties, `empty strings in ${name}.json`).toEqual([]);
    }
  });

  it("uses no em-dash in either language", () => {
    // Banned site-wide (TONE.md). They have hidden as list bullets before and
    // survived every prose read-through, so this is grepped, never read.
    expect(readFileSync("messages/en.json", "utf8")).not.toContain("—");
    expect(readFileSync("messages/ar.json", "utf8")).not.toContain("—");
  });
});

describe("the Startups namespace", () => {
  const startups = (ar as Record<string, Json>).Startups as Record<string, Json>;
  const startupsEn = (en as Record<string, Json>).Startups as Record<string, Json>;

  it("exists in both languages", () => {
    expect(startups).toBeTruthy();
    expect(startupsEn).toBeTruthy();
  });

  it("has copy for every option the form can render", () => {
    // The `<select>` and the radio group are built from these lists in the
    // component. A missing option key renders the raw path inside a control the
    // visitor must choose from before they can submit at all.
    for (const stage of ["idea", "building", "earning"]) {
      expect((startups.stageOptions as Record<string, string>)[stage]).toBeTruthy();
      expect((startupsEn.stageOptions as Record<string, string>)[stage]).toBeTruthy();
    }
    for (const space of [
      "shared_seat",
      "private_office",
      "meeting_room",
      "event_hall",
    ]) {
      expect((startups.spaceOptions as Record<string, string>)[space]).toBeTruthy();
      expect((startupsEn.spaceOptions as Record<string, string>)[space]).toBeTruthy();
    }
  });

  it("has copy for every error code the action can return", () => {
    // 🔴 The form falls back to `error.unknown` for anything unlisted, so a gap
    // here is not a crash: it is a visitor being told "that did not go through"
    // when we could have told them their email was already on file. These four
    // are the codes `submitStartupApplication` actually produces.
    const errors = startups.error as Record<string, Json>;
    const errorsEn = startupsEn.error as Record<string, Json>;
    for (const code of [
      "rate_limited",
      "conflict",
      "upstream_unavailable",
      "unknown",
    ]) {
      expect(errors[code], `ar Startups.error.${code}`).toBeTruthy();
      expect(errorsEn[code], `en Startups.error.${code}`).toBeTruthy();
    }

    // And a per-field line for every field the service can name.
    const fields = errors.field as Record<string, Json>;
    for (const field of [
      "founderName",
      "startupName",
      "email",
      "mobile",
      "pitch",
      "stage",
      "teamSize",
      "space",
    ]) {
      expect(fields[field], `ar Startups.error.field.${field}`).toBeTruthy();
    }
  });

  it("keeps the offer a closed envelope", () => {
    // 🔴 The owner's standing ruling (TONE.md §6), reaffirmed 2026-07-28 when
    // this page was commissioned. No amount, percentage or duration of the
    // OFFER may appear on the page. This is the assertion an enthusiastic copy
    // pass is most likely to trip, which is exactly why it is here.
    const text = JSON.stringify([startups, startupsEn]);
    expect(text).not.toMatch(/\d+\s*%/);
    expect(text).not.toMatch(/SAR|ريال|ر\.س/);
    expect(text.toLowerCase()).not.toMatch(/discount|خصم/);
  });
});
