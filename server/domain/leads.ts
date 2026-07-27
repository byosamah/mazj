import { normalizePhone } from "./phone";

/**
 * Lead business rules. Pure: no database, no clients, no clock.
 *
 * Everything here is a decision about what a lead *is*, kept separate from how
 * it is stored or transported so it can be tested without either.
 */

/**
 * What the visitor is interested in.
 *
 * 🔴 These mirror the four products in `lib/links.ts` (`BOOKING`), which is
 * frontend code this folder is forbidden to import. The duplication is
 * deliberate: an import edge from the backend back into `lib/` would defeat the
 * whole point of the boundary and make this folder unliftable. The price is
 * four strings that can drift, and `leads.sync.test.ts` pays it by asserting
 * the two lists stay aligned.
 *
 * Snake case because these are database values and the rest of the schema is
 * snake case. The mapping from the frontend's camelCase keys is below.
 */
export const LEAD_INTERESTS = [
  "shared_seat",
  "private_office",
  "meeting_room",
  "event_hall",
  "other",
] as const;

export type LeadInterest = (typeof LEAD_INTERESTS)[number];

/** Frontend `BOOKING` key -> database interest value. */
export const BOOKING_KEY_TO_INTEREST = {
  sharedSeat: "shared_seat",
  privateOffice: "private_office",
  meeting: "meeting_room",
  event: "event_hall",
} as const satisfies Record<string, LeadInterest>;

export const LEAD_LOCALES = ["en", "ar"] as const;
export type LeadLocale = (typeof LEAD_LOCALES)[number];

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "converted",
  "archived",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** What a caller supplies, before normalisation. */
export type LeadInput = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  interest: LeadInterest;
  note?: string | null;
  locale: LeadLocale;
  source?: string | null;
  pagePath?: string | null;
  consent?: boolean;
};

/** What actually gets stored, after normalisation. */
export type NormalizedLead = {
  fullName: string | null;
  email: string | null;
  phoneE164: string | null;
  interest: LeadInterest;
  note: string | null;
  locale: LeadLocale;
  source: string;
  pagePath: string | null;
  consentAt: string | null;
};

export type NormalizeFailure = { field: string; message: string };

/**
 * Cleans and canonicalises a lead, or explains why it cannot be stored.
 *
 * Normalisation happens here rather than in the zod schema because these are
 * business decisions, not shape decisions: that a Saudi number typed with
 * Arabic-Indic digits is the same number, that an email differing only in case
 * is the same address, that a lead nobody can be contacted on is not a lead.
 */
export function normalizeLead(
  input: LeadInput,
  now: Date
): { ok: true; value: NormalizedLead } | { ok: false; error: NormalizeFailure } {
  const fullName = collapse(input.fullName);

  // Lowercased because addresses are case-insensitive in every practical sense
  // and storing mixed case creates duplicates that look identical in a list.
  const email = collapse(input.email)?.toLowerCase() ?? null;

  const rawPhone = collapse(input.phone);
  let phoneE164: string | null = null;
  if (rawPhone) {
    phoneE164 = normalizePhone(rawPhone);
    if (!phoneE164) {
      return {
        ok: false,
        error: {
          field: "phone",
          message:
            "This does not look like a phone number we can reach. " +
            "A Saudi mobile such as 0534600488 works.",
        },
      };
    }
  }

  // Mirrors the `leads_needs_a_contact_channel` check constraint. Enforced in
  // both places on purpose: here so the visitor gets a helpful message, and in
  // the database so an import script or a manual insert cannot bypass it.
  if (!email && !phoneE164) {
    return {
      ok: false,
      error: {
        field: "email",
        message: "Give us either an email address or a phone number.",
      },
    };
  }

  return {
    ok: true,
    value: {
      fullName: fullName ?? null,
      email,
      phoneE164,
      interest: input.interest,
      note: collapse(input.note) ?? null,
      locale: input.locale,
      source: collapse(input.source) ?? "web",
      pagePath: collapse(input.pagePath) ?? null,
      consentAt: input.consent ? now.toISOString() : null,
    },
  };
}

/**
 * Trims, collapses internal whitespace, returns null for empty.
 *
 * The whitespace collapse matters more than it looks: Arabic input methods
 * routinely insert directional marks and non-breaking spaces, so a name that
 * looks identical to another can differ by invisible codepoints.
 */
function collapse(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    // Zero-width and directional formatting characters.
    .replace(/[​-‏‪-‮⁦-⁩﻿]/g, "")
    // Whitespace first, so a tab or newline becomes a space rather than
    // vanishing when the control-character pass below runs.
    .replace(/\s+/g, " ")
    // 🔴 Control characters, which Postgres cannot store in a text column at
    // all. A NUL byte in a name passes JSON.parse, passes zod's `z.string()`,
    // and survives whitespace collapsing, then reaches the driver and comes
    // back as `unsupported Unicode escape sequence`. That surfaced to the
    // client as a 503 upstream_unavailable, blaming our database for the
    // caller's input and telling them to try again with something that can
    // never work. Stripped rather than rejected: no legitimate name, note or
    // path contains one, so there is nothing to warn a real visitor about.
    //
    // The range deliberately skips U+0009 to U+000D (tab, newline, CR and
    // friends), which the whitespace pass above has already turned into spaces.
    .replace(/[\u0000-\u0008\u000E-\u001F\u007F-\u009F]/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
