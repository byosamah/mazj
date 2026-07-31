import type { Metadata } from "next";

import "../globals.css";
// 🔴 SECOND, AND THE ORDER MATTERS. `globals.css` carries @tailwind base, the
// self-hosted Thmanyah faces and the shared reset; `admin.css` carries only the
// custom properties behind the shadcn primitives, plus two overrides of
// globals' own rules (scroll-behavior, tabular figures) that must therefore
// come after it. Swapping these two lines silently reverts both.
//
// Importing it HERE, in the admin's own root layout, is what keeps the whole
// admin token system off mazj.sa: the marketing document is rendered by
// `app/[locale]/layout.tsx` and never loads this file. See admin.css.
import "./admin.css";

/**
 * The admin's root layout.
 *
 * A SECOND root layout, sitting beside `app/[locale]/layout.tsx`. That is
 * deliberate and it is the whole reason `/admin` lives here rather than under
 * `app/[locale]/admin`. Inside the locale tree it would inherit a locale, an
 * hreflang pair, a sitemap entry, RTL handling and the marketing site's
 * scroll and motion providers, and it would exist twice, at `/en/admin` and
 * `/ar/admin`, as duplicate content. None of that is wanted on an internal
 * tool used by a handful of people.
 *
 * `proxy.ts` excludes `admin` from next-intl's matcher, or the middleware would
 * rewrite `/admin` to `/en/admin` before any of this ran.
 *
 * No auth check here: `/admin/login` renders under this layout and must stay
 * reachable while signed out. The guard lives one level down, in
 * `(protected)/layout.tsx`, so that every page except login is protected by
 * default rather than by remembering.
 */

export const metadata: Metadata = {
  title: "MAZJ Admin",
  // 🔴 noindex rather than a robots.txt Disallow. A disallowed URL is never
  // crawled, so a crawler never reads the noindex, and can still index a bare
  // URL it found linked elsewhere. `app/robots.ts` explains the same trap for
  // /privacy and /terms. Belt and braces here: this tag AND the Disallow, since
  // nothing links to /admin so there is no discovered-but-blocked risk.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/*
          The nav precedes the content on every admin page below `lg`, so this is
          not decoration: without it, reaching the dashboard from the keyboard
          costs one tab per section on every navigation.

          `.skip-link` is already fully designed in `globals.css` (fixed, 44px
          min-height, 4px radius, indigo ring at 3px offset) and had never been
          used by the admin. Its target is `<main id="content" tabIndex={-1}>`
          in `(protected)/layout.tsx`; `tabIndex={-1}` is what makes the anchor
          actually move focus rather than only scroll.
        */}
        <a href="#content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
