/**
 * Who is allowed into `/admin`.
 *
 * One rule, in one place, used by all three gates: the login endpoint refuses to
 * send a link to anyone else, the Supabase `before user created` hook refuses to
 * mint an account for anyone else, and the admin layout re-checks on every
 * request. Three gates that each ask a different question would eventually
 * disagree, and the gap between them would be the vulnerability. They all call
 * this.
 *
 * 🔴 This is deliberately NOT `email.endsWith("@mazj.org")`.
 *
 * That check is wrong in a way that reads as correct, which is the worst kind.
 * RFC 5321 puts the domain after the LAST `@`, and a local part may itself
 * contain an `@` when quoted. So `"anything@mazj.org"@evil.com` is a
 * syntactically valid address, delivered to `evil.com`, whose local part ends
 * with the string `@mazj.org`. A naive suffix test hands an attacker a magic
 * link to a MAZJ admin account. Splitting on the last `@` and comparing the
 * domain exactly closes it.
 *
 * The comparison is against an ASCII literal, which also rejects homograph
 * domains: a Cyrillic `а` in `mаzj.org` renders identically and compares
 * unequal.
 */

/** The only email domain permitted to reach the admin. */
export const ADMIN_EMAIL_DOMAIN = "mazj.org";

/** RFC 5321 section 4.5.3.1.3: the whole path may not exceed 254 octets. */
const MAX_EMAIL_LENGTH = 254;

/**
 * Splits an address into local part and domain, or returns `null` if it is not
 * usable as an address at all.
 *
 * Rejects, in order: non-strings, anything with whitespace or control
 * characters anywhere in it (a trailing newline is the classic way a copied
 * address smuggles past a naive trim), over-long input, a missing `@`, and an
 * empty local part or domain.
 */
function splitEmail(raw: unknown): { local: string; domain: string } | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return null;

  // No internal whitespace or control characters. Written as escapes because a
  // literal control byte in a .ts file is an ESLint parse error.
  if (/[\s\u0000-\u001f\u007f-\u009f]/.test(trimmed)) return null;

  // Exactly one `@`, which is stricter than RFC 5321 allows: a quoted local
  // part may legitimately contain one. That strictness is deliberate. No such
  // mailbox exists on this domain, and requiring a single `@` means the quoted
  // local-part attack is refused on two independent grounds rather than one.
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@") || at === trimmed.length - 1) {
    return null;
  }

  return { local: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
}

/**
 * Is this address permitted to use the admin?
 *
 * Case-insensitive on the domain, because DNS is. The local part's case is
 * preserved and never compared: we authorise a domain, not a person, and
 * Supabase owns identity for the individual.
 */
export function isAllowedAdminEmail(raw: unknown): boolean {
  const parts = splitEmail(raw);
  if (!parts) return false;
  return parts.domain.toLowerCase() === ADMIN_EMAIL_DOMAIN;
}

/**
 * The canonical form to hand to Supabase, or `null` if the address is not
 * allowed.
 *
 * Lowercased in full so that `O.Khalil@MAZJ.org` and `o.khalil@mazj.org` cannot
 * become two separate accounts with two separate sessions. Supabase treats
 * addresses case-insensitively, but normalising here means our own logs, rate
 * limit buckets and audit trails agree with it rather than fragmenting.
 */
export function normaliseAdminEmail(raw: unknown): string | null {
  const parts = splitEmail(raw);
  if (!parts) return null;
  if (parts.domain.toLowerCase() !== ADMIN_EMAIL_DOMAIN) return null;
  return `${parts.local.toLowerCase()}@${parts.domain.toLowerCase()}`;
}
