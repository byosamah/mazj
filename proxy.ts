import createMiddleware from "next-intl/middleware";
import {routing} from "@/i18n/routing";

/**
 * Next.js 16 renamed `middleware.ts` -> `proxy.ts`.
 * This drives locale detection + prefixing for every non-static request.
 */
export default createMiddleware(routing);

export const config = {
  // Match everything except API routes, Next internals, and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
