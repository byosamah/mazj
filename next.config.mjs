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
    imageSizes: [64, 96, 128, 256, 384],
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
       * are the assets most worth holding, since two of them are now preloaded
       * on every route. ⚠️ `immutable` means a client will NOT re-check for a
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
      // The legacy Rekaz storefront paths.
      //
      // 🔴 These only matter once `www.mazj.sa` points at this app, and then
      // they matter enormously: until 2026-07-27 they WERE the store, so every
      // QR code, ad and shared link MAZJ has ever published points here. Without
      // these lines the domain move turns all of them into 404s on the revenue
      // path.
      //
      // ⚠️ Each path exists in TWO shapes, and both are needed.
      // `mazj.sa/subscription/<slug>` answers 308 and redirects to
      // `mazj.sa/ar/subscription/<slug>`, so real traffic arrives on both. The
      // locale-prefixed form is the dangerous one: `/ar/subscription/...` looks
      // like one of OUR locale routes, so without an explicit rule it sails past
      // next-intl into the `[...rest]` catch-all and renders a branded 404,
      // which is harder to notice than a plain one.
      //
      // Source of truth for the mapping is `LEGACY_STORE_PATHS` in lib/links.ts.
      {source: "/subscription/adwyh-almsahh-almshtrkh", destination: "/ar/spaces/coworking/book", permanent: true},
      {source: "/subscription/private-office", destination: "/ar/spaces/private-office/book", permanent: true},
      {source: "/reservation/ghrfh-alajtmaaat-almlqa", destination: "/ar/spaces/meeting-room/book", permanent: true},
      {source: "/reservation/qaah-alfaalyat-almaarj", destination: "/ar/spaces/event-hall/book", permanent: true},

      // The locale-prefixed forms keep whichever locale the visitor arrived on.
      {source: "/:locale(en|ar)/subscription/adwyh-almsahh-almshtrkh", destination: "/:locale/spaces/coworking/book", permanent: true},
      {source: "/:locale(en|ar)/subscription/private-office", destination: "/:locale/spaces/private-office/book", permanent: true},
      {source: "/:locale(en|ar)/reservation/ghrfh-alajtmaaat-almlqa", destination: "/:locale/spaces/meeting-room/book", permanent: true},
      {source: "/:locale(en|ar)/reservation/qaah-alfaalyat-almaarj", destination: "/:locale/spaces/event-hall/book", permanent: true},
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
