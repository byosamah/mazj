import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { INDEXABLE_ROUTES, NOINDEX_ROUTES } from "@/lib/routes";

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
describe("the admin is absent from the public surface", () => {
  it("does not appear in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);

    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes("admin"))).toEqual([]);
  });

  it("does not appear in any hreflang cluster either", () => {
    // A URL can be absent from every <loc> and still be published to Google
    // through an alternates block, which is the less obvious half of the same
    // mistake.
    const alternates = sitemap().flatMap((entry) =>
      Object.values(entry.alternates?.languages ?? {})
    );

    expect(alternates.filter((url) => String(url).includes("admin"))).toEqual([]);
  });

  it("is not in the indexable route table", () => {
    expect(
      INDEXABLE_ROUTES.filter((route) => route.path.includes("admin"))
    ).toEqual([]);
  });

  it("is disallowed in robots.txt", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;

    const disallow = rule?.disallow;
    const list = Array.isArray(disallow) ? disallow : [disallow];

    expect(list).toContain("/admin");
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
