import { afterEach, describe, expect, it, vi } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { INDEXABLE_ROUTES, NOINDEX_ROUTES } from "@/lib/routes";

/**
 * 🔴 The sitemap reads the events table since 2026-07-28, so it is mocked here.
 *
 * Without this the suite makes a live Supabase call, which is wrong three ways:
 * it is a network round trip inside a unit test, it fails on a fresh clone with
 * no credentials, and its result would vary with whatever is in the database on
 * the day, so a test about the ADMIN's absence would start failing because
 * somebody published an event.
 *
 * A non-empty return is deliberate: mocking it to `[]` would let a bug that
 * drops every event URL from the sitemap pass this file unnoticed.
 */
vi.mock("@/app/[locale]/events/_lib/events", () => ({
  listIndexableEventSlugs: async () => [
    { slug: "coffee-sketch-v10", lastModified: new Date("2026-07-01") },
  ],
}));

/**
 * The admin must not exist as far as the public internet is concerned.
 *
 * Authentication stops a stranger READING the dashboard. It does nothing about
 * a stranger, or a crawler, learning that `mazj.sa/admin` is a Supabase-backed
 * login for `@mazj.org` staff. That is reconnaissance, and it is the first step
 * of every credential-phishing attempt worth worrying about.
 *
 * Three things keep it invisible, and all three are easy to undo by accident:
 * a route added to the table, a `Disallow` dropped while editing robots, a page
 * moved under `app/[locale]/`. This test notices.
 */
function disallowedIn(result: ReturnType<typeof robots>): string[] {
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

describe("the admin is absent from the public surface", () => {
  it("does not appear in the sitemap", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes("admin"))).toEqual([]);
  });

  it("does not appear in any hreflang cluster either", async () => {
    // A URL can be absent from every <loc> and still be published to Google
    // through an alternates block, which is the less obvious half of the same
    // mistake.
    const alternates = (await sitemap()).flatMap((entry) =>
      Object.values(entry.alternates?.languages ?? {})
    );

    expect(alternates.filter((url) => String(url).includes("admin"))).toEqual([]);
  });

  it("still publishes event pages, in both locales, with hreflang", async () => {
    // Guards the mock above from silently turning into a no-op assertion: if
    // event URLs stopped reaching the sitemap entirely, the two tests above
    // would still pass while `/events/<slug>` quietly left the index.
    const entries = await sitemap();
    const event = entries.filter((e) => e.url.includes("/events/coffee-sketch-v10"));

    expect(event.map((e) => e.url).sort()).toEqual([
      "https://mazj.example/ar/events/coffee-sketch-v10",
      "https://mazj.example/en/events/coffee-sketch-v10",
    ]);
    // The self-reference is load-bearing: Google discards a cluster whose page
    // omits itself.
    for (const entry of event) {
      expect(Object.keys(entry.alternates?.languages ?? {}).sort()).toEqual([
        "ar",
        "en",
        "x-default",
      ]);
    }
  });

  it("is not in the indexable route table", () => {
    expect(
      INDEXABLE_ROUTES.filter((route) => route.path.includes("admin"))
    ).toEqual([]);
  });

  it("is disallowed in robots.txt, in both origin states", async () => {
    // 🔴 robots.txt has two shapes, and `/admin` has to be refused in both.
    //
    // Before launch the origin is a `*.vercel.app` deployment host (here, the
    // placeholder, which counts the same way) and the file refuses everything,
    // so `/admin` passes for free. Asserting only that would mean this test
    // goes green on the pre-launch file forever and stops watching the one that
    // actually ships. So check the launch rules explicitly as well. See
    // `test/prelaunch-indexing.test.ts` for the origin logic itself.
    expect(disallowedIn(robots())).toEqual(["/"]);

    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.mazj.sa");
    vi.resetModules();
    const { default: launchRobots } = await import("@/app/robots");

    expect(disallowedIn(launchRobots())).toContain("/admin");
  });

  it("🔴 does not rely on robots.txt alone", () => {
    // A Disallow is a request, honoured by the well-behaved and ignored by
    // everyone else. `app/admin/layout.tsx` also sets `robots: {index: false}`,
    // and the real protection is the auth gate. This test documents that the
    // Disallow is the outermost of several layers, not the only one, so nobody
    // later reads robots.txt and concludes the admin is secured.
    expect(NOINDEX_ROUTES).not.toContain("/admin");
  });
});
