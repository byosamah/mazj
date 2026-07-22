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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{source: "/(.*)", headers: securityHeaders}];
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
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
