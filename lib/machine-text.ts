/**
 * Arabic text, prepared for a machine rather than for an eye.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS EMPHATICALLY NOT FOR
 *
 * `messages/ar.json` is written for a reader. It carries two kinds of mark that
 * are correct on screen and invisible-but-costly in a text stream:
 *
 *   1. **Decorative kashidas.** 162 `U+0640` tatweels across 46 keys, a house
 *      standard pinned by `test/arabic-kashida.test.ts`. Thmanyah Sans draws
 *      each run as a real swash glyph, so on screen `المشتـــــرك` is a
 *      flourish. In a string it is not `المشترك`, and every Arabic page `h1` on
 *      this site therefore fails to match its own subject. Measured 2026-08-02
 *      across the 11 Arabic routes: 186 tatweels in the rendered visible text,
 *      46 distinct broken word-forms, 30 of them appearing ONLY in broken form
 *      on their own page.
 *   2. **Harakat.** The city is spelled `الخُبر` with a damma, settled by owner
 *      ruling and consistent across all 63 occurrences plus `lib/schema.ts`.
 *      The bare `الخبر` that a Saudi buyer actually types appears ZERO times
 *      anywhere in the message files or the served HTML.
 *
 * Classical search normalises both away, because stripping tatweel and harakat
 * is step one of every Arabic information-retrieval pipeline. Language models
 * do not: the decorated and undecorated forms tokenise differently, and an
 * assistant quoting an Arabic heading quotes the broken form into its answer.
 *
 * 🔴 SO THIS MODULE EXISTS TO FEED MACHINE-ONLY SURFACES (`/llms.txt`,
 * `/pricing.md`), AND MUST NEVER BE APPLIED TO RENDERED COPY. The typography is
 * a deliberate design decision owned by `DESIGN.md` and enforced by a test.
 * Running this over a heading would silently delete 46 swashes and no check
 * anywhere would report it, which is the precise failure `arabic-kashida.test.ts`
 * was written to prevent. The content served here is IDENTICAL, only
 * undecorated: same sentences, same facts, same order. That distinction is what
 * separates a second machine channel from cloaking.
 */

/**
 * 🔴 A TATWEEL IS NOT ALWAYS DECORATION, AND STRIPPING THE OTHER KIND IS A
 * SPELLING ERROR.
 *
 * Arabic attaches a single tatweel to carry a prefix onto a token that cannot
 * be joined to, which is standard orthography rather than a flourish:
 *
 *   `لـ30`   the preposition ل onto a numeral   (`SpaceEventHall.metaTitle`,
 *                                                `Faq.groups[2].items[2].q`)
 *   `الـIP`  the article ال onto a Latin acronym (`PrivacyPage.sections[2].body`)
 *
 * Three occurrences in `messages/ar.json` today. A blanket strip turns `لـ30`
 * into `ل30`, which reads as a typo to an Arabic speaker and, being in a
 * `metaTitle`, would have shipped into a machine-readable page listing. Caught
 * on the first render of `/llms.txt`, 2026-08-02.
 *
 * The discriminator is what FOLLOWS the run. A decorative kashida only exists
 * to stretch a join, so it is always followed by another Arabic letter. A
 * connector exists precisely because what follows is NOT an Arabic letter. So:
 * remove a run only when an Arabic letter comes next, and leave every other
 * tatweel exactly where it is.
 */
const DECORATIVE_TATWEEL = /ـ+(?=[ء-غف-ي])/g;

/**
 * Arabic combining marks: `U+064B` fathatan through `U+0652` sukun (which
 * includes the shadda at `U+0651`), plus `U+0670` superscript alef. Letters,
 * spaces and punctuation are untouched, so the sentence survives intact.
 */
const HARAKAT = /[ً-ْٰ]/g;

/** Collapse the hand-placed heading line breaks, which are layout, not text. */
const SOFT_BREAKS = /\s*\n\s*/g;

/**
 * Undecorated Arabic for a tokenizer. Same words, same order, no swashes and no
 * diacritics.
 */
export function normalizeArabicForMachines(value: string): string {
  return value
    .replace(DECORATIVE_TATWEEL, "")
    .replace(HARAKAT, "")
    .replace(SOFT_BREAKS, " ")
    .trim();
}

/**
 * Collapse a display string's hand-placed line breaks without touching
 * anything else. English carries no decoration to remove, and a newline inside
 * a one-line record is noise to a parser.
 */
export function flattenForMachines(value: string): string {
  return value.replace(SOFT_BREAKS, " ").trim();
}
