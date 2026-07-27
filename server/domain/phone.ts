/**
 * Phone normalisation to E.164, tuned for Saudi Arabia.
 *
 * Every phone number that reaches the database is stored in exactly one format:
 * `+966534600488`. Storing whatever the visitor typed means the same person
 * appears three times under three spellings, and any future WhatsApp or SMS
 * integration has to re-parse free text at send time.
 *
 * 🔴 THE ARABIC-INDIC DIGIT PROBLEM. This site is half Arabic, and an Arabic
 * keyboard on iOS and Android emits Arabic-Indic digits: `٠٥٣٤٦٠٠٤٨٨`, not
 * `0534600488`. Those are different Unicode codepoints (U+0660..U+0669, plus
 * the Extended/Persian set at U+06F0..U+06F9). A `/^[0-9]+$/` validator rejects
 * them, and `parseInt` returns NaN. A visitor typing their own number on their
 * own phone in their own language gets told it is invalid.
 *
 * Transliterating those digits first is therefore not a nicety. It is the
 * difference between the Arabic half of the site working and not working.
 */

/** Arabic-Indic (U+0660..U+0669) and Extended Arabic-Indic (U+06F0..U+06F9). */
const ARABIC_INDIC_OFFSET = 0x0660;
const EXTENDED_ARABIC_INDIC_OFFSET = 0x06f0;

/** Rewrites Arabic-Indic and Persian digits as ASCII, leaving all else alone. */
export function toAsciiDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= ARABIC_INDIC_OFFSET && code <= ARABIC_INDIC_OFFSET + 9) {
      out += String(code - ARABIC_INDIC_OFFSET);
    } else if (
      code >= EXTENDED_ARABIC_INDIC_OFFSET &&
      code <= EXTENDED_ARABIC_INDIC_OFFSET + 9
    ) {
      out += String(code - EXTENDED_ARABIC_INDIC_OFFSET);
    } else {
      out += ch;
    }
  }
  return out;
}

/** Saudi country calling code. */
const SA_CC = "966";
/** Saudi national significant numbers are 9 digits: 5XXXXXXXX or 1XXXXXXXX. */
const SA_NSN = /^[15]\d{8}$/;
/** E.164: a leading +, a non-zero country digit, 8 to 15 digits in total. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises a typed phone number to E.164, or returns `null` if it cannot be
 * understood.
 *
 * Accepts, among others:
 *   `0534600488`, `٠٥٣٤٦٠٠٤٨٨`, `+966 53 460 0488`, `00966534600488`,
 *   `966-534-600-488`, `(053) 460 0488`, `534600488`, `013 3300 337`
 *
 * Deliberately conservative: an unrecognised international number is returned
 * unchanged only if it already looks like valid E.164. Guessing a country code
 * for a number we cannot place would silently misroute messages.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;

  const ascii = toAsciiDigits(raw);

  // Reduce to digits and any `+`. Spaces, dashes, parentheses, the RTL and LTR
  // marks Arabic input methods sprinkle in, and any Arabic comma are all noise
  // around the number rather than part of it.
  const cleaned = ascii.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // 🔴 `hadPlus` is decided AFTER stripping punctuation, not before. Deciding it
  // on the raw string means a leading bracket hides the plus: `(+971) 50 123
  // 4567` is an extremely common way to write a number, and reading it as a
  // national number sends it down the Saudi-only branches, where it matches
  // nothing and is rejected as unreachable. A real UAE mobile, refused.
  const hadPlus = cleaned.startsWith("+");

  let candidate: string;

  if (hadPlus) {
    candidate = `+${digits}`;
  } else if (digits.startsWith("00")) {
    // International access code, as dialled from a landline.
    candidate = `+${digits.slice(2)}`;
  } else if (digits.startsWith(SA_CC)) {
    candidate = `+${digits}`;
  } else if (digits.startsWith("0")) {
    // National format: the trunk prefix 0 gives way to the country code.
    candidate = `+${SA_CC}${digits.slice(1)}`;
  } else {
    // Bare national significant number, no trunk prefix.
    candidate = `+${SA_CC}${digits}`;
  }

  // 🔴 Saudi numbers are validated against the national plan, ALWAYS, including
  // when the caller supplied the country code themselves. Skipping this for
  // `+`-prefixed input was a real bug: `+966 (0)53 460 0488`, the standard way
  // of printing a number so it works both domestically and internationally,
  // became `+9660534600488`. That is thirteen digits where Saudi allows twelve,
  // an undialable number that nonetheless satisfies a generic E.164 shape check
  // and so was stored as canonical. It would then be the only contact channel
  // on a lead nobody could ever ring.
  if (candidate.startsWith(`+${SA_CC}`)) {
    let nsn = candidate.slice(1 + SA_CC.length);
    // The redundant trunk zero in the `+966 (0)5…` notation.
    if (nsn.startsWith("0")) nsn = nsn.slice(1);
    if (!SA_NSN.test(nsn)) return null;
    candidate = `+${SA_CC}${nsn}`;
  }

  return E164.test(candidate) ? candidate : null;
}

/** True when a string is already well-formed E.164. */
export function isE164(value: string): boolean {
  return E164.test(value);
}
