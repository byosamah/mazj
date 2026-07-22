import {notFound} from "next/navigation";
import {setRequestLocale} from "next-intl/server";

/**
 * Catch-all so unmatched URLs render the site's OWN 404.
 *
 * WHY THIS FILE EXISTS: `app/[locale]/not-found.tsx` was fully written and
 * fully translated, and it was dead code. A segment-level `not-found.tsx`
 * only catches a `notFound()` thrown from inside a route that MATCHED. A URL
 * that matches nothing never enters the segment at all, so Next served its
 * bare built-in 404 instead: no <html lang>, no dir="rtl", no header, no
 * footer, not a single internal link. An Arabic visitor who mistyped a path
 * got an untranslated English dead end with no way back into the site.
 *
 * The usual fix (a root `app/not-found.tsx`) is not available here: this repo
 * has no `app/layout.tsx` on purpose, `app/[locale]/layout.tsx` is the only
 * root layout, so a root-level not-found would have no <html> to live in.
 * The documented next-intl answer is this catch-all, which pulls the unmatched
 * URL back INSIDE the locale segment (and therefore inside the layout, the
 * NextIntlClientProvider and the correct `lang`/`dir`) and only then throws.
 *
 * SHADOWING: it shadows nothing. Next resolves specific segments before a
 * catch-all, so `/en/spaces/coworking` still hits its own page, and
 * `[...rest]` requires at least one segment so `/en` still hits `page.tsx`.
 * Real routes: / /about /contact /events /faq /privacy /spaces
 * /spaces/{coworking,event-hall,meeting-room,private-office} /terms.
 *
 * NO `generateStaticParams` HERE, deliberately: the whole point is URLs we
 * cannot enumerate, so this one route renders on demand while every real
 * route stays statically rendered. `setRequestLocale` is still required, for
 * the same reason it is on every other page: it is what lets the messages be
 * resolved without opting the tree into dynamic rendering.
 *
 * 🔴 KNOWN LIMITATION, measured against a PRODUCTION build (`next build` +
 * `next start`, fetched with curl, which is a real no-JS client):
 * WITH JavaScript this works exactly as intended. HTTP 404, correct `lang` and
 * `dir`, the header, 13 internal links, and the translated h1.
 * WITHOUT JavaScript the body is EMPTY. The served document is Next's own
 * `<html id="__next_error__">` shell with 0 characters of body text, no header
 * and no links. All the branded content arrives via hydration.
 * CAUSE: `notFound()` unwinds to the `not-found.tsx` boundary, but this repo
 * has no `app/layout.tsx` (by design, `app/[locale]/layout.tsx` is the only
 * root layout), so during SSR there is no outer document for that boundary to
 * render into and Next emits its internal error shell instead.
 * NOT FIXED, because every available fix is worse than the defect:
 *   - rendering the 404 UI directly here instead of calling `notFound()` gives
 *     real SSR HTML but returns HTTP 200, i.e. a soft 404, which is an actively
 *     harmful SEO signal rather than a cosmetic one;
 *   - adding a root `app/layout.tsx` contradicts the documented architecture
 *     and would mean two nested <html> owners.
 * IMPACT is genuinely small: this is the 404 route, every real route SSRs its
 * full content without JS (verified: /en 5,015 chars, /ar 4,392, header +
 * footer + 24 links), Googlebot executes JS, and `robots noindex` is correctly
 * present so this page was never meant to be indexed. Revisit if Next ever
 * supports a status code on a rendered page, or if a root layout is introduced
 * for another reason.
 */
export default async function CatchAllNotFound({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  notFound();
}
