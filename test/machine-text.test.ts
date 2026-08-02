import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";

import {
  flattenForMachines,
  normalizeArabicForMachines,
} from "@/lib/machine-text";

/**
 * `lib/machine-text.ts` prepares Arabic for `/llms.txt` and `/pricing.md`.
 *
 * Two properties are worth a test and one of them is genuinely load-bearing.
 *
 * The obvious one: decorative kashidas and harakat come off, so a tokenizer
 * sees the word a buyer actually types.
 *
 * 🔴 The load-bearing one: NOT EVERY TATWEEL IS DECORATION. Arabic uses a
 * single tatweel to carry a prefix onto something it cannot join to, which is
 * correct spelling rather than a flourish (`لـ30`, `الـIP`). A blanket
 * `replace(/ـ/g, "")` is the obvious implementation, it looks right, it passes
 * any test written from the decorative examples alone, and it silently ships
 * `ل30` into a machine-readable page listing built from a `metaTitle`. That is
 * exactly what happened on the first render of `/llms.txt` on 2026-08-02.
 *
 * So the last block below walks the REAL `messages/ar.json` rather than
 * fixtures. A test over invented strings cannot notice the day somebody adds a
 * fourth connector.
 */

const TATWEEL = "ـ";

describe("normalizeArabicForMachines", () => {
  it("removes a decorative kashida run and restores the searchable word", () => {
    expect(normalizeArabicForMachines("العمل المشتـــــرك في مزج")).toBe(
      "العمل المشترك في مزج"
    );
    expect(normalizeArabicForMachines("كل المساحـــــات")).toBe("كل المساحات");
    expect(normalizeArabicForMachines("ونـــــاســـــك")).toBe("وناسك");
  });

  it("removes harakat, so the settled city spelling matches what buyers type", () => {
    // 🔴 The display spelling `الخُبر` is an owner ruling and is NOT changed by
    // this: the rendered page keeps its damma. This is the machine channel.
    expect(normalizeArabicForMachines("الخُبر")).toBe("الخبر");
    expect(normalizeArabicForMachines("مساحة عمل مشتركة في الخُبر")).toBe(
      "مساحة عمل مشتركة في الخبر"
    );
  });

  it("KEEPS a tatweel used as an orthographic connector", () => {
    // Preposition onto a numeral, and the article onto a Latin acronym. Both
    // are correct Arabic. Stripping either is a spelling error.
    expect(normalizeArabicForMachines("تتسع لـ30 شخصاً")).toBe("تتسع لـ30 شخصا");
    expect(normalizeArabicForMachines("عنوان الـIP")).toBe("عنوان الـIP");
    expect(
      normalizeArabicForMachines("أين يمكنني إقامة ورشة عمل لـ30 شخصاً في الخُبر؟")
    ).toContain("لـ30");
  });

  it("collapses the hand-placed heading line breaks", () => {
    expect(normalizeArabicForMachines("كل المساحـــــات،\nفي عنوان واحد")).toBe(
      "كل المساحات، في عنوان واحد"
    );
  });

  it("leaves letters, spaces and punctuation otherwise untouched", () => {
    const plain = "مزج مساحة عمل مشتركة في المنطقة الشرقية، السعودية.";
    expect(normalizeArabicForMachines(plain)).toBe(plain);
  });
});

describe("flattenForMachines", () => {
  it("collapses newlines and nothing else", () => {
    expect(flattenForMachines("Four spaces,\none address")).toBe(
      "Four spaces, one address"
    );
    expect(flattenForMachines("Up to 6 · by the hour")).toBe("Up to 6 · by the hour");
  });
});

describe("against the real messages/ar.json", () => {
  type Json = string | number | boolean | null | Json[] | {[k: string]: Json};

  const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Json;

  function leaves(node: Json, path = ""): [string, string][] {
    if (typeof node === "string") return [[path, node]];
    if (Array.isArray(node)) return node.flatMap((v, i) => leaves(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      return Object.entries(node).flatMap(([k, v]) =>
        leaves(v, path ? `${path}.${k}` : k)
      );
    }
    return [];
  }

  const all = leaves(ar);
  const withTatweel = all.filter(([, v]) => v.includes(TATWEEL));

  it("finds the kashidas that are actually there", () => {
    // A canary, not a target. If this drops to 0 the normaliser is being tested
    // against nothing, which is how a green suite stops meaning anything.
    expect(withTatweel.length).toBeGreaterThan(30);
  });

  it("leaves no orphaned prefix anywhere: every ل or ال keeps its connector", () => {
    // 🔴 THE REGRESSION THIS FILE EXISTS FOR. Walk every real Arabic string,
    // normalise it, and assert that no prefix ended up welded to a digit or a
    // Latin letter with its connector removed.
    const broken: string[] = [];
    for (const [path, value] of all) {
      const out = normalizeArabicForMachines(value);
      // A bare Arabic prefix immediately followed by a digit or Latin letter is
      // the signature of a connector that should have survived.
      const orphan = /(^|\s)(ال|ل|ب|ك|و|ف)[0-9A-Za-z]/.exec(out);
      if (orphan && value.includes(TATWEEL)) broken.push(`${path}: ${out}`);
    }
    expect(broken).toEqual([]);
  });

  it("removes every decorative run, leaving no tatweel between two Arabic letters", () => {
    for (const [path, value] of withTatweel) {
      const out = normalizeArabicForMachines(value);
      const stillDecorative = /ـ+(?=[ء-غف-ي])/.test(out);
      expect(stillDecorative, `${path} still carries a decorative kashida`).toBe(false);
    }
  });

  it("never changes a string's word count", () => {
    // Normalising must not merge or split words. It removes marks, nothing else.
    for (const [path, value] of withTatweel) {
      const before = value.replace(/\s*\n\s*/g, " ").trim().split(/\s+/).length;
      const after = normalizeArabicForMachines(value).split(/\s+/).length;
      expect(after, `${path} changed word count`).toBe(before);
    }
  });
});
