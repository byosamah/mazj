import type { MetadataRoute } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The pre-launch deployment must not be crawlable.
 *
 * MAZJ's only organic ranking equity lives on `mazj.org` (#1-3 in Arabic for
 * the head coworking terms under Saudi geo). This site is a complete bilingual
 * replacement for those pages, and it goes onto a public `*.vercel.app` host
 * weeks or months before the domain move and the 301 map run. If Google finds
 * it there, MAZJ competes with itself using the one asset it cannot rebuild.
 *
 * The protection is `IS_PRELAUNCH_ORIGIN` in `lib/site.ts`, read by
 * `app/robots.ts`. It is derived from the origin rather than from a flag, so it
 * cannot drift out of sync with reality and there is nothing to remember to
 * switch off at launch. This test pins both halves of that: that a deployment
 * host is refused, and that the real domain is NOT, because a block that fails
 * to lift is the same bug pointing the other way and is far harder to notice.
 */

/** Load `app/robots` fresh, as if served from `origin`. */
async function robotsServedFrom(origin: string): Promise<MetadataRoute.Robots> {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  // `lib/site.ts` reads the environment at module scope, which is deliberate
  // (see its header). Re-evaluating the module graph is therefore the only way
  // to ask it a second question.
  vi.resetModules();
  const { default: robots } = await import("@/app/robots");
  return robots();
}

type RobotsGroup = {
  userAgent?: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
};

function groups(result: MetadataRoute.Robots): RobotsGroup[] {
  return (Array.isArray(result.rules) ? result.rules : [result.rules]).filter(
    Boolean
  ) as RobotsGroup[];
}

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Every path disallowed anywhere in the file, DEDUPLICATED.
 *
 * ⚠️ It deduplicates because since 2026-08-02 the launch shape has more than
 * one group and each must repeat `/admin`, so the raw list legitimately
 * contains it once per group. Asserting on the raw list would make this helper
 * report a group COUNT dressed up as a path list, and adding a user-agent
 * would then fail a test about admin exposure for no reason.
 */
function disallowedPaths(result: MetadataRoute.Robots): string[] {
  return [...new Set(groups(result).flatMap((rule) => list(rule.disallow)))];
}

/** Every user-agent token the file names, across all groups. */
function userAgents(result: MetadataRoute.Robots): string[] {
  return groups(result).flatMap((rule) => list(rule.userAgent));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robots.txt before launch", () => {
  it("refuses the whole site on a Vercel deployment host", async () => {
    expect(disallowedPaths(await robotsServedFrom("https://mazj.vercel.app"))).toEqual(
      ["/"]
    );
  });

  it("refuses it on a branch or preview deployment host too", async () => {
    expect(
      disallowedPaths(
        await robotsServedFrom("https://mazj-git-main-byosamah.vercel.app")
      )
    ).toEqual(["/"]);
  });

  it("refuses it while the origin is still the RFC 2606 placeholder", async () => {
    // An unset `NEXT_PUBLIC_SITE_URL` falls back to `https://mazj.example`. A
    // production build refuses to start in that state, but a build that somehow
    // reaches a crawler must not invite it in.
    expect(disallowedPaths(await robotsServedFrom(""))).toEqual(["/"]);
  });

  it("refuses it when the origin cannot be parsed at all", async () => {
    expect(disallowedPaths(await robotsServedFrom("mazj.sa"))).toEqual(["/"]);
  });

  it("does not advertise a sitemap while refusing to be crawled", async () => {
    // Offering 24 URLs and then refusing to serve them is a contradiction, and
    // a sitemap is the most effective way to get a host discovered in the first
    // place.
    const result = await robotsServedFrom("https://mazj.vercel.app");

    expect(result.sitemap).toBeUndefined();
  });
});

describe("robots.txt at launch", () => {
  it.each([
    "https://www.mazj.sa",
    "https://mazj.sa",
    "https://www.mazj.org",
  ])("serves the launch rules on %s", async (origin) => {
    const result = await robotsServedFrom(origin);
    const rule = Array.isArray(result.rules) ? result.rules[0] : result.rules;

    expect(rule?.allow).toBe("/");
    expect(disallowedPaths(result)).toEqual(["/admin"]);
    expect(result.sitemap).toBe(`${origin}/sitemap.xml`);
  });

  it("🔴 matches the deployment host on a boundary, not a substring", async () => {
    // `hostname.includes("vercel.app")` would silently block a real domain that
    // happened to contain the string. At launch that failure is invisible: the
    // site is live, nothing is broken on screen, and it is simply never
    // indexed. Test the shape that a naive check gets wrong.
    const result = await robotsServedFrom("https://vercel.app.mazj.sa");

    expect(disallowedPaths(result)).toEqual(["/admin"]);
  });
});

/**
 * The AI crawler groups, added 2026-08-02 on the owner's ruling that every AI
 * search engine may read the site.
 */
describe("robots.txt AI crawler policy at launch", () => {
  const LAUNCH = "https://mazj.sa";

  it("🔴 EVERY named group restates /admin, because a group does not inherit from *", async () => {
    // This is the whole reason these tests exist. robots.txt group selection is
    // most-specific-wins: a crawler obeys the ONE group matching its own name
    // and ignores every other group, `*` included. So the moment `GPTBot` has a
    // group, it stops inheriting the wildcard's `Disallow: /admin`, and a group
    // carrying only `Allow: /` hands the admin tool to that crawler. Nothing
    // about the file would look wrong: it would read as deliberately more open.
    //
    // Same shape as the ESLint flat-config trap in the root CLAUDE.md, and the
    // same fix: a narrower block must RESTATE everything that still applies.
    const result = await robotsServedFrom(LAUNCH);

    expect(groups(result).length).toBeGreaterThan(1);
    for (const group of groups(result)) {
      expect(
        list(group.disallow),
        `group [${list(group.userAgent).join(", ")}] does not disallow /admin`
      ).toContain("/admin");
    }
  });

  it("names the crawlers that can actually cite MAZJ back", async () => {
    const agents = userAgents(await robotsServedFrom(LAUNCH));

    // One per engine that grounds an answer in live web content. If an engine
    // is dropped from this list it silently stops being covered by an explicit
    // rule, which is survivable today and is not the day someone adds a
    // Disallow to the wildcard.
    for (const bot of [
      "GPTBot",
      "OAI-SearchBot",
      "ClaudeBot",
      "PerplexityBot",
      "Google-Extended",
      "Bingbot",
      "Applebot",
    ]) {
      expect(agents).toContain(bot);
    }
  });

  it("allows every named AI crawler rather than blocking it", async () => {
    for (const group of groups(await robotsServedFrom(LAUNCH))) {
      expect(list(group.allow)).toContain("/");
      expect(list(group.disallow)).not.toContain("/");
    }
  });

  it("🔴 does NOT block CCBot, which was offered and declined", async () => {
    // Blocking the training-only harvester is the obvious tidy-up and it is not
    // ours to make: it was put to the owner on 2026-08-02 as the "block
    // training-only, allow search" option and declined in favour of allowing
    // everything. A future session reading a list of AI user-agents will want
    // to add it. This is the reason not to.
    const result = await robotsServedFrom(LAUNCH);

    expect(userAgents(result)).not.toContain("CCBot");
    expect(disallowedPaths(result)).toEqual(["/admin"]);
  });

  it("still refuses every AI crawler before launch", async () => {
    // The pre-launch shape is a single wildcard group refusing everything, and
    // it must stay that way: naming AI crawlers in their own groups there would
    // give each one a group with no `Disallow: /`, i.e. it would invite exactly
    // the crawlers the pre-launch block exists to keep out.
    const result = await robotsServedFrom("https://mazj-tau.vercel.app");

    expect(groups(result)).toHaveLength(1);
    expect(userAgents(result)).toEqual(["*"]);
    expect(disallowedPaths(result)).toEqual(["/"]);
  });
});
