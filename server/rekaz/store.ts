/**
 * Where a buyer finishes a purchase this site cannot complete.
 *
 * 🔴 READ THIS BEFORE CHANGING THE ORIGIN. Rekaz publishes no write endpoint for
 * a one-time (`Merchandise`) product, which is what a MAZJ event ticket is by
 * owner decision on 2026-07-30. So a paid event shows its live price here and
 * sends the buyer to the product's own page on the Rekaz storefront.
 *
 * ⚠️ **The storefront is served from `mazj.sa`, and the launch plan has
 * `www.mazj.sa` serving THIS site.** On that day every paid event's button
 * points at a route this application does not have, and every buyer lands on our
 * own 404 with the ticket unsold. The owner knows and has accepted it as a
 * launch-day chore rather than a blocker; probed 2026-07-30, `mazj.rekaz.io`,
 * `mazj.rekaz.sa`, `store.mazj.sa` and `shop.mazj.sa` all fail to resolve, so
 * `mazj.sa` is currently the only address this store has.
 *
 * 🔴 **REKAZ ACCEPTS EXACTLY ONE CUSTOM DOMAIN** (owner, 2026-07-31). That does
 * NOT block moving the store to a subdomain: changing which single domain Rekaz
 * holds is not the same as adding a second. What it does rule out is an OVERLAP
 * WINDOW. There is no period where `mazj.sa` and `store.mazj.sa` both serve the
 * store, so the switch is a hard cutover and any stale `mazj.sa` store link is
 * dead from that instant.
 *
 * ⚠️ The saving grace is that the cutover HANDS US the tool to clean up after
 * it: the moment `mazj.sa` stops pointing at Rekaz it points at us, so we can
 * 301 the old store paths ourselves. `LEGACY_STORE_PATHS` in `lib/links.ts`
 * already does exactly that for the four room products. A `/:locale/merchandise/
 * :slug` rule pointing at the new store origin is the missing sibling, and it
 * can only be written once we own the domain.
 *
 * The mitigation is this file: the origin is named ONCE, so pointing it at a
 * subdomain later is a one-line change rather than a hunt through components,
 * and `storeSharesDomainWith` lets `npm run check:env` say so out loud. It warns
 * and never throws, deliberately: a boot refusal here could take a deploy down
 * over a link.
 *
 * 🔴 THIS MODULE HAS NO IMPORTS AT ALL, deliberately, and that is worth
 * defending because the obvious edit is to import `REKAZ_PRODUCT_TYPE` from
 * `./types`. `scripts/check-env.mts` imports this file, and it runs under Node's
 * raw TypeScript stripping rather than through a bundler, where an extensionless
 * relative import does not resolve: doing the obvious thing makes
 * `npm run check:env` die with `ERR_MODULE_NOT_FOUND` naming a file that plainly
 * exists. The product-type numbers are therefore written literally here, and
 * `store.test.ts` asserts they still equal `REKAZ_PRODUCT_TYPE`, so the
 * duplication cannot drift silently. Same shape as every other cross-boundary
 * constant in this repo: duplicate, then pin with a sync test.
 *
 * No `import "server-only"` either: this is a pure string builder holding no
 * secret, exactly like `./types.ts`, and that is what keeps it unit-testable.
 */

/** The one place the storefront's address is written. */
export const REKAZ_STORE_ORIGIN = "https://mazj.sa";

/**
 * The storefront's path segment per Rekaz product type.
 *
 * Keys are `REKAZ_PRODUCT_TYPE` in `./types.ts`: 0 reservation, 1 subscription,
 * 2 merchandise. Written as literals for the reason in the header above, and
 * pinned against the real enum by `store.test.ts`.
 *
 * All three shapes were verified 200 on 2026-07-30. The bare, locale-less form
 * answers 308 to `/ar/...`, which is why a locale is always written in: an
 * English reader following a locale-less link would land in Arabic.
 */
const STORE_SEGMENT: Record<number, string> = {
  0: "reservation",
  1: "subscription",
  2: "merchandise",
};

/**
 * Where this product is bought, or `null` if we cannot say.
 *
 * 🔴 `type` is `number`, not `RekazProductType`, and that is not laziness. These
 * types are hand-written over untrusted JSON that Rekaz can change without
 * telling anyone, so a value outside the union is a live possibility. An
 * unmapped type returns `null` rather than interpolating `undefined` into a
 * path, which would build a real-looking URL that 404s at the last click of a
 * purchase. The caller then renders the same "not available right now" state it
 * already shows when Rekaz is unreachable.
 */
export function rekazStoreUrl(
  product: { slug: string; type: number },
  locale: string
): string | null {
  const segment = STORE_SEGMENT[product.type];
  if (!segment) return null;

  const lang = locale === "ar" ? "ar" : "en";
  return `${REKAZ_STORE_ORIGIN}/${lang}/${segment}/${product.slug}`;
}

/**
 * Does this site's own origin collide with the storefront's?
 *
 * Compared with a leading `www.` stripped from both sides, because `mazj.sa` and
 * `www.mazj.sa` are different hosts and identical problems. Anything unparseable
 * or absent is reported as no collision: this feeds a warning, and a warning
 * that fires on a missing variable trains people to ignore it.
 */
export function storeSharesDomainWith(siteOrigin: string | undefined): boolean {
  if (!siteOrigin) return false;

  const bare = (value: string): string | null => {
    try {
      return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return null;
    }
  };

  const site = bare(siteOrigin);
  return site !== null && site === bare(REKAZ_STORE_ORIGIN);
}
