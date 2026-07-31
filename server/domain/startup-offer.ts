import { randomBytes } from "node:crypto";

/**
 * The startups & builders offer, as rules rather than as plumbing.
 *
 * Pure and framework-free, so every decision in here is testable in three lines
 * with no database, no request and no clock of its own.
 *
 * 🔴 THE FACT THAT GOVERNS THIS WHOLE FEATURE: Rekaz has no coupon, discount or
 * promotion API (`docs/rekaz-api-findings.md`). A code minted here therefore
 * cannot be redeemed by software on this site, on mazj.sa, or anywhere else. It
 * is an entitlement a MAZJ person honours in the room. Every piece of copy that
 * mentions it has to say so, and anything that tries to make it self-apply at
 * checkout is building on a field that does not exist.
 */

/**
 * The alphabet every generated identifier is drawn from.
 *
 * Crockford's reasoning, applied for Crockford's reason: these strings are read
 * off a phone screen, typed into WhatsApp, and occasionally read ALOUD to
 * whoever is on the front desk. So the confusable pairs go as pairs, `0`/`O`
 * and `1`/`I`. Exactly 32 symbols survive, which is also a clean 5 bits each.
 *
 * ⚠️ `L` is kept. It is only confusable with `1`, and `1` is already gone, so
 * dropping it too would buy nothing and cost a symbol. The SQL check constraints
 * in the migration encode this same set as `[2-9A-HJ-NP-Z]`; changing one
 * without the other makes every future insert fail its own check.
 */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** How long an approved code stays good. Owner decision, 2026-07-28. */
export const CODE_VALIDITY_DAYS = 30;

/**
 * What stage the applicant says they are at.
 *
 * Three, not five. This is a qualifier on a form a stranger fills in at midnight,
 * and every extra option is a decision they make instead of finishing. The
 * boundaries chosen are the two that actually change the answer: has it been
 * built, and is anyone paying.
 */
export const STARTUP_STAGES = ["idea", "building", "earning"] as const;
export type StartupStage = (typeof STARTUP_STAGES)[number];

/**
 * Which space they are after.
 *
 * 🔴 DUPLICATED from `lib/links.ts` `BOOKING`, deliberately, and NOT imported.
 * `server/` may not import `@/lib/**`: that boundary is what keeps this folder
 * liftable into its own service, and one convenience import is how that stops
 * being true. `test/startup-offer-sync.test.ts` asserts the two lists never
 * drift, which is the same trade `leads.sync.test.ts` made before `leads` was
 * dropped. The migration's check constraint carries the third copy.
 */
export const STARTUP_SPACES = [
  "shared_seat",
  "private_office",
  "meeting_room",
  "event_hall",
] as const;
export type StartupSpace = (typeof STARTUP_SPACES)[number];

/**
 * Cryptographically random characters from `ALPHABET`.
 *
 * 🔴 Rejection sampling, not `byte % 32`.
 *
 * With today's 32-symbol alphabet the modulo happens to be unbiased, because 32
 * divides 256 exactly. That is a property of a constant somebody may edit: drop
 * one confusable symbol later and 31 no longer divides 256, so the first 8
 * symbols become 1.6% more likely than the rest, silently, with every existing
 * test still passing. Rejecting the tail costs a few extra bytes and cannot
 * break that way.
 *
 * `randomBytes`, never `Math.random()`. These identifiers are handed out as
 * proof of a commercial decision, and a predictable generator is one someone can
 * walk to mint themselves a code MAZJ never approved.
 */
function randomChars(count: number): string {
  const limit = 256 - (256 % ALPHABET.length);
  let out = "";

  while (out.length < count) {
    // Over-draw: on average ~1 byte per character, so asking for exactly what
    // is left would mean a round trip to the entropy pool per rejected byte.
    for (const byte of randomBytes(count * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === count) break;
    }
  }

  return out;
}

/**
 * The handle a human quotes: `MZ-XXXXXX`.
 *
 * Not secret and not a credential. It names an application in a WhatsApp
 * message or a phone call, which is the entire job. 32^6 is a billion, which is
 * far more than enough to make a collision a retry rather than a design problem.
 */
export function generateReference(): string {
  return `MZ-${randomChars(6)}`;
}

/**
 * The offer code: `MAZJ-XXXX-XXXX`.
 *
 * Grouped in fours because that is how a person reads a code back to someone,
 * and prefixed `MAZJ-` so that a screenshot of it, arriving with no context in a
 * chat thread, still says who issued it.
 *
 * 40 bits of entropy. Guessing is not really the threat (a guessed code buys a
 * conversation, not a discount, because a person applies the offer), but the
 * column is unique and the service retries on conflict, so a collision costs one
 * extra insert rather than overwriting somebody's entitlement.
 */
export function generateOfferCode(): string {
  return `MAZJ-${randomChars(4)}-${randomChars(4)}`;
}

/**
 * When a code approved at `from` stops being good.
 *
 * ⚠️ The caller STORES this. It must never be recomputed from `decided_at` plus
 * the constant at read time: the day anyone changes `CODE_VALIDITY_DAYS`, a
 * derived expiry silently re-dates every code ever issued, including the ones
 * already sitting in somebody's inbox with a date printed in them.
 */
export function offerCodeExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + CODE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/** Whether a stored expiry has passed. Explicit `now` so tests own the clock. */
export function isCodeExpired(
  expiresAt: string | Date | null,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return false;
  const at = expiresAt instanceof Date ? expiresAt.getTime() : Date.parse(expiresAt);
  return Number.isFinite(at) && at <= now.getTime();
}

/** Narrowing helpers, so a string off a form becomes a typed value or nothing. */
export function asStage(value: unknown): StartupStage | null {
  return STARTUP_STAGES.includes(value as StartupStage)
    ? (value as StartupStage)
    : null;
}

export function asSpace(value: unknown): StartupSpace | null {
  return STARTUP_SPACES.includes(value as StartupSpace)
    ? (value as StartupSpace)
    : null;
}
