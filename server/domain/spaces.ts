/**
 * The bridge between this site's URLs and Rekaz's catalog.
 *
 * Our route is `/spaces/meeting-room`; Rekaz's product is
 * `ghrfh-alajtmaaat-almlqa`. Neither side can be renamed to match the other:
 * ours is an indexed English URL with ranking history, theirs is owned by the
 * Rekaz dashboard. So the mapping is explicit, in one place, and tested against
 * the live catalog.
 *
 * 🔴 Mapped by SLUG, not by product id. Slugs are stable and human-checkable
 * against `lib/links.ts`; product ids are opaque and, in the case of PRICE ids,
 * actively rotate when someone edits a price in the Rekaz dashboard.
 *
 * Pure and framework-free: `lib/routes.ts` owns the public route table, this
 * owns the commerce mapping, and neither imports the other. The duplication of
 * the four slugs is deliberate and covered by a sync test, matching the pattern
 * `server/CLAUDE.md` prescribes for constants that exist on both sides of the
 * boundary.
 */

/** A bookable space, as it appears in this site's URLs. */
export const SPACE_SLUGS = [
  "coworking",
  "private-office",
  "meeting-room",
  "event-hall",
] as const;

export type SpaceSlug = (typeof SPACE_SLUGS)[number];

/** How a space is sold. Decides which Rekaz endpoint the booking goes to. */
export type BookingFlow = "reservation" | "subscription";

export type SpaceMapping = {
  /** Our URL segment under `/spaces/`. */
  slug: SpaceSlug;
  /** The `slug` field on the Rekaz product. */
  rekazSlug: string;
  flow: BookingFlow;
};

export const SPACES: readonly SpaceMapping[] = [
  {
    slug: "coworking",
    rekazSlug: "adwyh-almsahh-almshtrkh",
    flow: "subscription",
  },
  {
    slug: "private-office",
    rekazSlug: "private-office",
    flow: "subscription",
  },
  {
    slug: "meeting-room",
    rekazSlug: "ghrfh-alajtmaaat-almlqa",
    flow: "reservation",
  },
  {
    slug: "event-hall",
    rekazSlug: "qaah-alfaalyat-almaarj",
    flow: "reservation",
  },
] as const;

export function spaceBySlug(slug: string): SpaceMapping | null {
  return SPACES.find((s) => s.slug === slug) ?? null;
}

export function isSpaceSlug(value: unknown): value is SpaceSlug {
  return (
    typeof value === "string" && SPACE_SLUGS.includes(value as SpaceSlug)
  );
}
