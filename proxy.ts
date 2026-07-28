import createMiddleware from "next-intl/middleware";
import {routing} from "@/i18n/routing";

/**
 * Next.js 16 renamed `middleware.ts` -> `proxy.ts`.
 * This drives locale detection + prefixing for every non-static request.
 */
export default createMiddleware(routing);

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
