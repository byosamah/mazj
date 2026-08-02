import createMiddleware from "next-intl/middleware";
import type {NextRequest} from "next/server";
import {routing} from "@/i18n/routing";

/**
 * Next.js 16 renamed `middleware.ts` -> `proxy.ts`.
 * This drives locale detection + prefixing for every non-static request.
 */
const handle = createMiddleware(routing);

/**
 * 🔴 THE LOCALE REDIRECT IS CONTENT-NEGOTIATED AND SHIPPED NO `Vary` AND NO
 * `Cache-Control`, WHICH IS A CACHE-POISONING SHAPE.
 *
 * Measured on the launch-configured production build, 2026-08-02:
 *
 *   GET /                              -> 307, location: /en
 *   GET / (Accept-Language: ar)        -> 307, location: /ar
 *
 * Two different responses for one URL, chosen from a request header, with
 * nothing in the response telling a cache that the header mattered. Any shared
 * cache (a CDN, a corporate proxy, an ISP) is then entitled to store whichever
 * one it saw first and serve it to everybody: an Arabic visitor gets pushed to
 * the English site, or vice versa, at the site's front door. It is invisible in
 * testing because a single client always sees a self-consistent answer.
 *
 * `Vary: Accept-Language, Cookie` names both inputs. Cookie is genuinely one of
 * them: next-intl reads `NEXT_LOCALE` FIRST and only falls back to the header,
 * so a response cached without it is wrong for anyone carrying the other value.
 *
 * `Cache-Control: no-store` on top, because `Vary: Cookie` is close to
 * uncacheable in practice anyway and an explicit directive beats a heuristic
 * one. The cost is nil: this fires on the locale-less entry URLs only.
 *
 * ⚠️ SCOPED TO REDIRECTS ON PURPOSE. Every real page lives at a
 * locale-PREFIXED URL (`localePrefix: "always"`), so `/en/spaces` does not vary
 * on anything and must keep its own caching. Applying `Vary` to all responses
 * would fragment the cache key for the entire site to fix two entry points.
 */
export default function proxy(request: NextRequest) {
  const response = handle(request);

  if (response.status >= 300 && response.status < 400) {
    response.headers.set("Vary", "Accept-Language, Cookie");
    response.headers.set("Cache-Control", "no-store");
  }

  return response;
}

export const config = {
  // Match everything except API routes, the admin, Next internals, and files
  // with an extension.
  //
  // 🔴 `admin` must stay in this exclusion list. Without it, next-intl treats
  // /admin as a locale-less path and rewrites it to /en/admin before any admin
  // code runs, so every admin route 404s and the magic link's redirect target
  // stops existing. The admin is deliberately outside the locale system: it is
  // an English-only internal tool with its own root layout, and it should never
  // acquire a locale prefix, an hreflang pair or a second copy at /ar/admin.
  matcher: "/((?!api|admin|_next|_vercel|.*\\..*).*)",
};
