import type {MetadataRoute} from "next";
import {IS_PRELAUNCH_ORIGIN, absoluteUrl} from "@/lib/site";

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
 *
 * 🔴 All of that describes the LAUNCHED site. Before launch the answer is the
 * opposite one, see below.
 */
export default function robots(): MetadataRoute.Robots {
  // 🔴 Pre-launch, on a `*.vercel.app` host, refuse everything.
  //
  // The rules below are written for the day this site IS mazj.sa / mazj.org.
  // Serving them from a deployment URL invites Google to index a full bilingual
  // duplicate of the pages mazj.org already ranks with, on a throwaway host,
  // weeks before the 301 map in `docs/mazj-org-301-redirect-map.md` runs. That
  // is the one SEO mistake this project genuinely cannot afford.
  //
  // No `sitemap:` line either. Advertising 24 URLs while refusing to let them
  // be fetched is a contradiction, and the sitemap is the single most effective
  // way to get a host discovered.
  //
  // ⚠️ This is a request, not a wall. It stops the crawlers that honour it from
  // reading any CONTENT; it cannot stop a URL discovered elsewhere (certificate
  // transparency logs list every Vercel hostname) from being indexed bare. If
  // the deployment must be genuinely invisible rather than merely unindexed,
  // that is Vercel's Deployment Protection, not this file.
  //
  // Lifts itself when `NEXT_PUBLIC_SITE_URL` names the real domain. See
  // `IS_PRELAUNCH_ORIGIN` in `lib/site.ts`.
  if (IS_PRELAUNCH_ORIGIN) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
