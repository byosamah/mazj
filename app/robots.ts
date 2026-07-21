import type {MetadataRoute} from "next";
import {absoluteUrl} from "@/lib/site";

/**
 * robots.txt.
 *
 * 🔴 Deliberately empty `disallow`. `/privacy` and `/terms` are kept out of the
 * index by the `robots: {index: false, follow: true}` meta tag that
 * `pageMetadata` sets, and adding a `Disallow` for them would BREAK that: a
 * disallowed URL is never crawled, so Google never reads the noindex, and
 * because the footer links to both pages it can still index the bare URLs it
 * discovered from those links. Disallow and noindex cancel each other out. Pick
 * noindex, which is what `lib/metadata.ts` already does.
 *
 * Nothing else here needs blocking: there are no faceted URLs, no search
 * results, no parameterised routes, and no admin surface.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
