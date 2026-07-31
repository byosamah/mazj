import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * The kashida (تطويل / `U+0640` tatweel) house standard, enforced.
 *
 * WHY THIS FILE EXISTS
 *
 * Thmanyah Sans does not "stretch" a kashida the way most Arabic faces do. It
 * ships 690 hand-drawn glyphs whose only job is to be the elongated form: 138
 * letter shapes x runs of exactly 1, 2, 3, 4 and 5 tatweels, present
 * identically in all four weights. Verified against the woff2 files with
 * fontTools, 2026-07-29.
 *
 * There is no sixth drawing. At six the shaper falls back to repeating the
 * generic flat `U+0640` glyph, which is thinner than the surrounding strokes
 * and does not match the weight. Measured at 60px/900 on `المقصد`: runs 1-5
 * each add ~7px, and the sixth jumps +39px because it stops being a drawn
 * glyph and starts being a ruled line. So the 1-5 range is a property of the
 * font file, not a matter of taste, and it is the one rule here that cannot be
 * relaxed by a future ruling.
 *
 * WHY IT NEEDS A TEST RATHER THAN A NOTE IN `TONE.md`
 *
 * A kashida is invisible to every check anyone would think to run. The string
 * stays valid JSON, en/ar leaf-key parity still holds, and the rendered page
 * still reads correctly to a non-Arabic eye. But `ونـــــاســـــك` no longer
 * matches a Cmd+F for `وناسك`, so a find-and-replace over a settled term (and
 * `مساحة` alone is swept site-wide across 65+ uses) silently strips the
 * flourish from the h1 and nothing anywhere reports it. `TONE.md` already
 * warns about this in prose for the two original lines. Prose scales to two
 * lines. It does not scale to one per page.
 *
 * So the inventory below is a PIN, not a sample. Adding, removing, lengthening
 * or shortening any kashida in `messages/ar.json` must be a deliberate edit to
 * this table too.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const TATWEEL = "ـ";

/**
 * Arabic letters that do NOT join to the letter that FOLLOWS them: Unicode
 * joining type R (right-joining) plus U (non-joining). A kashida placed after
 * one of these has nothing to attach to on its right, so it does not become a
 * swash. It renders as a dash floating in the word gap, which is a spelling
 * error to an Arabic reader, not a decoration.
 *
 * Every other Arabic letter is dual-joining, and Thmanyah draws kashida forms
 * for all 31 of them that occur in real copy (`init` and `medi` positions
 * only, which is exactly the set of positions in which a letter joins
 * forward). Each individual join shipped in the table below is additionally
 * confirmed by rendering it in Chrome at heading size before it lands.
 */
const NO_FORWARD_JOIN = new Set([
  "ء", // ء  hamza
  "آ", // آ  alef madda
  "أ", // أ  alef hamza above
  "ؤ", // ؤ  waw hamza above
  "إ", // إ  alef hamza below
  "ا", // ا  alef
  "ة", // ة  teh marbuta
  "د", // د  dal
  "ذ", // ذ  thal
  "ر", // ر  reh
  "ز", // ز  zain
  "و", // و  waw
  "ٱ", // ٱ  alef wasla
]);

/**
 * DECORATIVE kashidas: the house standard.
 *
 * Scope and length are owner rulings (2026-07-29): every Arabic page `h1` and
 * every Arabic section heading carries exactly ONE stretched join, at 5
 * tatweels on a page `h1` and 3 on a section heading. The two entries above
 * the rule predate it and are locked by earlier rulings recorded in `TONE.md`
 * (2026-07-26 and 2026-07-27); they are the only strings allowed two runs.
 */
/**
 * 🔴 `level` is EXPLICIT, never inferred from the key name. Five of these keys
 * end in `.title` and are section headings, not page titles: a landing-page
 * section owns `Spaces.title`, `Faq.title`, `Location.title`, `Founding.title`
 * and `HostEvent.title`, while the page `h1` above them is `Hero.titleLine1`.
 * An `endsWith(".title")` heuristic reads all five as page titles and quietly
 * demands 5 tatweels on a section heading.
 *
 * DELIBERATELY ABSENT, each for a different reason:
 *   - Terms, Privacy, 404 and the error page: owner ruling 2026-07-29. A
 *     flourish reads as decoration where the reader wants plainness, and as the
 *     wrong register on an apology.
 *   - The booking flow `h1`: it renders `Spaces.cards.openDesk.name`, a product
 *     name that the same value serves in five places (the spaces grid, the
 *     offers list, `SpaceCoworking.eyebrow`, `Booking.space.*` and a `/startups`
 *     form dropdown). A kashida there leaks into all of them.
 *   - `Faq.groups[*].label`: rendered as `h2` on `/faq`, but they are category
 *     labels, and one of them IS `Nav.events`, so a swash would reach the nav.
 *   - `Footer.morePower`: an `h2` on every page. Same swash 13 times is a tic.
 *   - `Usp.*Title`: the three landing-page USP cards, `h2` at 50px. Left plain by
 *     owner ruling 2026-07-30. Three flourishes sitting side by side in one row
 *     read as a repeating pattern rather than as a flourish. `Why.card*Statement`
 *     is the same shape and DID earn one, because those two are 85px, they are the
 *     largest type on the page after the hero, and each stands alone in its own
 *     full-bleed card.
 *   - `Why.risk1`, `risk2`, `risk3`: three sequential lines at 45px, and
 *     deliberately `Reveal as="span"` rather than headings (one continuous
 *     statement). Flourishing one of the three reads as arbitrary; flourishing all
 *     three is the `Footer.morePower` tic at smaller scale.
 *   - Proper names, always: `مزج`, `الملقى`, `المعارج`, `الخُبر`. The two space
 *     pages take their swash on the descriptive line instead of the room name.
 */
const DECORATIVE: Record<string, { level: "locked" | "h1" | "section"; runs: number[] }> = {
  // Locked by owner ruling, symmetrical mashq either side of the ا. See TONE.md.
  "Hero.titleLine2": { level: "locked", runs: [5, 5] },
  "SpaceFinder.trigger": { level: "locked", runs: [2, 4] },

  // Page titles: 5.
  "AboutPage.title": { level: "h1", runs: [5] }, //        المقـــــصد     (after ق)
  "SpacesPage.title": { level: "h1", runs: [5] }, //       المساحـــــات   (after ح)
  "SpaceCoworking.title": { level: "h1", runs: [5] }, //   المشتـــــرك    (after ت)
  "SpaceOffice.title": { level: "h1", runs: [5] }, //      تركيـــــزك     (after ي)
  "SpaceMeeting.title": { level: "h1", runs: [5] }, //     الاجتمـــــاعات (after م)
  "SpaceEventHall.title": { level: "h1", runs: [5] }, //   الفعـــــاليات  (after ع)
  "EventsPage.title": { level: "h1", runs: [5] }, //       حـــــدث        (after ح)
  "ContactPage.title": { level: "h1", runs: [5] }, //      مرحـــــباً      (after ح)
  "FaqPage.title": { level: "h1", runs: [5] }, //          وإجـــــابات    (after ج)
  "Startups.title": { level: "h1", runs: [5] }, //         مقـــــرّك       (after ق)

  // Section headings: 3.
  "AboutPage.storyTitle": { level: "section", runs: [3] }, //        بنيـــنا    (after ي)
  "AboutPage.spaceTitle": { level: "section", runs: [3] }, //        واحـــد     (after ح)
  "AboutPage.communityTitle": { level: "section", runs: [3] }, //    الجيـــران  (after ي)
  "AboutPage.closingTitle": { level: "section", runs: [3] }, //      المكـــان   (after ك)
  "Spaces.title": { level: "section", runs: [3] }, //                أربـــع     (after ب)
  "Spaces.otherTitle": { level: "section", runs: [3] }, //           الأخـــرى   (after خ)
  "HostEvent.title": { level: "section", runs: [3] }, //             جمـــعت     (after م)
  // Reworded 2026-07-30 (owner): the band now names the audience and the product in
  // the big type, so the swash moved off مشـــروعاً onto the audience word itself.
  "Founding.title": { level: "section", runs: [3] }, //              ناشـــئة    (after ش)
  "Location.title": { level: "section", runs: [3] }, //              قلـــب      (after ل)
  "Faq.title": { level: "section", runs: [3] }, //                   أسئـــلة    (after ئ)
  "Network.titleLine1": { level: "section", runs: [3] }, //          تنمـــو     (after م)
  "StepInto.titleLine1": { level: "section", runs: [3] }, //         ادخـــل     (after خ)
  // The two WhyMazj statements: `WordReveal as="h2"` at 85px, the largest type on
  // the landing page after the hero h1. Added 2026-07-30. They are not `*.title`
  // keys and they are not section LABELS either; they are the section's whole
  // statement, which is why they sit at h1 scale and why they take the swash on
  // the payload word of line 1 rather than on the first word.
  "Why.card1Statement": { level: "section", runs: [3] }, //          خاصـــة     (after ص)
  "Why.card3Statement": { level: "section", runs: [3] }, //          للمبدعـــين (after ع)
  "SpacesPage.sectionTitle": { level: "section", runs: [3] }, //     ابـــدأ     (after ب)
  "SpaceCoworking.aboutTitle": { level: "section", runs: [3] }, //   بالتفصـــيل (after ص)
  "SpaceCoworking.faqTitle": { level: "section", runs: [3] }, //     المـــرن    (after م)
  "SpaceOffice.aboutTitle": { level: "section", runs: [3] }, //      مجهـــز     (after ه)
  "SpaceOffice.faqTitle": { level: "section", runs: [3] }, //        الخـــاص    (after خ)
  "SpaceMeeting.aboutTitle": { level: "section", runs: [3] }, //     مجهـــزة    (after ه)
  "SpaceMeeting.faqTitle": { level: "section", runs: [3] }, //       غرفـــة     (after ف)
  "SpaceEventHall.aboutTitle": { level: "section", runs: [3] }, //   صُـــمّمت    (after ص)
  "SpaceEventHall.faqTitle": { level: "section", runs: [3] }, //     قـــاعة     (after ق)
  "EventsPage.upcomingTitle": { level: "section", runs: [3] }, //    قـــادم     (after ق)
  "EventsPage.hostTitle": { level: "section", runs: [3] }, //        فعـــاليتك  (after ع)
  "ContactPage.tourTitle": { level: "section", runs: [3] }, //       احجـــز     (after ج)
  "ContactPage.socialsTitle": { level: "section", runs: [3] }, //    تجـــدنا    (after ج)
  "FaqPage.closingTitle": { level: "section", runs: [3] }, //        ســـؤال     (after س)
  "Startups.offerTitle": { level: "section", runs: [3] }, //         أشـــياء    (after ش)
  "Startups.howTitle": { level: "section", runs: [3] }, //           خطـــوات    (after ط)
  "Startups.formTitle": { level: "section", runs: [3] }, //          تصنـــعه    (after ن)
};

/**
 * FUNCTIONAL kashidas: not decoration and not covered by the standard.
 *
 * Arabic attaches a one-letter proposition to a following Latin or digit run
 * with a single tatweel, because the proposition cannot join to a non-Arabic
 * glyph on its own: `لـ30 شخصاً`, `عنوان الـIP`. These are spelling. They are
 * always exactly one tatweel, they are allowed in body copy and in metadata,
 * and no automated pass over headings may touch them.
 */
const FUNCTIONAL_KEYS = new Set([
  "Faq.groups[2].items[2].q",
  "SpaceEventHall.metaTitle",
  "PrivacyPage.sections[2].body",
]);

function leaves(value: Json, prefix = ""): [string, string][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return typeof value === "string" ? [[prefix, value]] : [];
}

/** Every tatweel run in a string, as { index, length }. */
function runs(s: string): { index: number; length: number }[] {
  const out: { index: number; length: number }[] = [];
  for (const m of s.matchAll(new RegExp(`${TATWEEL}+`, "g"))) {
    out.push({ index: m.index, length: m[0].length });
  }
  return out;
}

/**
 * The letter a run attaches to, skipping combining marks. A harakah sits
 * BETWEEN the letter and the kashida in the code-point order (`الخُـبر`), so
 * walking back one character finds the damma, not the khah.
 */
function anchor(s: string, index: number): string | null {
  let i = index - 1;
  while (i >= 0 && /\p{Mn}/u.test(s[i])) i -= 1;
  return i >= 0 ? s[i] : null;
}

const ar = JSON.parse(readFileSync("messages/ar.json", "utf8")) as Json;
const en = JSON.parse(readFileSync("messages/en.json", "utf8")) as Json;
const arLeaves = leaves(ar);
const withTatweel = arLeaves.filter(([, v]) => v.includes(TATWEEL));

describe("Arabic kashida standard", () => {
  it("has no kashida anywhere in messages/en.json", () => {
    // The device is Arabic-only. A tatweel in the English file is always a
    // copy/paste accident from the Arabic side.
    expect(leaves(en).filter(([, v]) => v.includes(TATWEEL)).map(([k]) => k)).toEqual([]);
  });

  it("carries exactly the pinned inventory, nothing added or silently stripped", () => {
    const found = Object.fromEntries(
      withTatweel
        .filter(([k]) => !FUNCTIONAL_KEYS.has(k))
        .map(([k, v]) => [k, runs(v).map((r) => r.length)])
    );
    const pinned = Object.fromEntries(
      Object.entries(DECORATIVE).map(([k, spec]) => [k, spec.runs])
    );
    // Fails loudly when a find-and-replace strips a swash, when a copy rewrite
    // drops a heading's kashida, and when a new one lands without being pinned.
    expect(found).toEqual(pinned);
  });

  it("never runs past 5 tatweels, the last length the font actually draws", () => {
    for (const [key, { runs: lengths }] of Object.entries(DECORATIVE)) {
      for (const n of lengths) {
        expect(n, `${key} has a run of ${n}`).toBeGreaterThanOrEqual(1);
        expect(n, `${key} has a run of ${n}; the font draws no 6th form`).toBeLessThanOrEqual(5);
      }
    }
  });

  it("only ever attaches to a letter that joins forward", () => {
    for (const [key, value] of withTatweel) {
      for (const r of runs(value)) {
        const a = anchor(value, r.index);
        expect(a, `${key}: kashida at index ${r.index} has no letter before it`).not.toBeNull();
        expect(
          NO_FORWARD_JOIN.has(a as string),
          `${key}: kashida follows ${a}, which does not join forward, so it renders as a floating dash`
        ).toBe(false);
      }
    }
  });

  it("puts at most one swash in a heading, outside the two locked lines", () => {
    for (const [key, { level, runs: lengths }] of Object.entries(DECORATIVE)) {
      if (level === "locked") continue;
      expect(lengths.length, `${key} carries ${lengths.length} swashes; the standard allows 1`).toBe(
        1
      );
    }
  });

  it("uses 5 tatweels on a page h1 and 3 on a section heading", () => {
    for (const [key, { level, runs: lengths }] of Object.entries(DECORATIVE)) {
      if (level === "locked") continue;
      expect(lengths[0], `${key} is a ${level}`).toBe(level === "h1" ? 5 : 3);
    }
  });

  it("never stretches a proper name", () => {
    // The brand and the two room names are identity, not display copy. A swash
    // inside مزج would restyle the wordmark itself; the two space pages take
    // theirs on the descriptive line instead (الاجتمـــــاعات, الفعـــــاليات).
    const PROPER = ["مزج", "الملقى", "المعارج", "الخُبر"];
    for (const [key, value] of withTatweel) {
      for (const name of PROPER) {
        const stretched = new RegExp([...name].join(`${TATWEEL}*`).replace(/\s/g, "\\s"));
        const m = value.match(stretched);
        expect(
          m ? m[0].includes(TATWEEL) : false,
          `${key} stretches the proper name ${name}`
        ).toBe(false);
      }
    }
  });

  it("keeps decoration out of metadata, alt text and other machine-read strings", () => {
    // A kashida in a `metaTitle` reaches Google's result snippet, and in an
    // `alt` it reaches a screen reader as a word the user cannot search for.
    // The FUNCTIONAL entries are exempt: `لـ30` is spelling, and it belongs in
    // a meta title exactly as it belongs in the sentence.
    const leaked = withTatweel
      .filter(([k]) => !FUNCTIONAL_KEYS.has(k))
      .filter(([k]) => /(^|\.)(metaTitle|metaDescription|.*Alt|aria.*|ogTitle)$/i.test(k))
      .map(([k]) => k);
    expect(leaked).toEqual([]);
  });

  it("holds every functional kashida to exactly one tatweel", () => {
    for (const key of FUNCTIONAL_KEYS) {
      const entry = arLeaves.find(([k]) => k === key);
      expect(entry, `${key} no longer exists; re-check the functional list`).toBeDefined();
      for (const r of runs((entry as [string, string])[1])) {
        expect(r.length, `${key} joins a proposition with ${r.length} tatweels, not 1`).toBe(1);
      }
    }
  });
});
