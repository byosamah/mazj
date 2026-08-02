import {defineRouting} from "next-intl/routing";

/**
 * MAZJ locale routing.
 * English-first: `/` redirects to `/en`; Arabic lives at `/ar` (RTL).
 * `localePrefix: "always"` keeps both languages explicitly prefixed
 * so URLs are stable and shareable (/en/..., /ar/...).
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
  /**
   * 🔴 OFF BECAUSE IT DISAGREED WITH THE OTHER TWO ANNOTATIONS, AND GOOGLE'S
   * DOCUMENTED RESPONSE TO CONFLICTING hreflang IS TO DISCARD THE WHOLE SET.
   *
   * next-intl's middleware emits an hreflang cluster as a `Link:` HTTP header
   * on every response. This site ALSO emits the same cluster twice more: as
   * `<link rel="alternate">` tags from `lib/metadata.ts`, and as
   * `<xhtml:link>` entries on all 22 sitemap URLs. Two of the three agree
   * exactly, key for key. The header did not.
   *
   * Measured on `/en/spaces` and `/ar/spaces`, 2026-08-02:
   *   header says   x-default -> /spaces        (NO locale prefix)
   *   HTML tag says x-default -> /en/spaces
   * A locale-less `/spaces` is not a canonical URL on this site at all; it is
   * a path next-intl's own middleware redirects. So the header was pointing
   * the default-language signal at a redirect while the page pointed it at a
   * real URL, on every route, in both locales.
   *
   * ⚠️ It gets structurally worse at launch rather than better. Both
   * `mazj.sa` and `mazj.org` will serve this one app, and the header is built
   * from the host that served the request while every other annotation is
   * built from the single `NEXT_PUBLIC_SITE_URL`. So the day the second domain
   * goes live the header would name one domain and the page the other, which
   * is the duplicate-content shape `lib/site.ts` exists to prevent.
   *
   * Nothing is lost by removing it: the HTML tags and the sitemap already
   * carry the full cluster, including the self-reference Google requires.
   *
   * ⚠️ Do NOT confuse this with `localeDetection`, a separate field that must
   * keep working: it is what sends a first-time Arabic visitor to `/ar`.
   * `test/hreflang-annotations.test.ts` pins both halves.
   */
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
