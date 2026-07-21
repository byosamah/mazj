import type {MetadataRoute} from "next";
import {routing} from "@/i18n/routing";
import {INDEXABLE_ROUTES} from "@/lib/routes";
import {absoluteUrl} from "@/lib/site";

/**
 * XML sitemap: 10 routes x 2 locales = 20 URLs, each carrying its full hreflang
 * cluster.
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
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    INDEXABLE_ROUTES.map(({path, priority, changeFrequency}) => ({
      url: absoluteUrl(`/${locale}${path}`),
      lastModified,
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
}
