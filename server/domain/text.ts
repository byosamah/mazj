/**
 * Cleaning free text that arrives from a public form.
 *
 * Pure, so it is testable without a request. Recovered in spirit from the
 * `collapse()` helper that shipped with `leads` and was removed with it (git
 * `64abee4`); the ranges and the reasoning are the same, the shape is narrower.
 */

/**
 * Strips control characters, collapses whitespace and bounds the length.
 *
 * 🔴 Three separate problems, one pass.
 *
 * **Control characters.** A NUL passes `JSON.parse`, passes a `z.string()`, and
 * survives whitespace collapsing, and then a Postgres driver rejects it with
 * `unsupported Unicode escape sequence`, which this codebase maps to
 * `upstream_unavailable`: a 503 blaming our own database for the caller's input.
 * The C0/C1 ranges go, deliberately skipping `U+0009`-`U+000D` (tab, newline, CR
 * and friends) because the whitespace pass below has already turned those into
 * spaces. An ESC byte also matters for a different reason: these values are read
 * in a terminal via the log, where an escape sequence can rewrite what a human
 * sees.
 *
 * ⚠️ The ranges are written as escape sequences, never as literal bytes. A
 * literal control byte in a `.ts` file is a hard ESLint parse error.
 *
 * **Unbounded length.** The booking form is public and unauthenticated, and
 * since bookings stopped adopting an existing customer id, whatever is typed
 * here is written into MAZJ's operations records and rendered on the admin
 * dashboard. React escapes it, so this is not XSS; it is that a stranger should
 * not be able to put ten kilobytes of anything into an internal screen.
 *
 * **Whitespace.** Collapsed so a name padded with fifty spaces does not defeat
 * the length check or render as a blank cell that looks like a layout bug.
 */
export function cleanFreeText(value: string, maxLength: number): string {
  return value
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

/**
 * The same three protections, for text where LINE BREAKS carry meaning.
 *
 * `cleanFreeText` collapses every run of whitespace to a single space, which is
 * exactly right for a name and exactly wrong for a paragraph: a founder's
 * description of what they are building arrives from a `<textarea>`, and
 * flattening it into one wall of text is a quality loss paid by whoever has to
 * read fifty of them and decide.
 *
 * So newlines survive, and everything else is treated identically:
 *
 * - `\r\n` and a bare `\r` normalise to `\n` FIRST, so the stored text is not
 *   at the mercy of which operating system typed it, and so the strip below
 *   has only one line ending left to spare.
 * - C0/C1 control characters are stripped, sparing the newline alone. A NUL
 *   still reaches Postgres as `unsupported Unicode escape sequence`, which
 *   this codebase maps to a 503 blaming our own database for the caller's
 *   input, and an ESC byte still rewrites whatever a human reads in a
 *   terminal via the log.
 * - Horizontal whitespace, tabs included, collapses to a single space, so a
 *   pitch padded out to clear the 20-character floor does not clear it.
 * - Runs of three or more newlines collapse to two. One blank line is a
 *   paragraph; forty are a paste accident that renders as an empty screen for
 *   whoever has to read it.
 *
 * 🔴 The ranges are written as ESCAPE SEQUENCES, never as literal bytes. A
 * literal control byte in a `.ts` file is a hard ESLint parse error, and this
 * function shipped with exactly that mistake in its first draft: the class
 * rendered as three visible dashes and silently stripped nothing at all.
 */
export function cleanMultilineText(value: string, maxLength: number): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

/**
 * A permissive check that a string is shaped like an email address.
 *
 * 🔴 Deliberately NOT strict, and never the authority on whether an address is
 * allowed to do anything. `domain/admin-access.ts` owns that question and
 * applies the RFC 5321 rule properly. This exists only to stop obvious rubbish
 * being written onto a customer record that a human will later try to contact.
 *
 * Rejecting a valid-but-unusual address costs a real customer their receipt, so
 * when in doubt this says yes. It requires exactly one `@`, something on each
 * side, and a dot in the domain.
 */
export function looksLikeEmail(value: string): boolean {
  if (value.length < 6 || value.length > 254) return false;
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const domain = value.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }

  return !/[\s,;:<>()[\]\\"]/.test(value);
}

/**
 * The readable text inside a fragment of HTML.
 *
 * 🔴 EXISTS FOR ONE CALLER AND ONE DIRECTION: Rekaz stores a product's
 * description as HTML (`<p>بلا بلا بلا</p>`), and the admin's event form
 * prefills its Arabic description box from it. Without this the operator would
 * see the angle brackets, save them, and MAZJ's own event page would print
 * markup at a reader, because that field is rendered as PLAIN TEXT and React
 * escapes it.
 *
 * ⚠️ **This is not a sanitiser and must never be used as one.** It is not safe
 * to feed the result to `dangerouslySetInnerHTML`, and nothing here should ever
 * want to: the value lands in a form control and is rendered as text at every
 * step. If a future caller needs to RENDER vendor HTML, that is a different
 * problem needing a real sanitiser, not this function.
 *
 * Block-level closers become newlines first, so two paragraphs stay two
 * paragraphs instead of running together into one word. Entities are decoded
 * with `&amp;` LAST, or `&amp;lt;` would decode twice and produce a `<` the
 * author never wrote.
 */
export function htmlToPlainText(value: string): string {
  return (
    value
      // Block boundaries become newlines BEFORE tags are stripped, or
      // "<p>one</p><p>two</p>" collapses to "onetwo".
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      // A closing list item or row is a line. A closing paragraph, heading or
      // block is a PARAGRAPH, so it earns the blank line between them: the
      // event description renders with its line breaks preserved, and two ideas
      // running into one line is the thing this is meant to prevent.
      .replace(/<\/\s*(li|tr)\s*>/gi, "\n")
      .replace(/<\/\s*(p|div|h[1-6]|blockquote)\s*>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      // Tabs and stray carriage returns go; real newlines survive, because the
      // event description renders with its line breaks preserved.
      .replace(/\r/g, "")
      .replace(/[ \t ]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
