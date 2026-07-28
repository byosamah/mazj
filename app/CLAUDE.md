# `app/`: routing, layout, metadata, SEO

Scope: everything that decides **which page renders, at which URL, in which
language, with which `<head>`**. Also `globals.css`, which physically lives here.

- Component form, RTL, Arabic typography, motion, media → [`../components/CLAUDE.md`](../components/CLAUDE.md)
- Copy rules and the i18n both-file rule → [`../CLAUDE.md`](../CLAUDE.md)
- Backend and API routes under `app/api/**` → [`../server/CLAUDE.md`](../server/CLAUDE.md)
- How it should look → [`../DESIGN.md`](../DESIGN.md) · How it should sound → [`../TONE.md`](../TONE.md)

## Locale routing (next-intl)

- `i18n/routing.ts`: locales `["en","ar"]`, `defaultLocale: "en"`,
  `localePrefix: "always"`.
- `i18n/request.ts`: loads `messages/${locale}.json` per request.
- `i18n/navigation.ts`: locale-aware `Link` / `useRouter` / `usePathname`. **Use
  these instead of `next/link` and `next/navigation`** so the active locale prefix
  is preserved.
- `proxy.ts`: Next.js 16 renamed `middleware.ts` to `proxy.ts`. This runs the
  next-intl middleware for locale detection and prefixing. Its matcher excludes
  `api`, **`admin`**, `_next`, `_vercel` and anything with a file extension, so
  those bypass locale rewriting entirely. 🔴 **`admin` must stay in that list**:
  without it next-intl rewrites `/admin` to `/en/admin` before any admin code
  runs, every admin route 404s, and the magic link's redirect target stops
  existing.
- `next.config.mjs` wires `createNextIntlPlugin("./i18n/request.ts")`.
- 🔴 There is **no `app/layout.tsx`**. Instead there are **two root layouts**,
  side by side, each owning its own `<html>`:
  - `app/[locale]/layout.tsx` for the public site: sets `<html lang dir>`, calls
    `setRequestLocale(locale)`, wraps the tree in `NextIntlClientProvider`, and
    its `generateMetadata` reads the `Meta` namespace.
  - `app/admin/layout.tsx` for the admin (added 2026-07-27): `lang="en"`,
    `dir="ltr"`, `robots: noindex`. See the admin section below.

**Layout persistence has two consequences elsewhere.** Because `[locale]/layout.tsx`
persists across client-side navigations, `ScrollFX` arms only once per hard load
and `ScrollReset` had to exist at all. Both are documented in
[`../components/CLAUDE.md`](../components/CLAUDE.md); if you are debugging "the
animation didn't run after clicking a link", that is the cause and it is expected.

## Routes and error handling

- The skip link is the first `<body>` child in `layout.tsx`, targeting
  `<main id="content" tabIndex={-1}>`, which is present on every route including
  `not-found.tsx`.
- Unmatched URLs hit the catch-all `app/[locale]/[...rest]/page.tsx` →
  `notFound()` → the branded 404. 🔴 That page renders **blank without JS** in a
  production build; no non-harmful fix exists, see the in-file comment.
- Error boundaries are `app/[locale]/error.tsx` and `app/global-error.tsx`.
- `/pricing`→`/spaces` and `/community`→`/about` are redirects in
  `next.config.mjs`.

## Where the design system physically lives

Tokens (palette, type scale, easings) live in `tailwind.config.ts` at the repo
root. Global CSS lives in **`app/globals.css`**: `@font-face`, the scroll-reveal
base, the signature CTA sweep, the `.grain-overlay` film grain, and the
`.grid-overlay` + `.dot-field` textures. There is no dune TEXTURE in CSS any
more: `.footer-dune` was deleted and superseded by a looping `footer-dune.mp4`
under a `mix-blend-color` coral overlay.

The **idioms** those files express (what a radius means, when to use the sweep,
how the glass pill is built) are documented in
[`../components/CLAUDE.md`](../components/CLAUDE.md) and `DESIGN.md`. This file
only records where the bytes are.

## SEO layer

`lib/site.ts` holds the ONE origin behind every canonical, hreflang, `og:url`,
sitemap entry and JSON-LD URL, deliberately the unresolvable `mazj.example`
(RFC 2606) as a launch gate: set the real domain there before going live.

`lib/routes.ts` is the indexable route table, consumed by `app/sitemap.ts`
**alone** (`SpaceBreadcrumbs` builds its trail from `lib/schema.ts` plus the
`Nav`/`Space*` i18n labels, not from this table).

`lib/schema.ts` + `components/JsonLd.tsx` render JSON-LD server-side, with no
`aggregateRating` on purpose.

🔴 **`lib/schema.ts` consumes `lib/links.ts` `BOOKING` for `makesOffer[].url`.**
When `BOOKING` became relative internal paths (booking moved on-site), those
Offer URLs silently became relative, which is invalid in JSON-LD: Google cannot
resolve them without a base and drops or misattributes the offers. They were the
only URLs in that file not already wrapped in `absoluteUrl()`, which is why it
went unnoticed. **Any change to `BOOKING`'s shape must be checked against
`schema.ts`**, and JSON-LD URLs must be absolute AND locale-prefixed.

`app/robots.ts` disallows **only** `/admin`. It stays empty for everything else:
a `Disallow` would stop Google reading the `noindex` meta on `/privacy` and
`/terms`, which are also deliberately absent from the sitemap. That trap does
not apply to `/admin` because nothing anywhere links to it, so there is no
discovered-but-unreadable state to fall into. The per-file comments carry the
full reasoning.

🔴 **Never add `Event` JSON-LD to `/events`.** The `upcoming` entries are labelled
"Example" with "Date to be announced" and carry real host names, so marking them
up is fabricated structured data, which is a site-wide penalty rather than a
page-scoped one. See the comment on that route.

**Titles decouple from headlines** via an OPTIONAL `metaTitle` key per namespace
(`lib/metadata.ts`, plus `Meta.metaTitle` for the homepage, which is used
verbatim with no ` | MAZJ` suffix so it must carry the brand itself). When absent
the display `title` drives the tag, but that fallback now only fires on
`PrivacyPage` and `TermsPage`. All 10 indexable routes (`Meta` plus the 9
`*Page`/`Space*` namespaces, matching `lib/routes.ts`) already ship a written
`metaTitle` in BOTH locales, so editing a page's display `title` no longer moves
its `<title>`, `og:title` or `twitter:title`: **edit `metaTitle`.**

When checking a `metaTitle` against the ~60-char SERP limit, count **sans
combining marks**: `الخُبر`'s damma is a combining codepoint that overcounts by 1.
metaTitles use ` | ` between clauses; colons were swapped out site-wide
2026-07-23.

The `Faq` namespace's grouped Q&A auto-flows into the `/faq` `FAQPage` JSON-LD
(`faqPageSchema` flattens `groups`); the landing teaser renders the same section
with `limit` and must NOT be the marked-up set. Google shows FAQ rich results for
government and health only, so the markup is for Bing and AI engines, not Google
stars.

🔴 **`Location.address` is load-bearing beyond copy.** `app/[locale]/layout.tsx`
feeds it into the JSON-LD `streetAddress`, so it must keep the full
`برج الحياة، شارع زيد بن الخطاب، العليا، الخُبر` string even when a tone pass is
stripping the tower elsewhere. Verify after any copy pass by parsing the
`ld+json` block, not by reading the page.

## Share cards (`public/og/{en,ar}.png`)

Static committed PNGs built by `scripts/generate-og-cards.py` (headless
Chromium), wired through `ogImage()` in `lib/metadata.ts`. **Re-run the script
whenever `Meta.title`, `siteName` or `city` changes**, or the cards go stale.

🔴 **Do NOT "modernise" this into an `app/[locale]/opengraph-image.tsx` route:
`next/og` / Satori cannot typeset Arabic.** It has no bidi engine
(`direction:"rtl"` on the container AND the text node produced a byte-identical
PNG, so words render reversed), and it sizes each word's box from *unshaped*
advances, dumping the surplus at word boundaries: measured gaps **1.23 / 0.92 /
1.63em, uneven**, versus English's normal 0.28em in the same card, with the font
innocent (Thmanyah's space is 0.249em). That slack is *inside* the word box, so
no `gap`, `margin`, `justifyContent` or `row-reverse` value can remove it. Real
Chrome renders the same copy at an even 0.28-0.32em. Satori also throws on
`whiteSpace:"nowrap"` and on `maxWidth: undefined`, and reads TTF/OTF/WOFF but
not WOFF2. `Meta.city` exists solely to give the card a short comma-free locality
string.

## Verification recipes

- **Verify metadata and i18n without a browser:** `curl -s localhost:3000/en` and
  `/ar`, then grep the `<head>` (`<title>`, `og:*`, `hreflang`, canonical) to
  confirm each locale renders fully in its own language. curl needs the sandbox
  off (see `.claude.local.md`).
- 🔴 Remember that `NextIntlClientProvider` serialises every namespace into the
  HTML, so grepping rendered output for a string proves nothing about what is on
  screen. Strip `<script>` blocks first. Full note in [`../CLAUDE.md`](../CLAUDE.md).
- JSON-LD must be verified by **parsing the `ld+json` block**, not by reading the
  rendered page.

## `app/admin/`: the internal tool

Added 2026-07-27. English only, LTR, **outside the locale system entirely**.
Backend mechanics (the three access gates, the Rekaz client) live in
[`../server/CLAUDE.md`](../server/CLAUDE.md); this section is the routing.

```
app/admin/
  layout.tsx              root layout: <html lang="en" dir="ltr">, noindex. NO guard.
  login/                  unprotected, by necessity
  auth/callback/route.ts  magic-link landing. Writes the session cookie.
  _lib/                   🔴 the ONLY place here that may import @/server/**
  (protected)/            everything requiring a signed-in admin
    layout.tsx            the guard + chrome
    page.tsx              the dashboard, at /admin
```

🔴 **Why it is not `app/[locale]/admin/`.** Under the locale tree it would exist
twice (`/en/admin` and `/ar/admin`) as duplicate content, acquire an hreflang
pair and a sitemap entry, and inherit the marketing site's scroll and motion
providers. None of that belongs on a tool three people use.

🔴 **The guard is in `(protected)/layout.tsx` AND in every page. Both.** The
layout alone is NOT the security boundary, and believing it was cost a real data
leak (fixed 2026-07-28).

Two independent reasons the layout cannot hold the line on its own:

1. **`redirect()` does not stop the page.** React renders a route's components
   concurrently rather than parent-then-child, so the layout's throw does not
   cancel the page. Measured on an anonymous `curl /admin`: a correct
   `307 -> /admin/login` whose body still carried 28KB of rendered dashboard,
   including live Rekaz room names, occupancy and subscription totals.
2. **The layout can be skipped entirely.** `Rsc: 1` plus a crafted
   `Next-Router-State-Tree` makes Next's `walkTreeWithFlightRouterState` treat
   the `(protected)` segment as already-rendered and never call
   `createComponentTree` for it. The header is unauthenticated, unsigned, and
   validated for SHAPE only. Next's own auth guidance says layouts must not be
   the authorization boundary for exactly this reason.

So every page under `(protected)/` calls `await requireAdmin()` above its first
data read, and `test/admin-page-guards.test.ts` fails if one does not (it also
pins the layout check, and rejects a guard that is merely mentioned in a
comment, unawaited, or below the load). The layout check REMAINS: it is what
gives a human a redirect to the login screen rather than a bare refusal.

`login/` sits OUTSIDE that group deliberately: inside it, the guard would
redirect an anonymous visitor to the login page, whose render would redirect
them again, forever.

🔴 **`_lib/` is a sanctioned ESLint boundary crossing** (the second, after
`app/api/**`). Only it may import `@/server/**`, and it must export plain view
models rather than re-export backend modules. Pages import from `_lib`. The
underscore keeps Next from routing it.

🔴 **The `(protected)` layout guards PAGE RENDERS, not Server Actions.** An
action is a public POST endpoint reachable by its id from the client bundle, so
every admin action must call `requireAdmin()` itself. Sitting under
`(protected)/` protects nothing. `signOut` is the deliberate exception: requiring
a session to END one would strand anyone whose token had just expired.

⚠️ **`_lib/actions.ts` is `"use server"`, so EVERY export becomes a callable
Server Action.** Do not re-export a helper taking a non-serialisable argument
(a Supabase client, say) from it: that creates an action nobody can invoke and
widens the public surface. `_lib/session.ts` exists for exactly that reason.

⚠️ **The cookie `setAll` in `_lib/supabase.ts` swallows its error on purpose.**
Next forbids cookie writes from a Server Component, and Supabase writes cookies
whenever it silently refreshes a token, so without the catch an ordinary page
load an hour into a session crashes. The write is deferred, not lost.

Three things keep `/admin` off the public internet, and
`test/admin-surface.test.ts` asserts the first two: absent from the sitemap
(including its hreflang clusters), `Disallow` in robots.txt, and
`robots: {index: false}` on the layout.

**The sidebar is the extension point.** `app/admin/nav.ts` is a plain data file
listing the sections; adding one is an entry there plus
`(protected)/<segment>/page.tsx`, and it inherits the auth guard and the chrome
automatically. 🔴 `nav.ts` must stay dependency-free: `Sidebar.tsx` is a client
component, so anything reachable from it ships to the browser, and it must never
import from `_lib/` (which can reach the Supabase secret key and the admin-scope
Rekaz credential).

🔴 **The admin uses `next/link` and `next/navigation`, NOT `@/i18n/navigation`.**
The locale-aware versions prepend `/en` or `/ar`, and `/en/admin` does not exist
because `proxy.ts` excludes admin from the matcher. Every such link would 404.

⚠️ **Screenshotting an authenticated admin page by saving its HTML into
`public/` breaks any component that reads `usePathname()`.** The snapshot is
served from `/__admin-preview.html` while the markup was rendered for `/admin`,
so the active nav item disagrees between server and client and React reports a
hydration mismatch in the dev overlay. It is an artifact of the capture, not a
bug in the page: verify the real route by asserting on its server-rendered HTML
(`aria-current="page"`, one `<main>`, one `<h1>`) rather than trusting the
overlay on a snapshot.

## Adding a route

Create `app/[locale]/<route>/page.tsx`, add a `*Page` namespace to **both**
message files (including a written `metaTitle`), and add the route to
`lib/routes.ts` if it should be indexable. Server components can call
`useTranslations` directly; client components work because the whole tree sits
under `NextIntlClientProvider`.
