import createNextIntlPlugin from "next-intl/plugin";

/**
 * Baseline security headers.
 *
 * The site had NONE: `next.config.mjs` exported only `redirects()`, so every
 * response shipped with no framing protection, no MIME-sniff protection, no
 * referrer policy, no HSTS and a fully open Permissions-Policy.
 *
 * These apply to every route (`source: "/(.*)"`), including static assets.
 */
const securityHeaders = [
  // Belt and braces with the CSP `frame-ancestors 'self'` below: this is the
  // legacy header, still honoured by older browsers that ignore
  // `frame-ancestors`. Cheap, and the two never disagree here.
  {key: "X-Frame-Options", value: "SAMEORIGIN"},

  // Stops a browser from second-guessing a declared Content-Type. Without it a
  // response served as text/plain can be sniffed into script.
  {key: "X-Content-Type-Options", value: "nosniff"},

  // Full URL to same-origin, bare origin cross-origin, nothing over plain
  // HTTP. Keeps referrer analytics working while never leaking a path.
  {key: "Referrer-Policy", value: "strict-origin-when-cross-origin"},

  // This is a static marketing site: it asks for no device permissions at all,
  // so every powerful feature is denied outright. `()` is an empty allowlist,
  // which also revokes the feature from any embedded third-party frame.
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), magnetometer=(), gyroscope=(), accelerometer=(), display-capture=(), browsing-topics=()",
  },

  // 2 years, subdomains included. Ignored by browsers over plain HTTP, so it
  // is inert in local dev and only binds once the site is served over TLS.
  // NOT sending `preload`: that is a one-way door (removal from the browsers'
  // baked-in preload list takes months) and it would commit every current and
  // future mazj subdomain to HTTPS. Add it deliberately, after launch, once
  // the real domain and all its subdomains are confirmed TLS-only.
  {key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains"},

  /**
   * CSP: deliberately PARTIAL, and enforced rather than Report-Only.
   *
   * The four directives below are the ones that cannot break this site,
   * because nothing here uses the capabilities they remove:
   *   frame-ancestors 'self'  -> no third party can iframe/clickjack the site
   *   object-src 'none'       -> no <object>/<embed>; there are none
   *   base-uri 'self'         -> blocks <base> injection rewriting every URL
   *   form-action 'self'      -> stops an injected form posting off-origin
   * A directive that is not listed is simply not enforced, so this is a real,
   * enforced policy with a small blast radius rather than a broad one that
   * might quietly break a page.
   *
   * What is deliberately NOT here, and why: `script-src`. Next.js inlines its
   * own bootstrap and flight-data <script> blocks on every page, and React
   * inlines style attributes throughout this codebase (the CTA custom
   * properties, the space-finder's JS-positioned portal, the inline-styled
   * global-error page). A `script-src` without `'unsafe-inline'` white-screens
   * the site; a `script-src` WITH `'unsafe-inline'` blocks essentially nothing
   * an attacker would want, so it buys a checklist tick and no security. The
   * correct version is per-request nonces generated in `proxy.ts`, but a nonce
   * makes every response unique and so opts the whole site out of full-route
   * static caching, which is the entire performance model of this build. Not
   * worth it for a brochure site with no auth, no forms posting anywhere and
   * no user input. Revisit if that ever changes.
   *
   * Report-Only was the other option and was rejected: with no `report-uri`
   * endpoint to collect violations it is a header that does nothing at all.
   */
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

/**
 * Allow next/image to optimize the event posters, which are the ONE image
 * source on this site that is not a file in `public/`.
 *
 * Posters are uploaded through `/admin/events` into Supabase Storage and served
 * from the project's own `*.supabase.co` host, so the pattern is derived from
 * `NEXT_PUBLIC_SUPABASE_URL` rather than hardcoded: the project moved region
 * once already (Tokyo to Frankfurt, which changed the ref), and a stale literal
 * here would fail as an unoptimizable-host error at request time, on the one
 * route nobody checks after a migration.
 *
 * Returns an empty list when the variable is unreadable. That is the safe
 * direction: an unset Supabase URL means the events routes cannot load their
 * data at all, so a missing image pattern is not the failure anyone would be
 * chasing, and an empty list keeps the build itself valid.
 */
function supabaseImagePatterns() {
  try {
    const {hostname} = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!hostname) return [];
    return [{protocol: "https", hostname, pathname: "/storage/v1/object/public/**"}];
  } catch {
    return [];
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Image optimization.
   *
   * The site shipped ZERO next/image call sites: every photo was a raw <img>
   * pointing at the full-size JPEG in public/. Measured on the landing page at
   * a 390px viewport, that cost 566 KB of pure oversizing on top of the format
   * penalty — `usp-control.jpg` alone is a 1066x1333 file painted into a
   * 403x503 box. A phone downloaded the desktop asset, at desktop dimensions,
   * in a 2001 format, on every route.
   *
   * `formats` is ordered by preference and AVIF is first on purpose: it lands
   * roughly 30% under WebP on these photographs, and any browser that cannot
   * read it simply negotiates the next entry. Nothing is lost on old clients,
   * which fall all the way back to the original JPEG.
   *
   * `deviceSizes` adds 390 and 1440 to Next's defaults. 390 is the iPhone
   * logical width and by far the commonest real viewport here; without it the
   * smallest candidate is 640, i.e. every phone over-fetches by ~2.7x in area.
   * 1440 matches the design system's own desktop breakpoint. 2048 and 3840 are
   * dropped: the widest any image renders is the 1400px content column, so
   * those two only ever generate candidates nothing requests.
   */
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 640, 750, 828, 1080, 1200, 1440, 1920],
    /**
     * 🔴 `448` closes a real gap, and it is the ONLY entry here that exists for
     * a measured reason rather than by inheritance.
     *
     * The three USP photographs declare `sizes="(min-width: 1024px) 355px,
     * 230px"`, which is correct. The CANDIDATE LIST was the fault: on a 412px
     * Android at DPR 1.75 the requirement is 230 x 1.75 = 402.5px, and the
     * combined candidate widths jumped 390 -> 640, so every one of them fetched
     * a 640px file into a 403px box. Measured AVIF bytes actually served:
     * usp-control 28,901 B at w=640 against 14,136 B at w=384, usp-save 25,347
     * against 14,506, usp-protect 14,344 against 7,760. 448 covers 402.5px with
     * 11% headroom and costs one extra generated variant per source image.
     *
     * ⚠️ Do NOT "tidy" this by touching `deviceSizes`: 390 and 1440 are
     * load-bearing for the full-bleed heroes, for the reason stated above.
     */
    imageSizes: [64, 96, 128, 256, 384, 448],
    remotePatterns: supabaseImagePatterns(),

    /**
     * How long an OPTIMIZED variant is cached, which is a different clock from
     * the source file's own header above. The default is 4 hours, measured on
     * the served response as `max-age=14400`. That is tuned for images that
     * change behind a stable URL; here the sources are files in `public/` that
     * are re-cut a few times a year, so re-deriving every AVIF four times a day
     * is work nobody asked for. 30 days matches the media header above so the
     * two layers expire together rather than at unrelated moments.
     */
    minimumCacheTTL: 2592000,
  },

  async headers() {
    return [
      {source: "/(.*)", headers: securityHeaders},

      /**
       * 🔴 THE PRE-LAUNCH INDEXING BLOCK IS BUILD-TIME; THIS ONE IS
       * REQUEST-TIME, AND WITHOUT IT THE VERCEL ALIAS BECOMES A FULL DUPLICATE
       * OF THE SITE ON LAUNCH DAY.
       *
       * `IS_PRELAUNCH_ORIGIN` in `lib/site.ts` reads `NEXT_PUBLIC_SITE_URL`,
       * i.e. the origin the build was CONFIGURED with, and never the host that
       * served the request. That is correct for what it does (it keeps every
       * canonical host-independent, which is what stops two domains
       * self-canonicalising) and it is exactly why it cannot protect the alias:
       * the moment the variable becomes `https://mazj.sa`, robots.txt returns
       * its allow-all shape for EVERY host, including
       * `mazj-tau.vercel.app`, which Vercel keeps as a permanent production
       * alias and does not retire.
       *
       * Measured on a launch-configured build 2026-08-02:
       * `curl -H "Host: mazj.org" .../robots.txt` returned the full allow-all
       * file with the sitemap line, and `curl -H "Host: mazj.org" .../en`
       * returned `<link rel="canonical" href="https://mazj.sa/en">`. The
       * canonical is a hint, not a directive; this header is the directive.
       *
       * It is deliberately the ONLY host-dependent thing in the whole app.
       * Canonicals, hreflang, the sitemap and the JSON-LD `@id` must all stay
       * host-independent or MAZJ ships two indexable copies of one site. Robots
       * directives are the one class of output where per-host is the point.
       *
       * ⚠️ This also covers every PREVIEW deployment, which is a free win: they
       * are `*.vercel.app` too and were equally exposed once the variable
       * flipped.
       */
      {
        source: "/(.*)",
        has: [{type: "host", value: ".*\\.vercel\\.app"}],
        headers: [{key: "X-Robots-Tag", value: "noindex, nofollow"}],
      },

      /**
       * The favicon. `app/icon.png` is served through Next's file convention
       * with `Cache-Control: public, max-age=0, must-revalidate`, so the 20 KB
       * mark was revalidated on every navigation on all 26 routes: the media
       * rule below cannot reach it, because it lives in `app/` rather than in
       * `public/`. Thirty days matches the media window; the icon is not
       * `immutable` for the same reason the photographs are not, since the file
       * name carries no content hash and a re-cut mark has to reach people.
       */
      {
        source: "/:icon(icon.png|favicon.ico|apple-icon.png)",
        headers: [
          {key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400"},
        ],
      },

      /**
       * 🔴 EVERYTHING IN `public/` SHIPPED `Cache-Control: public, max-age=0`.
       *
       * That is Next's default for the public directory and it is easy to miss,
       * because `/_next/static/**` (the hashed build output) is separately given
       * a year of `immutable` and looks after itself. Measured on a production
       * `next start`: the fonts, the 3.2 MB hero video, every photograph and
       * every logo all came back `max-age=0`, so a returning visitor
       * revalidated the lot on every single navigation. On this site that is the
       * heaviest bytes on the page being re-fetched by the people most likely to
       * come back.
       *
       * The values below are split by how stable each kind of file actually is,
       * rather than given one blanket number:
       *
       * FONTS get a year, `immutable`. A woff2 here is a fixed artifact: the
       * four Thmanyah weights have not changed since they were added, and they
       * are the assets most worth holding. ⚠️ This said "since two of them are
       * now preloaded on every route", which is FALSE and was measured so on
       * 2026-08-02: `as="font"` appears **0** times in the rendered `<head>` of
       * all 26 production routes. Preloading them was built, measured and
       * deliberately taken back out (`/en/about` FCP 2.0s WITH the preload
       * against 0.9s without); `components/CLAUDE.md` owns that reasoning. The
       * caching argument below stands on its own without it.
       * ⚠️ `immutable` means a client will NOT re-check for a
       * year, so **replacing a font requires renaming the file.** Editing
       * `thmanyah-sans-400.woff2` in place would leave returning visitors on the
       * old face until the cache expired.
       *
       * MEDIA gets 30 days with revalidation, deliberately NOT `immutable`.
       * These filenames are not content-hashed either, but unlike the fonts they
       * do get re-cut — `mazj-hero.mp4` was re-encoded in place during this very
       * pass, and `location-map.png` was restyled the week before. 30 days
       * captures essentially all of the repeat-visit benefit while keeping a
       * bounded window in which a re-cut asset reaches everyone, and
       * `stale-while-revalidate` means even that window is served instantly from
       * cache while the new copy is fetched behind it.
       */
      {
        source: "/fonts/:path*",
        headers: [{key: "Cache-Control", value: "public, max-age=31536000, immutable"}],
      },
      {
        source: "/:dir(videos|images|logos|payments|og)/:path*",
        headers: [
          {key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400"},
        ],
      },
    ];
  },
  // /pricing was merged into /spaces (the six mazj.sa products now live there,
  // grouped by commitment). Permanent so the old URL stops being indexed.
  async redirects() {
    return [
      {source: "/pricing", destination: "/en/spaces", permanent: true},
      {source: "/:locale(en|ar)/pricing", destination: "/:locale/spaces", permanent: true},
      // /community pulled for now (it's a future membership product, not a
      // page). /about carries the closest surviving copy.
      //
      // `permanent: true` (308), not 307. These were 307s, which tells Google
      // the move is temporary and to KEEP THE OLD URL INDEXED and keep
      // re-crawling it. Both of these are settled IA decisions, not
      // experiments, so the old URLs should stop being indexed and hand their
      // link equity to the destination, exactly like /pricing above.
      {source: "/community", destination: "/en/about", permanent: true},
      {source: "/:locale(en|ar)/community", destination: "/:locale/about", permanent: true},

      // ---------------------------------------------------------------------
      // 🔴 TEMPORARY, 2026-08-01: THE FOUR BOOKING ROUTES ARE SENT OUT TO
      // mazj.sa. Owner decision, until Rekaz fix their API. Full reasoning in
      // `lib/links.ts` under `bookingUrl()`.
      //
      // Every Book control on the site already links straight to the store, so
      // these rules exist for the traffic a link change cannot reach: a
      // bookmark, a shared URL, a search result, anything printed. Without them
      // those visitors still land on the live Rekaz flow, which is the exact
      // path this change exists to close.
      //
      // 🔴 `permanent: false` (307), NOT 308, and this is the single most
      // consequential word in the block. A permanent redirect is cached by the
      // browser and by Google indefinitely, so it would SURVIVE THE REVERT:
      // customers would keep being thrown out to mazj.sa long after on-site
      // booking came back, and nothing we deploy could call them home. A
      // temporary move must be declared temporary.
      //
      // 🔴 THE EIGHT `LEGACY_STORE_PATHS` RULES THAT USED TO SIT HERE WERE
      // DELETED, AND MUST NOT COME BACK WHILE THESE EXIST. They pointed the
      // other way (mazj.sa store path → our `/book` page). Holding both
      // directions between the same two URLs is an infinite bounce the day this
      // app serves `mazj.sa`: their rule sends the buyer in, this one sends them
      // straight back out, and the browser gives up with
      // ERR_TOO_MANY_REDIRECTS on the revenue path. They are in git, on
      // `feature/onsite-booking`, and they come back in the same commit that
      // takes these away. One direction at a time, always.
      //
      // ⚠️ The bare, locale-less form is listed separately and defaults to
      // `/en`, matching `/pricing` above. `redirects()` runs BEFORE middleware
      // in Next's routing order, so next-intl never gets to add a prefix first
      // and a rule for the prefixed shape alone would miss these entirely.
      //
      // ⚠️ The origin is the bare host. `www.mazj.sa` serves the same site from
      // the same addresses but 301s to this one, which would put a third hop on
      // the last click before payment. Verified live 2026-08-01.
      {source: "/spaces/coworking/book", destination: "https://mazj.sa/en/subscription/adwyh-almsahh-almshtrkh", permanent: false},
      {source: "/spaces/private-office/book", destination: "https://mazj.sa/en/subscription/private-office", permanent: false},
      {source: "/spaces/meeting-room/book", destination: "https://mazj.sa/en/reservation/ghrfh-alajtmaaat-almlqa", permanent: false},
      {source: "/spaces/event-hall/book", destination: "https://mazj.sa/en/reservation/qaah-alfaalyat-almaarj", permanent: false},

      // The locale-prefixed forms hand the visitor to the store in the language
      // they were already reading. `:locale` interpolates into an absolute
      // destination, so `/ar/...` here lands on `mazj.sa/ar/...` there.
      {source: "/:locale(en|ar)/spaces/coworking/book", destination: "https://mazj.sa/:locale/subscription/adwyh-almsahh-almshtrkh", permanent: false},
      {source: "/:locale(en|ar)/spaces/private-office/book", destination: "https://mazj.sa/:locale/subscription/private-office", permanent: false},
      {source: "/:locale(en|ar)/spaces/meeting-room/book", destination: "https://mazj.sa/:locale/reservation/ghrfh-alajtmaaat-almlqa", permanent: false},
      {source: "/:locale(en|ar)/spaces/event-hall/book", destination: "https://mazj.sa/:locale/reservation/qaah-alfaalyat-almaarj", permanent: false},
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
