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

/**
 * Hostname of an origin, lowercased. `null` when it cannot be parsed at all.
 *
 * Separated out so the failure is a value rather than a throw: this module is
 * imported by the root layout, so a `new URL()` that raises here takes down
 * every page on the site, including the error page that would have explained
 * why.
 */
function hostnameOf(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True while the origin is a host MAZJ does not intend to rank: the RFC 2606
 * placeholder, a Vercel-assigned `*.vercel.app` deployment URL, or anything
 * unparseable.
 *
 * 🔴 This is what keeps a pre-launch deploy out of Google. What sits on a
 * staging host is a complete bilingual copy of the pages `mazj.org` currently
 * ranks #1-3 with on the Arabic head terms, so a crawler finding it before the
 * domain move is a duplicate-content event against MAZJ's own only equity.
 * `app/robots.ts` reads this and serves `Disallow: /` instead of the launch
 * rules.
 *
 * It lifts itself. The moment `NEXT_PUBLIC_SITE_URL` names the real domain this
 * is false and robots.txt returns to normal, so there is no "remember to
 * unblock indexing" step at launch. That matters more than it looks: a manual
 * step gets forgotten, and this particular one fails silently, in the direction
 * of "the new site never appears in Google", which can go unnoticed for weeks.
 *
 * Unparseable counts as pre-launch on purpose. An origin we cannot read is one
 * every canonical on the site is already built from wrongly, and refusing
 * crawlers is the recoverable half of that mistake.
 */
export const IS_PRELAUNCH_ORIGIN = (() => {
  if (IS_PLACEHOLDER_ORIGIN) return true;

  const host = hostnameOf(SITE_URL);
  if (host === null) return true;

  // Anchored on both ends, with a boundary before it: `mazj.vercel.app` and a
  // bare `vercel.app` match, `notvercel.app` and `vercel.app.example.com` do
  // not. A bare `includes("vercel.app")` would block a real domain that merely
  // contained the string, which at launch is the expensive direction to be
  // wrong in.
  return /(^|\.)vercel\.app$/.test(host);
})();

/** Absolute URL for a root-relative path (`/en/spaces` -> `https://…/en/spaces`). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
