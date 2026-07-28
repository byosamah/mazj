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
