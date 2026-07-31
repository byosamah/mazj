/**
 * The site's indexable route table: the single source of truth shared by
 * `app/sitemap.ts` and the breadcrumb schema.
 *
 * `/privacy` and `/terms` are deliberately ABSENT. Both ship `robots: noindex`
 * (they still carry placeholder legal clauses pending review), and a sitemap
 * must list only canonical, indexable URLs. Listing a noindex page tells Google
 * two opposite things about the same URL and wastes crawl budget on the
 * contradiction. Add them here the moment the real legal copy lands and the
 * `noindex` comes off `pageMetadata`.
 */

export type SiteRoute = {
  /** Locale-less path, `""` for the locale root. */
  path: string;
  /** Relative crawl priority. The homepage and the money pages lead. */
  priority: number;
  /** How often the content genuinely changes. Honest values only. */
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
};

export const INDEXABLE_ROUTES: SiteRoute[] = [
  {path: "", priority: 1.0, changeFrequency: "monthly"},
  {path: "/spaces", priority: 0.9, changeFrequency: "monthly"},
  {path: "/spaces/coworking", priority: 0.8, changeFrequency: "monthly"},
  {path: "/spaces/private-office", priority: 0.8, changeFrequency: "monthly"},
  {path: "/spaces/meeting-room", priority: 0.8, changeFrequency: "monthly"},
  {path: "/spaces/event-hall", priority: 0.8, changeFrequency: "monthly"},
  {path: "/events", priority: 0.7, changeFrequency: "weekly"},
  // Indexable on purpose. "coworking for startups in Khobar" is a real query
  // with real intent behind it, and this is the only page on the site that
  // answers it. Ranked below /spaces because it converts a narrower audience.
  {path: "/startups", priority: 0.7, changeFrequency: "monthly"},
  {path: "/about", priority: 0.6, changeFrequency: "monthly"},
  {path: "/contact", priority: 0.6, changeFrequency: "yearly"},
  {path: "/faq", priority: 0.6, changeFrequency: "monthly"},
];

/** Routes that exist but are intentionally kept out of the index. */
export const NOINDEX_ROUTES = ["/privacy", "/terms"] as const;
