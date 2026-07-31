import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {INDEXABLE_ROUTES} from "@/lib/routes";
import {absoluteUrl} from "@/lib/site";

import {listIndexableEventSlugs} from "./[locale]/events/_lib/events";

/**
 * XML sitemap: 10 static routes x 2 locales, plus one entry per event that has
 * a page, each carrying its full hreflang cluster.
 *
 * 🔴 Next.js gotcha: `alternates.languages` does NOT auto-emit a
 * self-referencing `<xhtml:link>` for the entry's own `<loc>`. Google discards
 * an entire hreflang cluster when a page omits itself, so both locales are
 * listed explicitly on EVERY entry (the `en` row includes `en`, the `ar` row
 * includes `ar`). Do not "deduplicate" that away.
 *
 * The HTML `<link rel="alternate">` tags in `lib/metadata.ts` describe the same
 * clusters. Two annotation methods are allowed, but they must AGREE or Google
 * drops the conflicting pair, so both are built from the same `/{locale}{path}`
 * shape. Change one, change the other.
 *
 * ⚠️ It became `async` on 2026-07-28, when events moved into the database. This
 * file now reads through `app/[locale]/events/_lib`, which is a frontend module
 * exporting plain data; the sanctioned crossing into `@/server` happens there,
 * not here.
 */

/**
 * 🔴 WITHOUT THIS, THE EVENT URLS NEVER APPEAR.
 *
 * Next prerenders `sitemap.ts` at BUILD time by default, and it did: a
 * production build served exactly the 11 static routes x 2 locales and **zero**
 * events, because the build ran before those rows existed. Every event
 * published afterwards would have stayed out of the sitemap until somebody
 * happened to deploy, which is precisely the manual step this whole feature was
 * built to remove. Caught by diffing a real `npm start` against the dev server;
 * the dev server renders it per request and looks perfectly correct, so this is
 * invisible in development.
 *
 * An hour, not `force-dynamic`: no crawler needs a sitemap fresher than that,
 * and a cached one cannot be turned into database load by a bot fetching it in
 * a loop.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No `lastModified` on the static routes: stamping build time on every URL
  // makes lastmod always equal crawl time, which is exactly the
  // "inconsistently accurate" signal Google says it ignores — and it erodes
  // trust in the field sitewide. Omitting it is more honest than lying about
  // it on 20 URLs per build.
  const staticEntries = routing.locales.flatMap((locale) =>
    INDEXABLE_ROUTES.map(({path, priority, changeFrequency}) => ({
      url: absoluteUrl(`/${locale}${path}`),
      changeFrequency,
      priority,
      alternates: {
        languages: {
          // Both locales, always. The self-reference is load-bearing.
          en: absoluteUrl(`/en${path}`),
          ar: absoluteUrl(`/ar${path}`),
          "x-default": absoluteUrl(`/en${path}`),
        },
      },
    }))
  );

  // 🔴 ONLY events that actually render a page. `listIndexableEventSlugs`
  // applies the same rule the archive links do, and it has to: a sitemap entry
  // for a URL that answers 404 is a crawl error MAZJ reported to Google about
  // itself. Most of the 41 imported historical events have no page and are
  // correctly absent.
  //
  // ⚠️ These DO carry `lastModified`, unlike the static routes above, and the
  // asymmetry is deliberate rather than an oversight: an event row has a real
  // creation timestamp, so the value is a fact rather than a build artifact.
  const events = await listIndexableEventSlugs();

  const eventEntries = routing.locales.flatMap((locale) =>
    events.map(({slug, lastModified}) => ({
      url: absoluteUrl(`/${locale}/events/${slug}`),
      lastModified,
      changeFrequency: "weekly" as const,
      // Below `/events` itself (0.7). The listing is the page that should rank
      // for "events in Al-Khobar"; an individual event competes for its own
      // name and should not outrank its own parent.
      priority: 0.5,
      alternates: {
        languages: {
          en: absoluteUrl(`/en/events/${slug}`),
          ar: absoluteUrl(`/ar/events/${slug}`),
          "x-default": absoluteUrl(`/en/events/${slug}`),
        },
      },
    }))
  );

  return [...staticEntries, ...eventEntries];
}
