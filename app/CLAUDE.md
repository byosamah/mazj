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
  ⚠️ Since 2026-08-02 it **wraps** `createMiddleware(routing)` rather than
  exporting it, to add `Vary: Accept-Language, Cookie` + `Cache-Control:
  no-store` to redirect responses only. `GET /` genuinely varies (307 to `/en`
  plain, 307 to `/ar` under `Accept-Language: ar`) and shipped with neither
  header, so any shared cache could store one language's redirect and serve it
  to everyone at the site's front door. Scoped to 3xx on purpose:
  locale-prefixed pages do not vary and must keep their own caching.
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

## Delivery: caching and image optimization (`next.config.mjs`)

Added 2026-07-31, after a page-by-page audit. Component-level media rules live in
[`../components/CLAUDE.md`](../components/CLAUDE.md); this is the config layer.

🔴 **EVERYTHING IN `public/` SHIPPED `Cache-Control: public, max-age=0`.** That is
Next's default for the public directory and it is easy to miss, because
`/_next/static/**` is separately given a year of `immutable` and looks after
itself. Measured on a production `next start`: the fonts, the 3.2 MB hero video,
every photograph and every logo all came back `max-age=0`, so a **returning**
visitor revalidated the heaviest bytes on the site on every navigation.

Two rules now, split by how stable each kind of file actually is:

| Path | Header | Why |
|---|---|---|
| `/fonts/**` | 1 year, `immutable` | a woff2 here is a fixed artifact, and it is the asset most worth holding |
| `/videos,images,logos,payments,og/**` | 30 days + `stale-while-revalidate` | these DO get re-cut, so a bounded window matters |

⚠️ **`immutable` on the fonts means replacing one requires RENAMING the file.**
Editing `thmanyah-sans-400.woff2` in place leaves returning visitors on the old
face for up to a year. The media rule is deliberately not `immutable` for exactly
this reason: `mazj-hero.mp4` was re-encoded in place during this very pass and
`location-map.png` was restyled the week before.

`images.minimumCacheTTL` is raised to the same 30 days. The default is 4 hours,
which re-derives every AVIF four times a day from source files that change a few
times a year, and it expires on an unrelated clock from the header above.

🔴 **Warming the image optimizer needs the browser's `Accept` header, and getting
this wrong silently corrupts a measurement.** `/_next/image` keys its cache on
the negotiated format, so a warm-up loop using Python's default `Accept` fills
the **JPEG** entry while Chrome then asks for **AVIF** and pays a cold `sharp`
encode. Measured: that made the LCP resource take 155ms instead of 1.4ms and
read as a 2-second LCP regression that did not exist. Send
`image/avif,image/webp,...` when warming, and confirm `X-Nextjs-Cache: HIT`
**with that same header** before trusting any number.

## SEO layer

`lib/site.ts` holds the ONE origin behind every canonical, hreflang, `og:url`,
sitemap entry and JSON-LD URL, deliberately the unresolvable `mazj.example`
(RFC 2606) as a launch gate: set the real domain there before going live.

`lib/routes.ts` is the indexable route table, consumed by `app/sitemap.ts`
**alone** (`SpaceBreadcrumbs` builds its trail from `lib/schema.ts` plus the
`Nav`/`Space*` i18n labels, not from this table). Since 2026-07-28 the sitemap
ALSO appends one entry per published event, read from the database through
`app/[locale]/events/_lib`.

🔴 **`app/sitemap.ts` is PRERENDERED AT BUILD TIME by default, so anything it
reads from the database freezes at deploy.** Measured: a production build served
22 URLs and **zero** events, which would have kept every event published after a
deploy out of Google until somebody happened to deploy again. It now carries
`export const revalidate = 3600`.

⚠️ **The dev server renders it per request and looks perfectly correct**, so
this class of bug is invisible in development. Check a real `npm start` before
trusting any database-backed metadata route (`sitemap.ts`, `robots.ts`,
`opengraph-image`). Two other things only a production run shows: the build
needs `IP_TRUST_PROXY` or the same sitemap silently degrades (root `CLAUDE.md`),
and the dev-tools indicator disappears (`../components/CLAUDE.md`).

`lib/schema.ts` + `components/JsonLd.tsx` render JSON-LD server-side, with no
`aggregateRating` on purpose.

🔴 **`lib/schema.ts` consumes `lib/links.ts` `BOOKING` for `makesOffer[].url`.**
When `BOOKING` became relative internal paths (booking moved on-site), those
Offer URLs silently became relative, which is invalid in JSON-LD: Google cannot
resolve them without a base and drops or misattributes the offers. They were the
only URLs in that file not already wrapped in `absoluteUrl()`, which is why it
went unnoticed. **Any change to `BOOKING`'s shape must be checked against
`schema.ts`**, and JSON-LD URLs must be absolute AND locale-prefixed.

🔴 **`sameAs` is the OTHER consumer of `lib/links.ts`, and it is a CLAIM rather
than a link.** `lib/schema.ts` spreads `SOCIALS` into the `LocalBusiness`
`sameAs`, which tells Google those profiles ARE this business. So removing a
social account is a **four**-file edit and the two visible ones matter least:
`SOCIALS`, `Footer.tsx`, `/contact`, and `sameAs`. Removing X (2026-08-01) was
asked for as "the footer and contact"; the site was separately vouching for a
handle MAZJ does not own. **Grep `SOCIALS`, never just the footer.** ⚠️ The row
labels are hardcoded brand names, NOT i18n keys, so there is nothing to mirror
in `messages/*.json` and the both-file rule does not apply.

`app/robots.ts` has **two shapes**, picked by `IS_PRELAUNCH_ORIGIN` in
`lib/site.ts`. On any `*.vercel.app` host (or the placeholder) it serves
`Disallow: /` with NO `Sitemap:` line, so a pre-launch deploy cannot become a
duplicate of the pages mazj.org ranks with. It lifts itself when
`NEXT_PUBLIC_SITE_URL` names a real domain. 🔴 Do NOT "fix" a blocked robots.txt
by editing this file: set the domain.

🔴 **`IS_PRELAUNCH_ORIGIN` IS BUILD-TIME AND HOST-BLIND, SO IT CANNOT PROTECT
THE VERCEL ALIAS.** It reads `NEXT_PUBLIC_SITE_URL`, never the request host.
Measured on a launch-configured build 2026-08-02:
`curl -H "Host: mazj.org" .../robots.txt` returned the full allow-all file, and
`curl -H "Host: mazj.org" .../en` returned `canonical="https://mazj.sa/en"`. So
the day that variable becomes a real domain, `mazj-tau.vercel.app` (a permanent
alias Vercel does not retire) serves a complete crawlable duplicate of the site,
with only a canonical hint standing in the way. `next.config.mjs` `headers()`
now carries `has: [{type: "host", value: ".*\\.vercel\\.app"}]` ->
`X-Robots-Tag: noindex, nofollow`, which also covers every preview deploy.

🔴 **That header is the ONLY thing in this app allowed to vary by host, and the
asymmetry is the point.** Robots directives per host = correct. Canonical,
hreflang, sitemap `<loc>` and JSON-LD `@id` per host = two self-canonicalising
copies of one site, which is the failure `lib/site.ts` exists to prevent. Never
add a second `has: host` rule outside `headers()`.

The launch shape disallows **only** `/admin`. It stays empty for everything else:
a `Disallow` would stop Google reading the `noindex` meta on `/privacy` and
`/terms`, which are also deliberately absent from the sitemap. That trap does
not apply to `/admin` because nothing anywhere links to it, so there is no
discovered-but-unreadable state to fall into. The per-file comments carry the
full reasoning.

✅ **The `Event` JSON-LD ban was LIFTED on 2026-07-28, on its own stated
condition.** It read "never add `Event` JSON-LD to `/events`" because the
`upcoming` entries were fabricated examples ("Date to be announced") carrying
real host names, and inventing structured data is a **site-wide** penalty rather
than a page-scoped one. The ban named its release condition: revisit when
`upcoming` holds confirmed events with real ISO dates. Events are now database
rows with real timestamps, so `eventSchema` in `lib/schema.ts` is legitimate.

🔴 **The rules that replaced it, all three still load-bearing:**

1. Markup goes on **`/events/[slug]`**, never on the `/events` LIST. Google wants
   one `Event` node per event on that event's own URL; a list marking up
   everything on it, including 2022, is markup with no rich result available and
   a manual-action surface for no gain.
2. **Published and FUTURE only.** Drafts, cancelled and past events emit nothing.
3. `offers.price` is the **live Rekaz figure the page is displaying**, never
   `events.ticket_amount`, which is a display snapshot taken when the admin
   picked the price. Marking up a price the buyer is not charged is how a
   Merchant listing gets suspended.
4. 🔴 **`offers.url` is the REKAZ STOREFRONT, not this page** (since 2026-07-30).
   An `Offer`'s url is where the offer is transacted, and a paid event is bought
   on `mazj.sa`, not here: Rekaz publishes no write endpoint for a one-time
   product, so this page describes the ticket and links to it. Both values come
   from ONE `loadTicketOffer` call so they cannot describe different products.
   See [`../server/CLAUDE.md`](../server/CLAUDE.md).

**Titles decouple from headlines** via an OPTIONAL `metaTitle` key per namespace
(`lib/metadata.ts`, plus `Meta.metaTitle` for the homepage, which is used
verbatim with no ` | MAZJ` suffix so it must carry the brand itself). When absent
the display `title` drives the tag, but that fallback now only fires on
`PrivacyPage` and `TermsPage`. All 10 indexable routes (`Meta` plus the 9
`*Page`/`Space*` namespaces, matching `lib/routes.ts`) already ship a written
`metaTitle` in BOTH locales, so editing a page's display `title` no longer moves
its `<title>`, `og:title` or `twitter:title`: **edit `metaTitle`.**

🔴 **A `metaTitle` must NOT carry the brand.** `pageMetadata` always appends
` | ${siteName}`, so `"Startups offer | MAZJ"` renders `... | MAZJ | MAZJ`. Only
`Meta` (the homepage) carries its own, because that one is used verbatim.
Shipped and caught on `/startups` 2026-07-28. Verify the rendered `<title>`,
never the JSON.

When checking a `metaTitle` against the ~60-char SERP limit, count **sans
combining marks**: `الخُبر`'s damma is a combining codepoint that overcounts by 1.
metaTitles use ` | ` between clauses; colons were swapped out site-wide
2026-07-23.

**Descriptions decouple the same way, since 2026-08-02.** `metaDescription` is
the optional sibling of `metaTitle` and now ships on all 10 indexable namespaces
in BOTH locales; the `intro` fallback fires only on `PrivacyPage` and
`TermsPage`, which are `noindex`. Before this, 22 of 26 pages took their search
snippet from display copy and **12 of 26 landed outside the 70-160 character
window** (3 English ones truncated at 171-182, 8 wasted at 41-69). Same
counting rule as above: sans combining marks.

🔴 **The homepage reads TWO description keys and they are not interchangeable.**
`generateMetadata` in `app/[locale]/layout.tsx` uses `Meta.metaDescription` (the
SERP snippet, ~140 chars), while `localBusinessSchema` separately reads
`Meta.description` (the business description, where length is free and
completeness is the point). Collapsing them back into one key re-ships a snippet
cut mid-clause on the site's single most valuable result.

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

### The AI-search layer (added 2026-08-02)

Full audit and measurements:
[`../docs/ai-search-visibility-audit.md`](../docs/ai-search-visibility-audit.md).
This is the mechanics.

**Two machine-readable files, both ROUTE HANDLERS rather than files in `public/`.**
`app/llms.txt/route.ts` and `app/pricing.md/route.ts`. A static file cannot read
`messages/*.json` or `SITE_URL`, so it goes stale the first time anyone edits a
product name, the hours or the address, and nothing reports it. Everything in
both is derived. Next routes a segment containing a dot, so the folder name IS
the filename; verified serving 200 with the right content type from a real
production build, since the dev server hides this class of bug.

🔴 **`/pricing.md` carries NO price and ships `X-Robots-Tag: noindex` always.**
The `TONE.md` no-prices rule stands; what the file gives an agent is products,
units of sale, capacity, inclusions, access, currency, VAT and where the number
lives. `noindex` is what keeps a file named "pricing" from ever becoming a search
result, which is also what keeps it clear of the standing rule against labelling
anything "Pricing" in the interface. ⚠️ That naming tension is flagged, not
settled: renaming it is one line here plus the reference in `llms.txt`.

🔴 **`robots.txt` names 14 AI user-agents, and EVERY group restates
`Disallow: /admin`.** Group selection is most-specific-wins: a crawler obeys the
one group matching its name and ignores every other group, `*` included, so a
named group carrying only `Allow: /` hands it the admin tool. Same shape as the
ESLint flat-config trap in the root `CLAUDE.md`. `test/prelaunch-indexing.test.ts`
fails if any group omits it, and separately asserts **CCBot stays unblocked**
(offered to the owner 2026-08-02 and declined: it is the obvious tidy-up, hence
the test).

🔴 **`lib/machine-text.ts` is for MACHINE SURFACES ONLY and must never touch
rendered copy.** It strips the 162 decorative kashidas and the harakat so
`/llms.txt` and `/pricing.md` carry Arabic a tokenizer can match. Pointing it at
a heading would silently delete 46 swashes that `test/arabic-kashida.test.ts`
exists to protect. ⚠️ **A tatweel is decoration when an Arabic letter follows it
and correct orthography when a digit or Latin character does** (`لـ30`,
`الـIP`). A blanket strip shipped `ل30` into a `metaTitle` on the first render;
`test/machine-text.test.ts` walks the real `ar.json` and fails on any orphaned
prefix.

**`FAQPage` is now on the four space pages too**, emitted from
`components/SpaceDetail.tsx` rather than from the four `page.tsx` files, so the
markup and the visible `<dl>` are built from one `faq` prop and cannot drift.
16 questions, zero overlap with `/faq`'s 18, verified. ⚠️ Deliberately NOT
extended to the landing teaser, which renders a `limit`ed slice of the `/faq`
set: marking up a partial copy of another page's questions is the one shape of
this that IS duplication.

**`localBusinessSchema` gained `alternateName`, `paymentAccepted`,
`amenityFeature` (11) and `containsPlace` (the two named rooms with
`maximumAttendeeCapacity` 6 and 30).** 🔴 The capacities are literals, because
parsing them out of `"Up to 6 · by the hour"` and `"حتى 6 · بالساعة"` means
parsing prose in two scripts. `test/schema-facts.test.ts` asserts they still
match the `facts` blocks in both message files, which is the enforcement
`openingHoursSpecification` did not have on the day it was shipping 9-to-9
against a 9-to-5 business. That file also pins the ABSENCE of `aggregateRating`,
`priceRange` and any `Offer.price`, and rejects an `amenityFeature` naming
something the copy never claims (printing is the canonical trap: `طباعة` scores
0 and every English `print` is inside "sprint").

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

- 🔴 **TO AUDIT ANYTHING GOOGLE READS, BUILD A LAUNCH-SHAPED PRODUCTION COPY.
  THE DEV SERVER PHYSICALLY CANNOT SHOW IT.** On `localhost` (and on the vercel
  alias) `IS_PRELAUNCH_ORIGIN` is true, so robots.txt is `Disallow: /` with no
  sitemap line and every canonical is `mazj.example`. Metadata work verified
  there is verified against a configuration that will never ship. The rig, run
  2026-08-02 and the basis of [`../docs/seo-audit-2026-08-02.md`](../docs/seo-audit-2026-08-02.md):

  ```bash
  rsync -a --exclude node_modules --exclude .next --exclude .git <repo>/ <dst>/
  cp -al <repo>/node_modules <dst>/node_modules   # Turbopack rejects a symlink
  cd <dst> && NEXT_PUBLIC_SITE_URL=https://mazj.sa IP_TRUST_PROXY=none npx next build
  NEXT_PUBLIC_SITE_URL=https://mazj.sa IP_TRUST_PROXY=none npx next start -p 3100
  ```

  Sandbox OFF for all four. **Both variables are load-bearing**: the domain is
  what unblocks robots and makes canonicals real, and without `IP_TRUST_PROXY`
  the sitemap silently degrades to the static routes. rsync the DIRTY tree, not
  a worktree: the normal state here is 40+ untracked files, so a worktree builds
  a version of the site that does not exist.
- ⚠️ **`hrefLang`, not `hreflang`.** React emits the camelCase attribute name,
  so `str.count("hreflang")` returns **0** on a page carrying three correct
  tags. It nearly shipped as a critical "the site has no hreflang" finding twice
  in one session. Parse case-insensitively, and assert a known-present control
  (`rel="canonical"`, 26 of 26) before believing any zero.
- **Verify metadata and i18n without a browser:** `curl -s localhost:3000/en` and
  `/ar`, then grep the `<head>` (`<title>`, `og:*`, `hreflang`, canonical) to
  confirm each locale renders fully in its own language. curl needs the sandbox
  off (see `.claude.local.md`).
- 🔴 Remember that `NextIntlClientProvider` serialises every namespace into the
  HTML, so grepping rendered output for a string proves nothing about what is on
  screen. Strip `<script>` blocks first. Full note in [`../CLAUDE.md`](../CLAUDE.md).
- JSON-LD must be verified by **parsing the `ld+json` block**, not by reading the
  rendered page.
- **Testing anything derived from `NEXT_PUBLIC_SITE_URL`:** `lib/site.ts` reads
  `process.env` at MODULE scope, so setting env inside a test changes nothing.
  Re-read it with `vi.stubEnv(…)`, then `vi.resetModules()`, then
  `await import("@/app/robots")`. Worked example in `test/prelaunch-indexing.test.ts`.
- ⚠️ **`.env.local` ships `NEXT_PUBLIC_SITE_URL=` EMPTY**, so every statically
  importing test sees the `mazj.example` placeholder. Adding an origin-derived
  branch therefore changes what unrelated tests observe:
  `test/admin-surface.test.ts` went red when robots gained its pre-launch shape.
  The fix was to assert BOTH shapes, never to relax the assertion.

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
    page.tsx              the index, at /admin. 🔴 Reads NO Rekaz, see below.
```

🔴 **`/admin` (the index) reads nothing from Rekaz, owner ruling 2026-07-30.**
It was an operations dashboard: room occupancy, today's bookings, the next seven
days, subscriptions and renewals, plus a by-mobile booking lookup that could
reveal a customer's stored checkout link. All deleted, because MAZJ manages
bookings and memberships in Rekaz's own platform and a mirror of somebody else's
records can only be staler than the screen it copies. It is now an index: a card
per section carrying that section's real count, and a link out to
`platform.rekaz.io`.

**What that deletion took with it, so a grep for any of it comes up empty:**

| Gone | Why it existed |
|---|---|
| `_lib/dashboard.ts` | the whole Rekaz view model, plus `loadBookingsForMobile` |
| `refreshDashboard` in `_lib/actions.ts` | busting the 60-second cache that no longer exists |
| `DASHBOARD_CACHE_TAG`, `CACHE_SECONDS`, `MOBILE_INPUT_MAX` | the same cache, and the lookup's input clamp |
| `test/admin-booking-lookup.test.ts` | guarded the reveal control's only access check. 🔴 Never committed and deliberately not kept (owner, 2026-07-31): it must be re-written, not restored. `RevealedSecret`'s docblock lists what it asserted. |

⚠️ **`components/admin/RevealedSecret.tsx` (with `RevealButton`) is now DEAD
CODE, mounted on no route**, exactly like `MotionToggle` on the marketing side.
It is kept rather than deleted because it is the one primitive that renders a
bearer capability correctly (selectable text, no anchor anywhere in its tree,
one row at a time), and `test/admin-page-guards.test.ts` still pins its
no-anchor rule. **If a checkout-link reveal ever returns, restore the deleted
test with it**: that test was the entire access control's only assertion, namely
that a booking id which the typed mobile did not match is not a key.

🔴 The counts on the index come from `_lib/nav-counts.ts`, the SAME loader the
rail uses, wrapped in React's `cache()` so the pair costs three Postgres queries
per request rather than six. Do not write a second loader for the page: two
definitions of "coming up" is a badge in the chrome that can disagree with the
card in the content.

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

🔴 **NOR ROUTE HANDLERS. A `route.ts` under `(protected)/` gets NO layout at
all.** Layouts wrap pages; a route handler is reached directly and no layout
runs for it, so `requireAdmin()` there is not belt-and-braces, it is the only
access control. The live example is
`(protected)/events/[id]/csv/route.ts`, which returns a spreadsheet of names,
mobile numbers and email addresses collected from a public form. The folder name
is exactly what makes this easy to get wrong.

`test/admin-page-guards.test.ts` now covers three shapes, and **discovers them
rather than listing them**: every `page.tsx` and every `route.ts` under
`(protected)/`, plus every `"use server"` module in `_lib/`. It named a single
actions file until `event-actions.ts` appeared beside it, which is how a guard
test silently stops covering the thing it was written for.

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

### Changing and deleting an event (added 2026-08-01)

Owner request: publish, unpublish, cancel and delete without opening the event.
Both already existed and both were buried at the bottom of `/admin/events/[id]`
(status was a select in a fourteen-field form applied by pressing Save; delete
was a collapsed panel asking you to type the event's link). `EventActions.tsx`
now renders the same menu on **every row of the list AND beside the event's
title**, and `RecordRow`'s long-unused `action` slot is what it fills.

🔴 **IT IS A SERVER COMPONENT AND MUST STAY ONE, which is why the outcome
travels in the URL.** `/admin` ships exactly six client components, asserted BY
NAME in `test/admin-page-guards.test.ts`, and the reason is not bundle size:
anything reachable from a client component ships to the browser, and `_lib/` can
reach the Supabase secret key. So there is no `useActionState` here. The menu is
a native `details`, each control is a plain form posting to a Server Action, and
the action redirects with `?outcome=<code>`, which `_lib/event-outcomes.ts`
parses back into a sentence. Same mechanism as `?saved=1` and `?resent=1`.

⚠️ Which means the notice OUTLIVES the action, because the parameter stays in
the address bar. Both screens therefore let a failure displace it in the one
alert slot they own: on the detail route `outcome` is passed INTO `EventForm` as
a prop rather than rendered above it, exactly as `saved` already was.

🔴 **A CODE crosses, never a sentence.** The map lives in `event-outcomes.ts` and
an unknown code renders nothing at all, because a value not in that table was not
written by this application. The `event` parameter is validated as a uuid before
it reaches an href.

**Four traps, three of them measured here:**

1. 🔴 **The status select left `EventForm` and a HIDDEN INPUT replaced it.**
   `saveEvent` defaults a missing `status` to `"draft"`, so a form that simply
   stopped sending the field would take a published event off the site on every
   ordinary save, from a control nobody touched. Nothing errors and no other
   test goes red; `test/admin-event-status.test.ts` pins the input.
2. 🔴 **The panel's anchor FLIPS at `md`.** `RecordRow` stacks below that
   breakpoint and its action cell loses `text-end`, so a permanently end-anchored
   panel hangs 288px off the START edge at 390px, and `app/globals.css:116` sets
   `body { overflow-x: hidden }` so it cannot even be scrolled to. Verify by
   asserting `window.innerWidth === 390`, never by cropping a wide capture.
3. 🔴 **The menu's `group` is NAMED (`group/menu`).** `Disclosure` is itself a
   `details` carrying a plain `group`, and Tailwind's unnamed `group-open:`
   compiles to a selector matching ANY open `.group` ancestor. Sharing it rotates
   the closed delete disclosure's chevron whenever the menu is open. The compiled
   pair is two separate selectors; confirm in the served chunk, not the source.
4. ⚠️ **The typed-slug confirmation is GONE** (owner: two clicks, no typing) and
   what replaced it is not smaller, it is different. Typing proved the OPERATOR
   meant this event; `removeEvent` now compares the posted slug against the
   STORED one, which proves the PAGE meant this event and refuses when a stale
   list is acting on a row that has since changed. The poster path is also read
   from the row now, not from a hidden input a caller can set.

⚠️ **`EventForm.tsx` still posts a `posterPath`, legitimately**, for `saveEvent`
to clean up a REPLACED poster. It carries the same shape of exposure, predates
this change, and its blast radius is one image behind an `@mazj.org` session, so
the test is scoped to `EventActions.tsx` rather than relaxed to cover both.

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

### The admin's design system (added 2026-07-29)

`/admin` was rebuilt on **shadcn** in MAZJ's own visual language. What follows is
the mechanics; the visual rules are `DESIGN.md`, the copy rules are `TONE.md`.

**Where the pieces live.**

| Path | Holds |
|---|---|
| `components/ui/**` | shadcn primitives, vendored from the `new-york-v4` registry |
| `components/admin/**` | the 22 MAZJ primitives (`Panel`, `StatusDot`, `DataTable`, `Notice`…) |
| `app/admin/admin.css` | every token value, as CSS custom properties |
| `scripts/vendor-shadcn.py` | re-fetches and re-patches `components/ui/**` |
| `components.json` | shadcn CLI config |

⚠️ **`npx shadcn@latest init` HANGS here** (interactive prompt, ignores `-y`) and
writes nothing, so it reads as a broken tool rather than a stalled one. Fetch the
registry directly instead, which is what `scripts/vendor-shadcn.py` does:
`https://ui.shadcn.com/r/styles/new-york-v4/<name>.json` returns 200, while
`/r/<name>.json` 404s.

🔴 **`app/admin/admin.css` is imported by `app/admin/layout.tsx` and by NOTHING
else, and that is the entire safety argument.** The admin is a second root
layout with its own `<html>`, so its stylesheet never reaches the marketing
document. Verified live: `/admin` serves a chunk containing `--ok` / `--warn` /
`--destructive`, and `/en` serves a different chunk containing none of them.
⚠️ The corollary is a real footgun: an admin token used on a marketing page
produces an INVALID declaration that the browser drops, so the element keeps
what it inherited and **nothing visibly breaks**. `eslint.config.mjs` now bans
those imports outside `app/admin/**`; it cannot ban a class NAME, so a copied
class string still fails silently.

🔴 **`muted` is a marketing token (`#514E4A`, 69 uses) so shadcn's
`muted`/`muted-foreground` are vendored in as `subtle`/`subtle-foreground`.**
`scripts/vendor-shadcn.py` rewrites them on the way in. Never define a `muted`
CSS variable.

🔴 **The admin has a STATUS PALETTE and the marketing site does not.**
`DESIGN.md` forbids status hues and says a new surface must introduce them
deliberately; this is that introduction, scoped to `admin.css`. `--ok #35682F`,
`--warn #7F5310`, `--destructive #8F2018`, all clearing AA on cream AND tan. The
red is that dark specifically to stay 2.85:1 from the coral; lighter candidates
measured 1.76 to 2.41 and read as a shade of the brand. **Colour is never the
only signal**: the three marks are 1.01 to 1.33:1 apart in luminance, so
`StatusDot` requires a shape and a word in its type signature.

**Four traps, all of which shipped silently once and were measured out:**

1. 🔴 **`cn()` deletes numeric font sizes unless taught.** tailwind-merge knows
   only `text-xs…text-9xl` as sizes and files every other `text-*` under
   COLOUR, so `cn("text-11 text-ok")` returned the colour ALONE and the element
   inherited 16px. `lib/utils.ts` extends it with `isNumericFontSize`. ⚠️ The
   validator must be a FUNCTION: tailwind-merge ignores a RegExp silently, so
   `[{ text: [/^\d+$/] }]` compiles, reads correctly and does nothing.
2. 🔴 **Never install `tailwindcss-animate`.** It registers `duration-*`,
   `delay-*` and `ease-*` as ANIMATION utilities under the names Tailwind
   already uses for TRANSITIONS, and the marketing site shares this one build.
   Harmless today (its 7 uses sit on `transition-*` elements) and a trap the
   moment anything carries both. The ten utilities the shadcn overlays need come
   from the `adminOverlayMotion` plugin in `tailwind.config.ts`.
3. 🔴 **Never add shadcn's `borderRadius` override** (`lg: "var(--radius)"`). It
   repaints the 59 marketing uses of `rounded-sm/md/lg/xl` and breaks them
   outright, since `--radius` is undefined there. Tailwind 3.4's default ladder
   already IS `DESIGN.md`'s (2/4/6/8/12/16px).
4. ⚠️ **The registry is Tailwind v4 and this repo is 3.4.** `shadow-xs`,
   `outline-hidden`, `field-sizing-content`, `var(--spacing)` and the
   `max-h-(--x)` variable shorthand all compile to NOTHING here.
   `scripts/vendor-shadcn.py` patches each and asserts the patch fired. It also
   strips `dark:` (light-only ruling) and the gratuitous `"use client"` on
   `table.tsx`. Re-run it rather than hand-editing after a registry update, then
   re-check every class actually emits CSS.

⚠️ **`aria-invalid:` is not a Tailwind 3 variant.** It is added under
`theme.extend.aria`; without it every shadcn form-error style compiles to
nothing and an invalid field looks exactly like a valid one.

**Verifying admin work.** Signing in needs a Supabase magic link that cannot be
driven from a terminal, so the protected screens cannot be photographed
directly. The route that worked was a TEMPORARY harness under `app/admin/`
rendering the shell and every primitive against fixtures, gated on `NODE_ENV`,
deleted afterwards. ⚠️ Do not name it with a leading underscore: Next treats
`_`-prefixed folders as private and it will never become a route. ⚠️ A harness
must reproduce the real lane exactly (`max-w-[1120px] px-6 md:px-8 lg:px-10`) or
it manufactures a false horizontal overflow at 390.

🔴 **You CANNOT make a protected page photographable by extracting its body into a
sibling component.** `test/admin-page-guards.test.ts` asserts exactly one heading
source (`<h1` or `<PageHead`) **per `page.tsx`**, so moving `PageHead` into a view
module leaves the page with zero and fails there. That is the obvious refactor and
it is closed, so the harness has to COPY the page's JSX.

**Which means the copy is the risk, and it is measurable.** Strip comments,
collapse whitespace, and assert the harness body and the real body are IDENTICAL
before you believe the screenshot. Done on `/admin` 2026-07-30: both sides
normalised to 1296 characters and compared equal, so the capture was of the
shipped markup rather than of a drifted copy. Without that step a harness
screenshot proves only that the harness looks right.

✅ **A harness for ONE COMPONENT should IMPORT it, never copy it**, which closes
the drift risk above outright: the copy rule exists because a protected PAGE's
body cannot be extracted, and a component already is one. Reconstruct only the
row or head AROUND it. Used for the event controls, 2026-08-01.

⚠️ **Put it OUTSIDE `(protected)/`.** Inside, `test/admin-page-guards.test.ts`
demands `requireAdmin()` and exactly one heading source from it. `app/admin/<name>/`
still gets the admin root layout, so it still serves the real stylesheet.

⚠️ **A harness turns `npx eslint .` RED while shipped code is clean.**
`@next/next/no-html-link-for-pages` fires on every `<a href="/admin/…">` fixture
link (13 errors from 3 fixtures). Read the paths before believing the repo broke.

## `/[locale]/startups`: the startups & builders offer

Added 2026-07-28. A marketing page that also takes an application, plus
`/admin/startups` to decide them. Backend mechanics (the table, the two rate
limits, the email module, the decision-versus-delivery rule) live in
[`../server/CLAUDE.md`](../server/CLAUDE.md); this is the routing.

- Indexable and in `lib/routes.ts`. "Coworking for startups in Khobar" is a real
  query and this is the only page that answers it.
- The write path is a Server Action in `app/[locale]/startups/_lib/actions.ts`,
  the second such crossing after booking's. 🔴 It returns an error **CODE**, never
  a message: `route()` and `toPublicError` are wired into `app/api/**` only, and
  Next redacts *thrown* errors rather than *returned* action values, so a
  returned `AppError.message` serialises to the browser verbatim. The booking
  form shipped exactly that leak once.
- 🔴 **The locale travels in a hidden input.** A Server Action has no route
  context, so `headers()` cannot tell the server which language the visitor was
  reading, and without it every approval and rejection email would go out in
  English. The service narrows the value to `en`/`ar`, so a crafted post is inert.
- ⚠️ **The form is NOT wrapped in `Reveal`.** `.reveal` rests at `opacity:0` and
  is not no-JS safe. A marketing paragraph that never appears is a shame; an
  application form that never appears is the page failing at its only job.
- The landing band (`components/FoundingBand.tsx`) now points here instead of at
  WhatsApp, and `Founding.ctaMsg` was deleted from both message files. The
  footer links it too, beside Events.

## Adding a route

Create `app/[locale]/<route>/page.tsx`, add a `*Page` namespace to **both**
message files (a written `metaTitle` AND `metaDescription`), and add the route to
`lib/routes.ts` if it should be indexable. Server components can call
`useTranslations` directly; client components work because the whole tree sits
under `NextIntlClientProvider`.

🔴 **Do NOT render `<Footer />` in the page.** It is mounted once in
`app/[locale]/layout.tsx` as a SIBLING of `<main>`, since 2026-08-02. All 14
route files used to render it as the last child of their own `<main>`, and that
cost two things, both measured across the 26 rendered production pages:

1. Per the HTML Accessibility API Mappings, a `<footer>` that DESCENDS from
   `main` does not map to the `contentinfo` role. `role="contentinfo"` appeared
   **0 times** on the whole site, so a landmark rotor could not jump to the
   footer on any page.
2. **208 of 616 internal anchors, 33.8% of the entire internal link graph**, were
   site-wide boilerplate structurally filed as main content. On `/en/contact`
   ALL 8 in-main internal anchors were footer links and 0 were contextual, which
   is exactly the signal an extraction pass reads to decide what a page is about.

One mount also means it cannot be forgotten on a new route or ordered
differently on one of them.
