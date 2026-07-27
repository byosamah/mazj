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
 * `/admin` IS disallowed, and that is not a contradiction of the paragraph
 * above. The trap there is specific: disallowing a page that is LINKED TO stops
 * a crawler reading its noindex while leaving it free to index the bare URL it
 * found in the link. Nothing anywhere links to `/admin`, so there is no
 * discovered-but-unreadable state to fall into, and the Disallow is pure
 * benefit. The admin layout sets `robots: {index: false}` as well, so a crawler
 * that ignores this file still gets told.
 *
 * Nothing else needs blocking: there are no faceted URLs, no search results and
 * no parameterised routes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
