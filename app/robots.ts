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
 * no parameterised routes. ⚠️ The one API route that DOES exist,
 * `/api/health`, is handled by an `X-Robots-Tag: noindex` header on the route
 * itself rather than by a rule here, for exactly the reason given two
 * paragraphs above: a `Disallow` would stop the directive being read.
 *
 * ✅ **AI crawlers are ALL allowed, owner ruling 2026-08-02**, and the launch
 * rules now say so in their own groups rather than leaving it to the wildcard.
 * The reasoning, the group-inheritance trap that makes those groups dangerous
 * to write carelessly, and why CCBot is deliberately not blocked, are all in
 * the comment on the rules themselves. Read it before adding or removing a
 * user-agent here.
 *
 * ⚠️ Blocking an AI crawler is not a neutral act for MAZJ specifically: a
 * business with no domain authority and no backlink profile gets found by AI
 * search on content quality rather than on rank, which is the one lever this
 * site can actually pull before launch. `mazj.sa` (the Rekaz storefront) ships
 * the OPPOSITE policy today, blocking GPTBot, ClaudeBot and Google-Extended
 * while allowing OAI-SearchBot, PerplexityBot and Googlebot. That file is
 * Rekaz's, not ours, and the two are allowed to disagree. Do not "reconcile"
 * them by copying theirs.
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
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/admin",
      },
      // 🔴 EVERY GROUP BELOW MUST RESTATE `/admin`, AND THE REASON IS THE SAME
      // SHAPE AS THE ESLint FLAT-CONFIG TRAP IN THE ROOT `CLAUDE.md`: a later,
      // narrower block does not MERGE with the wildcard, it REPLACES it.
      //
      // robots.txt group selection is most-specific-wins. A crawler picks the
      // ONE group whose user-agent token best matches its own name and ignores
      // every other group, `*` included. So the moment `GPTBot` gets a group of
      // its own it stops inheriting anything from `*`, and a group that says
      // only `Allow: /` grants that crawler the admin tool. Omitting the
      // disallow here would not read as a mistake: the file would look more
      // permissive on purpose. Verify with a per-agent robots tester, one
      // request per user-agent, never by reading.
      //
      // ⚠️ Which raises the fair question of why these groups exist at all,
      // since `User-agent: * / Allow: /` already permits every one of them. Two
      // answers, and only the second is load-bearing:
      //   1. The file states the decision instead of implying it. Somebody
      //      auditing MAZJ's AI posture reads robots.txt, not a git log.
      //   2. It survives the NEXT edit. The day anyone adds a `Disallow:` to
      //      the wildcard group (a staging path, a print view, an export
      //      endpoint), every AI crawler inherits it silently and MAZJ loses
      //      citations for a reason nobody connected to that commit. Pinning
      //      them here means that future edit has to be made deliberately, in
      //      each group, or not at all.
      //
      // 🔴 CCBot is deliberately ABSENT, i.e. deliberately allowed. Blocking it
      // was offered to the owner on 2026-08-02 as the "block training-only,
      // allow search" option and was DECLINED in favour of allowing everything.
      // It is the one crawler here that harvests for training without ever
      // being able to cite MAZJ back, so adding a `Disallow` for it is the
      // obvious-looking tidy-up. Do not make it: that is the owner's call and
      // it has already been made.
      //
      // ⚠️ Note that GPTBot serves BOTH training and ChatGPT's search citations
      // for OpenAI, so it cannot be split. Blocking it to avoid training also
      // ends ChatGPT citation. That trade is what the ruling above settled.
      {
        userAgent: [
          // OpenAI. GPTBot crawls, ChatGPT-User fetches during a live browse,
          // OAI-SearchBot builds the search index ChatGPT cites from.
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          // Anthropic. Two tokens because the older `anthropic-ai` is still
          // honoured and costs nothing to keep.
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          // Perplexity, which always cites with a link, so it is the highest
          // value-per-crawl of the set for a business with no domain authority.
          "PerplexityBot",
          // Google's AI surfaces. 🔴 Google-Extended governs Gemini and the AI
          // Overviews grounding ONLY. It is not Googlebot and blocking it does
          // NOT affect classical Search ranking, which is why it is safe to
          // name here and why it is so often mistakenly blocked elsewhere.
          "Google-Extended",
          // Microsoft. Copilot has no crawler of its own: it reads Bing's
          // index, so Bingbot is the Copilot decision.
          "Bingbot",
          "msnbot",
          // Apple's, which grounds Siri and Spotlight summaries.
          "Applebot",
          "Applebot-Extended",
          // Meta AI and Amazon, both of which cite in-product.
          "meta-externalagent",
          "Amazonbot",
        ],
        allow: "/",
        disallow: "/admin",
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
