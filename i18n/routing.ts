import {defineRouting} from "next-intl/routing";

/**
 * MAZJ locale routing.
 * English-first: `/` redirects to `/en`; Arabic lives at `/ar` (RTL).
 * `localePrefix: "always"` keeps both languages explicitly prefixed
 * so URLs are stable and shareable (/en/..., /ar/...).
 */
export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
