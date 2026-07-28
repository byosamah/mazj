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

function disallowedPaths(result: MetadataRoute.Robots): string[] {
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  return rules.flatMap((rule) => {
    const disallow = rule?.disallow;
    if (disallow === undefined) return [];
    return Array.isArray(disallow) ? disallow : [disallow];
  });
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
