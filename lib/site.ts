/**
 * The site's absolute origin, and the launch gate that protects it.
 *
 * Every canonical, hreflang, og:url, sitemap entry and JSON-LD `@id` is built
 * from this one value, so a wrong origin is not a cosmetic bug: it points
 * Google's canonical signal at a domain that does not exist, which is strictly
 * worse than shipping no canonical at all.
 *
 * `mazj.example` is a deliberate placeholder (RFC 2606 reserves `.example`, so
 * it can never resolve to a real host). It is meant to be obviously broken in
 * dev rather than plausibly wrong in production.
 */

/** RFC 2606 reserved placeholder. Never resolves. Replaced at launch. */
const PLACEHOLDER_ORIGIN = "https://mazj.example";

const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

// Launch gate. On a real production deploy the placeholder is a hard failure:
// better a red build than 20 canonicals aimed into the void. Local `npm run
// build` stays usable while the production domain is still undecided.
if (!configured && process.env.VERCEL_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is unset on a production deploy. Every canonical, " +
      "hreflang and sitemap URL would point at the placeholder " +
      `${PLACEHOLDER_ORIGIN}, which does not resolve. Set the real origin ` +
      "(no trailing slash) before shipping."
  );
}

/** Absolute origin, no trailing slash. */
export const SITE_URL = (configured || PLACEHOLDER_ORIGIN).replace(/\/$/, "");

/** True while still on the placeholder, for build-time diagnostics. */
export const IS_PLACEHOLDER_ORIGIN = SITE_URL === PLACEHOLDER_ORIGIN;

/** Absolute URL for a root-relative path (`/en/spaces` -> `https://…/en/spaces`). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
