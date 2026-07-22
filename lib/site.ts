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

// Launch gate. The placeholder must never survive a production build.
//
// This used to gate on `process.env.VERCEL_ENV === "production"`, which is a
// HOST-specific variable: it is undefined on Netlify, Cloudflare Pages, a
// plain `npm run build && npm start` self-host, AND on a Vercel *preview*
// deploy. On every one of those the gate silently did nothing and the build
// shipped `https://mazj.example` into all 20 sitemap <loc> entries, every
// canonical, every hreflang, every og:url, the JSON-LD @id and robots.txt.
// Verified in rendered output, so this was a real shipped bug, not a theory.
//
// NODE_ENV is set by Next itself ("production" for `next build` / `next
// start`, "development" for `next dev`), so it is true on every host and in
// every self-host. Dev keeps the placeholder and stays usable.
if (!configured && process.env.NODE_ENV === "production") {
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is unset. This is a production build, so every " +
      "canonical, hreflang, og:url, sitemap <loc>, JSON-LD @id and " +
      `robots.txt line would point at ${PLACEHOLDER_ORIGIN}, which is an ` +
      "RFC 2606 reserved name and can never resolve.\n\n" +
      "Fix: set NEXT_PUBLIC_SITE_URL to the real public origin, scheme " +
      "included and NO trailing slash, before building. For example:\n" +
      "  NEXT_PUBLIC_SITE_URL=https://mazj.sa npm run build\n" +
      "or add it to .env.production / the host's environment variables."
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
