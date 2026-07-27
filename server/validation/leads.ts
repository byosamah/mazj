import { z } from "zod";

import { LEAD_INTERESTS, LEAD_LOCALES } from "../domain/leads";

/**
 * Shape validation for lead submissions.
 *
 * The split of responsibility with `domain/leads.ts` is deliberate:
 *
 *   * here      — is this the right SHAPE? right types, present, within bounds
 *   * domain    — is this MEANINGFUL? is that a reachable phone number, can we
 *                 actually contact this person, what is the canonical form
 *
 * Keeping them apart means the business rules stay testable without constructing
 * HTTP payloads, and the schema stays readable as a description of the wire
 * format rather than a pile of custom refinements.
 *
 * Every `max` mirrors a `check` constraint in the migration. When one moves,
 * move the other; the database is the backstop, this is the friendly error.
 */
export const createLeadSchema = z
  .object({
    fullName: z.string().max(120).nullish(),

    // z.email() rather than a hand-rolled regex. Email grammar is genuinely
    // baroque and every homegrown pattern rejects somebody's real address.
    email: z.email("That does not look like an email address").max(254).nullish(),

    // Intentionally loose: the domain layer parses and canonicalises, and it
    // understands Arabic-Indic digits, which any regex written here would not.
    phone: z.string().max(40).nullish(),

    interest: z.enum(LEAD_INTERESTS),
    note: z.string().max(2000).nullish(),
    locale: z.enum(LEAD_LOCALES).default("en"),

    // Where the submission came from. Bounded because it reaches a column with
    // a 40-character check constraint.
    source: z.string().max(40).nullish(),
    pagePath: z.string().max(512).nullish(),

    consent: z.boolean().default(false),
  })
  // Unknown keys are dropped rather than rejected. A stray analytics field
  // appended by a form library should not fail a real customer's submission.
  .strip();

export type CreateLeadPayload = z.infer<typeof createLeadSchema>;

/** Flattens a zod error into `{ field: message }` for the HTTP response. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
