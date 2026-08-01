# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

This is the **hub**. It carries what every session needs regardless of what it is
doing: what MAZJ is, how to run it, the copy rule, and the traps that bite
anywhere in the tree. Everything else lives in a scoped file next to the code it
describes.

## 🔴 Where the knowledge lives

Read the file that owns the layer you are about to touch. Each is the single
source of truth for its layer; copy a rationale into ONE of them, never several.

| File | Owns | Read it before |
|---|---|---|
| **`CLAUDE.md`** (this file) | Project identity, commands, the i18n rule, cross-cutting gotchas | Always. It is loaded automatically. |
| [**`app/CLAUDE.md`**](./app/CLAUDE.md) | Locale routing, layout, metadata, JSON-LD, sitemap, share cards, the `lib/` SEO files, `globals.css` ownership | Any route, layout, metadata, SEO or redirect work |
| [**`components/CLAUDE.md`**](./components/CLAUDE.md) | Component form, RTL, Arabic typography, motion, media, brand assets, and every visual verification recipe | Any UI, styling, animation, image or video work |
| [**`server/CLAUDE.md`**](./server/CLAUDE.md) | The backend: Supabase, migrations, RLS, API routes, the Rekaz client, the admin's access gates, the frontend/backend boundary | Any backend, database, API, Rekaz or auth work |
| [**`docs/rekaz-api-findings.md`**](./docs/rekaz-api-findings.md) | What the Rekaz API actually **does**, probed live against the production tenant | 🔴 Anything touching Rekaz, before you trust their docs |
| [**`DESIGN.md`**](./DESIGN.md) | How it **looks**: colour, type, space, shape, motion, component form | Any visual change |
| [**`TONE.md`**](./TONE.md) | How it **sounds**: voice, register, settled vocabulary, what copy may and may not say | Any user-facing string |
| [`server/README.md`](./server/README.md) | The backend's layer contract, for humans | Adding anything to `server/` |
| [`.claude.local.md`](./.claude.local.md) | THIS MACHINE: what the command sandbox blocks, the two GitHub identities, the `$TMPDIR` split, worktree `node_modules` | 🔴 Before your first `curl localhost`, `npm install`, build or push |

**Why it is split this way.** Claude Code loads this root file into every
session, but a `CLAUDE.md` inside a directory loads only when you actually work
in that directory. So a backend session does not pay for ~48KB of Arabic-clipping
rules, and a copy session does not pay for the migration mechanics. Keep it that
way: when you learn something new, put it in the **narrowest** file that covers
it, and only put it here if it genuinely bites everywhere.

`DESIGN.md` = how it LOOKS. `TONE.md` = how it SOUNDS. The `CLAUDE.md` files =
how it is BUILT (mechanics, gotchas, verification recipes).

🔴 **A "the site FEELS wrong" complaint usually lives in `DESIGN.md`, not
`TONE.md`.** Retiring "quiet" as a value (owner ruling 2026-07-31): the word
appeared **once** per message file, while `DESIGN.md` briefed every photograph
"Rooms read as occupied **and calm**". The picture was selling the feeling the
copy never wrote down, so a copy-only audit would have reported the site clean.
**Audit the art direction before the strings.**

## Project

**MAZJ (مزج)** is a bilingual (English + Arabic) marketing site built with
**Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS 3** and
**GSAP**, with a **Supabase** backend added 2026-07-27.

It is a pixel-faithful animated multi-page site: home plus `/about` `/contact`
`/events` `/faq` `/privacy` `/spaces` `/startups` `/terms`, plus the four
space-detail routes
`/spaces/{coworking,private-office,meeting-room,event-hall}`, all under
`app/[locale]/`. That is 13 route groups x 2 locales = 26 pages, most of them
prerendered, with
`app/[locale]/[...rest]` catching everything else and rendering on demand. Since
2026-07-27 each space also has a `/book` child (4 routes x 2 locales, rendered on
demand) where booking happens against the Rekaz API.

**`/events` became a real product on 2026-07-28**, and it is the first route
whose CONTENT is not in `messages/*.json`. Events are database rows authored in
`/admin/events`: bilingual, with a poster uploaded to Supabase Storage, a seat
limit, and either free sign-up or a Rekaz-paid ticket. Each published event gets
`/events/<slug>` (rendered on demand, plus an `/ics` calendar child), and an
event moves itself from "coming up" into the archive when its `ends_at` passes,
computed at read time. The 41 hand-typed archive entries moved into the database
in the same change, so `EventsPage.upcoming` and `EventsPage.archive` no longer
exist in either message file. 🔴 The i18n rule below still governs the page's
CHROME (labels, empty states, the form); it no longer governs the events
themselves. See [`server/CLAUDE.md`](./server/CLAUDE.md).

**`/startups` was added 2026-07-28**: the startups & builders offer explained,
plus a form that files an application into `startup_applications`. `/admin`
approves it with a code or rejects it with a reason, and either way the applicant
gets a branded email in their own language. 🔴 The offer's terms stay a closed
envelope everywhere (`TONE.md` §6), and 🔴 the code cannot be redeemed by
software: Rekaz has no coupon API, so a MAZJ person honours it and `/admin`
records that they did. See [`server/CLAUDE.md`](./server/CLAUDE.md).
`/pricing`→`/spaces` and `/community`→`/about` are redirects in
`next.config.mjs`. Routes are locale-prefixed: `/en` (LTR) and `/ar` (RTL).
English is the default; `/` redirects to `/en`.

Since 2026-07-27 there is also **`/admin`**, an English-only internal tool with
its own root layout, deliberately **outside** the locale system: no locale
prefix, no hreflang, no sitemap entry, `Disallow` in robots.txt. Sign-in is a
Supabase magic link restricted to `@mazj.org` by three independent gates. See
[`app/CLAUDE.md`](./app/CLAUDE.md) for the routing and
[`server/CLAUDE.md`](./server/CLAUDE.md) for the gates.

🔴 **`/admin` READS NOTHING FROM REKAZ, owner ruling 2026-07-30, and that is now
the defining fact about it.** It managed events and startup applications AND
mirrored Rekaz operations (a live room-occupancy board, today's bookings, the
next seven days, subscription totals and renewals, plus a by-mobile booking
lookup). All of that is deleted. MAZJ manages bookings and memberships in
Rekaz's own platform, so a second copy here could only ever be staler than the
screen it duplicates, and on the day the two disagreed the reader had no way to
tell which was lying. `/admin` is now an index over the two things MAZJ actually
runs from here, plus a link out to `platform.rekaz.io`. What went with it: the
60-second `unstable_cache`, the Refresh action, the health strip, and the 2.8s
to 7.8s page assembly. **Do not reintroduce a Rekaz tile "for reference".**

**Brand facts (not derivable from the code):**

- MAZJ is a **single** coworking location in **Al Khobar** (Al Olaya district, Al
  Hayat Tower = برج الحياة "Life Tower"). 🔴 The tower is **not a landmark**
  (owner ruling 2026-07-26), so it appears ONLY in address, directions and legal
  copy, never as a locator in marketing lines. See `TONE.md` §4.
- "الملقى / Al-Malqa" and "المعارج / Al-Ma'arij" are **room names** (the meeting
  room and the events hall), NOT city districts. Don't "correct" them against the
  Al-Khobar eyebrow.
- MAZJ sells **4** products (was 6): duration is now a variant picker inside
  each, not a product of its own. `BOOKING` in `lib/links.ts` =
  `sharedSeat`/`privateOffice`/`meeting`/`event`, and since 2026-07-27 those are
  **internal** `/spaces/<space>/book` paths, not mazj.sa URLs. The old store
  paths live in `LEGACY_STORE_PATHS` and are redirected.
- The Google rating is **4.7** with few reviews, **not 5.0**. A hardcoded `5.0`
  in the hero trustLine and in Proof was a real shipped bug. Don't put a rating
  claim in the hero or Proof at all; lead with legitimacy signals (address,
  staffed hours, 24/7 subscriber access, VAT).
- 🔴 **The team is in the space Sun-Thu, 9am to 5pm. NOT 9 to 9** (owner
  correction 2026-07-31; the wrong figure had reached 14 strings per language
  and `lib/schema.ts`'s `openingHoursSpecification`, which is the copy Google
  reads). "24/7" belongs to **space subscribers**, never to walk-ins.
- 🔴 **"Member" is reserved for a product that does not exist yet.** Owner
  ruling 2026-07-31: membership will be a bigger thing than a desk, of which a
  space subscription may only be one part, so the space plan is a
  **subscription** and the person on it is a **space subscriber** /
  `مشترك المساحة`. `عضو` / `عضوية` appear in **zero** strings in either message
  file as of that date. Don't reintroduce either, and don't rename the
  `Founding` namespace or `FoundingBand.tsx` on the strength of it: those hold
  the startups offer and are a naming leftover. The founding-15 offer itself is
  dead site-wide (same ruling), FAQ item deleted rather than reworded.
- Space access is QR code / card via Rekaz, **non-biometric**. 🔴 Never
  re-introduce "fingerprint" or biometric copy (stripped site-wide 2026-07-23:
  biometric data is PDPL-sensitive and implies a controller registration MAZJ
  avoids).

**Three MAZJ web properties exist.** This marketing site (unlaunched), **mazj.sa**
(the Rekaz booking store, live prices and checkout), and **mazj.org** (a stale
2021 WordPress site, `lang="ar"`, holding MAZJ's ONLY organic ranking equity:
#1-3 in Arabic for the head coworking terms under Saudi geo, plus a
self-canonicalising `/home-2/` duplicate to noindex). Treat launch as a
**consolidation**, not a third site: the `mazj.org`→new-site 301 map (25 legacy
URLs → `/ar/*`) and the Google Business Profile brief live in `docs/`. mazj.sa's
robots.txt is a training-vs-search split (blocks GPTBot/ClaudeBot/Google-Extended,
ALLOWS OAI-SearchBot/PerplexityBot/Googlebot), so it IS citable by
ChatGPT-search, Perplexity and AI Overviews but not Claude or Gemini: don't
report it as "AI-blocked".

### Launch plan (owner decision, 2026-07-27)

**Both `www.mazj.sa` and `www.mazj.org` will serve THIS site, deployed on
Vercel.** Timing is "later".

**The Vercel project now EXISTS and `main` is live on it, since 2026-07-28.**
Project `mazj` under team `byosama`, connected to `github.com/byosamah/mazj`,
auto-deploying production from `main`. Production alias
**`https://mazj-tau.vercel.app`** (`mazj.vercel.app` was already taken by an
unrelated site). Neither real domain points at it yet, so this is a staging
deployment in every sense except the word.

🔴 **`NEXT_PUBLIC_SITE_URL` is currently the `.vercel.app` alias, and that is
TEMPORARY by owner instruction (2026-07-28).** It could not be either real
domain because both currently serve DIFFERENT live sites, so every canonical
would have pointed Google at content we do not control. Change it (Production
AND Preview) the moment a real domain is connected, and redeploy.

**That one variable also controls whether the site is indexable at all.**
`IS_PRELAUNCH_ORIGIN` in `lib/site.ts` is true for any `*.vercel.app` host, and
`app/robots.ts` then serves `Disallow: /` with no sitemap line. It lifts itself
when the origin becomes real, so there is nothing to remember to switch off. Do
not "fix" the blocked robots.txt by editing that file: set the domain.

🔴 **Four things that decision breaks or forces. Items 1 and 2 are now DONE;
items 3 and 4 are still open and must be resolved BEFORE pointing either domain
at Vercel.**

1. **The booking links used to die.** `BOOKING` sent every buyer to
   `https://mazj.sa/subscription/*` and `https://mazj.sa/reservation/*`, which
   are **Rekaz store paths**. With `www.mazj.sa` serving this app those hit
   next-intl's locale redirect, then the `[...rest]` catch-all, and **404**.
   Verified locally on all four.

   🔴 **SUSPENDED 2026-08-01, AND `main` SHIPS THE SUSPENSION. Read this before
   you believe the paragraph under it.** Owner decision: Rekaz's API is not fit
   to take bookings, so until they fix it **nobody reaches the on-site flow**.
   Every Book control links out to the product's own page on the mazj.sa
   storefront in a new tab, and the four `/spaces/<space>/book` routes **307**
   out to the same pages so a bookmark or a shared link cannot get in either.
   Design record:
   [`docs/superpowers/specs/2026-08-01-booking-linkout-to-mazj-sa-design.md`](./docs/superpowers/specs/2026-08-01-booking-linkout-to-mazj-sa-design.md).

   Nothing was deleted. Every booking file is untouched on disk and today's
   pre-change `main` is parked verbatim on the branch **`feature/onsite-booking`**,
   so restoring it is a revert rather than a rewrite. The three facts that bite:

   - 🔴 **The eight `LEGACY_STORE_PATHS` redirects were DELETED in the same
     commit, and must stay deleted while the outbound ones exist.** Both
     directions between the same two URLs is `ERR_TOO_MANY_REDIRECTS` on the
     revenue path the day this app serves `mazj.sa`. Restoring them is correct
     only in the commit that removes the outbound rules.
     `test/booking-links.test.ts` asserts their absence.
   - 🔴 **The outbound rules are `permanent: false` (307) on purpose.** A 308
     would be cached by browsers and Google indefinitely and would **survive the
     revert**, so customers would keep being thrown to mazj.sa after on-site
     booking returned.
   - 🔴 **Reverting the code without reverting `test/booking-links.test.ts`
     leaves a suite that fails green**, still asserting booking links leave the
     site.

   Everything from here to the end of this item describes how the site worked
   from 2026-07-27 until 2026-08-01, and will again.

   ✅ **RESOLVED AND BUILT, 2026-07-27.** Booking now happens on this site at
   `/spaces/<space>/book` for all four products, and the legacy store paths 308
   to their replacements (each in a bare AND a locale-prefixed shape, since
   `mazj.sa/subscription/<slug>` 308s to `/ar/subscription/<slug>` and that form
   collides with our own `/ar` prefix). `lib/links.ts` `BOOKING` is now internal
   paths; `LEGACY_STORE_PATHS` holds the old ones and a test asserts both shapes
   are redirected.

   🔴 **The one thing on-site booking cannot absorb is payment.** Rekaz has no
   payments API, so the card step still leaves our domain, to
   `platform.rekaz.io`. That host is NOT `mazj.sa`, so it survives the domain
   move intact. ⚠️ The link arrives RELATIVE, not absolute as documented, and
   must be resolved against the Rekaz origin or the last click of every purchase
   lands on our own 404. Confirmed against the live API, see
   [`docs/rekaz-api-findings.md`](./docs/rekaz-api-findings.md).

   ⚠️ **The "no prices on the site" guardrail was relaxed for this**, owner
   decision 2026-07-27: live prices pulled from the Rekaz API may appear INSIDE
   the booking flow. Marketing pages stay price-free. See `TONE.md`.
2. 🔴 **`IP_TRUST_PROXY` must be set on the Vercel project, or both rate limits
   run on values the caller writes.** Whether a forwarded IP header can be
   trusted is a property of the topology, and a request cannot report its own
   topology. Vercel OVERWRITES `x-forwarded-for` to prevent spoofing, so on
   Vercel the address is attested and the header-rotation attack does not work;
   with nothing configured the app assumes the weakest reading. `server/env.ts`
   now REFUSES to start in production without it, so this fails on the ground
   rather than silently in the air. See [`server/CLAUDE.md`](./server/CLAUDE.md).

   ✅ **DONE 2026-07-28.** Set to `vercel` on Production and Preview, along with
   the seven Supabase and Rekaz variables. ⚠️ `SUPABASE_DB_URL` and
   `SUPABASE_ACCESS_TOKEN` were deliberately NOT uploaded: they are local
   tooling credentials (migrations, the Management API PAT) that the running app
   never reads, and a database superuser password plus an account-wide PAT do
   not belong in a serverless runtime.

   ⚠️ **`vercel.json` pins `regions: ["fra1"]` and must stay pinned.** Vercel
   defaults to `iad1` (Washington DC) while Supabase is in Frankfurt, which
   measured 303-416ms per query on the first deploy and **39ms** after the pin.
   Reasoning in [`server/CLAUDE.md`](./server/CLAUDE.md), because JSON takes no
   comments.

   ✅ **Supabase's auth URL configuration was updated the same day.** Site URL
   is `https://mazj-tau.vercel.app`, and the redirect allow list gained
   `…/admin/auth/callback` and `…/admin/**` for that origin. The `localhost:3000`
   entries were KEPT so local development still signs in, and the `mazj.sa` /
   `mazj.org` entries were already there for launch.

   🔴 **That list is not cosmetic, and its failure mode is silent.**
   `app/admin/_lib/actions.ts` derives the origin from the request and passes an
   explicit `redirectTo`. Supabase validates that against the allow list and,
   when it does not match, does not error: it quietly substitutes Site URL. So
   before this change the deployed admin sent a real, valid magic link that
   landed on `localhost:3000`. Whenever a new origin starts serving `/admin`,
   add it here or sign-in breaks in a way that looks like a mail problem.
3. ✅ **DECIDED 2026-07-31: BOTH domains serve this one site.** Owner's words:
   "we gonna use mazj.sa and mazj.org together, they will be the same target,
   open same website and everything." So there is no second site and no split
   content, and the duplicate-content trap this item used to warn about is
   structurally closed rather than merely avoided: `lib/site.ts` reads ONE
   `NEXT_PUBLIC_SITE_URL` and every canonical, hreflang, `og:url`, sitemap
   `<loc>` and JSON-LD `@id` is built from it, with no per-host branch anywhere.
   Whichever host serves a request, the page still names the SAME canonical.
   🔴 It follows that nobody may ever make that origin host-dependent. The moment
   two hosts self-canonicalise, MAZJ has two copies of one site.

   ⚠️ **Still open, and it is small: which name sits in the address bar.** On
   Vercel that is one setting (add both domains, mark one primary, Vercel 301s
   the other). It is worth deciding rather than defaulting, because the redirect
   is what carries mazj.org's Arabic ranking equity (#1-3 on head terms) to
   whichever name wins. `docs/mazj-org-301-redirect-map.md` assumes mazj.org is
   retired; re-read it against the answer.
4. 🔴 **THE REAL BLOCKER IS NOT SEO, IT IS THAT `mazj.sa` IS CURRENTLY THE REKAZ
   STORE.** `REKAZ_STORE_ORIGIN` in `server/rekaz/store.ts` is
   `https://mazj.sa`, and every paid event's ticket button points at
   `mazj.sa/<locale>/merchandise/<slug>` there. Point `mazj.sa` at Vercel and
   those buttons hit this app, which has no such route, so every ticket link dies
   on day one. `npm run check:env` already warns when `NEXT_PUBLIC_SITE_URL` and
   the store origin share a domain, deliberately as a warning rather than a
   throw. Probed 2026-07-30: `mazj.rekaz.io`, `mazj.rekaz.sa`, `store.mazj.sa`
   and `shop.mazj.sa` all fail to resolve, so the store has no other address yet.
   **Rekaz supports custom domains** (their own platform strings confirm it), so
   the fix is to ask them to move the store to something like `store.mazj.sa`
   and then update that one constant. Sequence that BEFORE pointing `mazj.sa` at
   Vercel.

   🔴 **REKAZ ACCEPTS EXACTLY ONE CUSTOM DOMAIN** (owner, 2026-07-31). Moving it
   is still fine, because changing which single domain Rekaz holds is not adding
   a second. What is ruled out is an overlap window: nothing serves the store on
   both names at once, so it is a hard cutover.

   ✅ **The blast radius is ONE constant and, today, probably zero live sales.**
   The site's only dependency on the store is the paid-event ticket button and
   its JSON-LD `Offer` url, both built from `rekazStoreUrl()`. Room booking moved
   on-site on 2026-07-27 and the four legacy store paths already 308 to it. The
   tenant's only merchandise product is `فعالية تجريبية` ("trial event", 50 SAR),
   i.e. a test item, so there is likely nothing real to break. Verify that before
   the cutover rather than assuming it.

   ⚠️ **And the cutover hands us the cleanup tool.** Once `mazj.sa` points at
   Vercel we can 301 stale store URLs ourselves, which is impossible while Rekaz
   holds the domain. `LEGACY_STORE_PATHS` already does this for the four room
   products; a `/:locale/merchandise/:slug` rule to the new store origin is the
   missing sibling.

### Deploying

`main` auto-deploys to production: push and Vercel builds, there is no separate
step. ⚠️ The GitHub integration does not fire retroactively, which is why the
first deploy had to be a manual `vercel --prod`.

- **Which region a function actually ran in** is the middle slot of the response
  header `x-vercel-id: <edge>::<function>::<id>`. That is how the `iad1` default
  was caught. Expect `fra1`; anything else means `vercel.json` stopped being
  honoured.
- **Smoke test after a deploy**, sandbox off: `/api/health` (database, expect
  ~40ms warm), `/robots.txt` (pre-launch block), an anonymous `/admin` (expect
  307 AND a body carrying no dashboard data), and one `/book` route per locale,
  which proves the Rekaz credential because they call it live.

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build. See the two gates below. |
| `npm start` | Serve the production build |
| `npm run lint` / `lint:fix` | ESLint 9 flat config (`eslint.config.mjs`, `eslint-config-next/core-web-vitals`). Next 16 removed `next lint`; the script is plain `eslint .`. Currently exits 0 (the long-standing `react-hooks/set-state-in-effect` error in `Hero.tsx` is fixed), so any error you see is yours. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:watch` | Vitest. 11 RLS plus 12 Rekaz integration tests against the LIVE production tenant (read-only), all of which skip without credentials. (No total quoted here on purpose: this row read `294` while the suite ran **572**.) 🔴 The Rekaz ones pin tenant **DATA**, not just response shapes: one asserts a product slugged `faalyh-tjrybyh` is still sold, so the owner renaming it in Rekaz's dashboard turns `verify` red with **no code change**. Run `npm run check:rekaz` to tell a dead credential from moved data before debugging your own diff. 🔴 Needs the sandbox OFF, see below. |
| `npm run verify` | lint + typecheck + test, the pre-commit sweep |
| `npm run check:env` | Validates backend config without starting the app |
| `npm run check:rekaz` | One live GET `/branches`: proves the Rekaz credential actually works. 🔴 `check:env` only length-checks it, so it passes on a dead key. Sandbox OFF. |
| `npm run db:push` / `db:types` / `db:types:check` / `db:diff` | Supabase migrations and generated types. See `server/CLAUDE.md`. |

🔴 **`npm run build` requires `NEXT_PUBLIC_SITE_URL`.** `lib/site.ts` throws on
any `NODE_ENV=production` build while the origin is still the `mazj.example`
placeholder, so a bare `npm run build` fails BY DESIGN. Use
`NEXT_PUBLIC_SITE_URL=https://<domain> npm run build` until the real domain is in
the environment.

🔴 **The command sandbox also breaks Node's outbound TLS.** Any test or script
that `fetch`es an external host fails with a bare `TypeError` while `curl` to the
same URL returns 200, because curl trusts the system keychain and Node ships its
own CA store. So `npm run test` and `npm run verify` need the sandbox OFF too,
not just `build`. The failure is deeply misleading: it surfaces as
`upstream_unavailable`, i.e. "Rekaz is down", rather than anything about your
shell. `npm install` needs it off as well (root-owned `~/.npm`).

🔴 **`npm run build` also needs the command sandbox OFF.** Turbopack spawns a
subprocess that binds a port on the PostCSS step, so a sandboxed build panics
with `Error [TurbopackInternalError]: [project]/app/globals.css [app-client]
(css)` / `Execution of parse_css failed` / `binding to a port` / `Operation not
permitted (os error 1)`. It names a real source file and reads as a CSS defect;
it is not one. It is a compile-phase abort that happens BEFORE the `SITE_URL`
gate, so a sandboxed run tells you nothing about `NEXT_PUBLIC_SITE_URL`.
`npm run lint` and `tsc --noEmit` both exit 0 sandboxed. See `.claude.local.md`.

🔴 **`npm start`, and any build that READS the database, also needs
`IP_TRUST_PROXY`.** `server/env.ts` refuses to boot in production without it, so
a local production run answers **500 on every route** with the reason only in
the server log, never in the response. It is set on Vercel and deliberately
absent from `.env.local`, so locally:
`NEXT_PUBLIC_SITE_URL=https://<domain> IP_TRUST_PROXY=none npm start`.
⚠️ Missing at BUILD time it does not fail, it DEGRADES: `env()` throws, the
Supabase client with it, and `app/sitemap.ts` silently ships the static routes
and **zero** event URLs. Measured 2026-07-28: 22 entries where there should have
been 26.

🔴 **Never pipe `npm run build` into `head`.** `head` closes the pipe, SIGPIPE
kills the build mid-flight, and the visible exit status still looks plausible.
`.next` is left without a build id and the failure surfaces much later, from a
different command, as `Could not find a production build in the '.next'
directory`. Redirect to a file and grep the file. (The same rule already applies
to every long command here; this is the one where the damage outlives the
command.)

`next.config.mjs` and `proxy.ts` changes need a dev-server restart;
Tailwind, CSS and component edits hot-reload.

## 🔴 i18n content-sync rule (MOST IMPORTANT, read before touching any copy)

🔴 **Copy voice, tone and standards live in [`TONE.md`](./TONE.md): the single
source of truth for how MAZJ copy sounds and what it may or may not say.** READ
IT before writing or editing ANY user-facing copy (site copy, `Meta`, `alt` text,
CTA labels, WhatsApp prefilled messages). `TONE.md` is a **living document**:
whenever the owner gives copywriting feedback (a correction, a "this word is
wrong", a preference), apply it to the copy AND add the rule plus a before/after
example to `TONE.md` so it is never re-litigated. This section covers the file
MECHANICS (both-file key parity); `TONE.md` owns the VOICE and the content
constraints (positivity, settled AR vocabulary, no prices, no em-dashes, no
biometric, the locked lines).

All user-facing text lives in `messages/en.json` and `messages/ar.json`, keyed by
namespace (`Meta`, `Nav`, `Hero`, `SpaceFinder`, `Usp`, `Steps`, `Why`,
`Network`, `StepInto`, `Footer`, plus section namespaces like
`Faq`/`Proof`/`Founding`/`HostEvent`/`Location`/`Spaces`, one `*Page` namespace
per route, and a `Space*` namespace per space-detail page). Components read
strings via next-intl's `useTranslations("Namespace")`: **never hardcode display
text in a component.**

**Whenever you change copy in ONE language, you MUST mirror it in the OTHER
language in the same edit:**

- Add a key → add it to **both** `en.json` and `ar.json`.
- Reword a string → update the other language's translation to match the new meaning.
- Remove a key → remove it from **both**.

The two files must always share an identical key structure (same namespaces, same
keys, arrays the same length). `en.json` is the source of truth for meaning; the
Arabic is **Modern Standard Arabic (فصحى)** in a modern marketing register. Keep
the brand as `MAZJ` / `مزج`, keep numerals and symbols intact (`$0`, `20%`,
`kWh`, `68°F`, `24/7`), and put `\n` line breaks at natural Arabic break points.
Never leave one language stale, and never dump raw or literal English into the
Arabic file.

**Arabic city spelling is settled: `الخُبر`** (damma only), in every occurrence in
`messages/ar.json` (60 at time of writing, including all 10 `metaTitle`s) plus
exactly ONE source file outside the message files: `lib/schema.ts`
`addressLocality`, which feeds the JSON-LD `PostalAddress`. A site-wide
respelling must touch that file too. Do NOT "correct" it to bare `الخبر` or
fully-vocalized `الخُبَر`: a native reviewer WILL flag the partial vocalization as
a half-measure (and note that bare `الخبر` also reads as "the news"), and it was
kept anyway for consistency with the body copy. Change it only on an explicit,
site-wide instruction.

**AR product vocabulary is settled: reuse it, never coin a synonym.** Day pass =
**الدخول اليومي** (NOT "تذكرة يومية": a session coined that and a native review
failed it), open desk = المكتب المرن, private office = حيّز / المكتب الخاص,
meeting room = الملقى, events hall = المعارج. Before writing new AR copy,
`str.count` the existing `ar.json` for the term you are about to use.

**Bulk-editing `messages/*.json`:** both files round-trip byte-identical via
python `json.dump(d, f, indent=2, ensure_ascii=False)` + trailing `\n`, so insert
many keys programmatically (assert each replacement hits exactly once), then
re-verify leaf-key path parity.
⚠️ **Two traps in that assert-once loop, and each costs a whole failed run.** A
SHORT value COLLIDES: `"private"` hit **27** times as a bare substring, so anchor
it to its key and search the literal `"protectSurtitle": "private"`. But a
key-anchored fragment must NOT go through `json.dumps(...)[1:-1]` the way a value
does, or it escapes the quotes and matches **0**. Escape values; pass
key-anchored fragments raw.

**Verifying copy:**

- **i18n keys drift silently when copy is regenerated** (especially via agents or
  workflows): keys get renamed or dropped. Validate the new `messages/*.json`
  keys against the components' `t("...")` keys, and against each other, before
  writing. Concretely: diff the two files' leaf-key PATHS (including array
  indices) with a quick node script, not by eye.
- **Arabic message values use Arabic-Indic numerals** (`٢٠٢٥`), so comparing
  en/ar *values* for parity false-fails. Compare key PATHS and array lengths,
  never values.
- 🔴 **`NextIntlClientProvider` serialises ALL ~30 namespaces into every page's
  HTML**, so grepping rendered output for a string false-positives on copy that
  is nowhere on screen. It twice "proved" removed content was still live in one
  session. Strip `<script>` blocks before searching
  (`re.sub(r'<script.*?</script>', '', h, flags=re.S)`), or check
  `messages/*.json` instead.
- **`grep` mangles Arabic in this shell** (matches one term, silently misses
  siblings). Verify Arabic in rendered HTML with `python3 -c` + `str.count`,
  never shell grep.
- 🔴 **Sweep a banned Arabic word by ROOT, never by whole word: the article
  FUSES to the noun.** `للأعضاء` does NOT contain `الأعضاء` (its article is
  `لل`, not `ال`), so the obvious checklist misses it with no error. Measured on
  HEAD's `ar.json` while retiring `عضو` (2026-07-31): **48** occurrences, of
  which `{عضو, الأعضاء, عضوية}` catches **39** and MISSES **9** (`للأعضاء` ×6,
  plus `لأعضاء`, `أعضاء`, `وأعضاؤه`). Sweep the consonant pair instead,
  `re.findall(r'\S*عض\S*', s)`, and read the distinct forms. ⚠️ Strip trailing
  punctuation before counting FORMS or that regex reports 20 where there are 12,
  because `للأعضاء`, `للأعضاء.` and `للأعضاء؟` arrive as three; the OCCURRENCE
  counts above are unaffected. It also returns unrelated words sharing the
  letters (`بعض` = "some", 4 here), which is the safe direction to be wrong in.
  ⚠️ **Write the ROOT into the RULE FILE too, not the surface form.** Banning
  `نابض` by whole word in `TONE.md` left `تنبض` (a verb form of the same root)
  live in a third string, caught only by an adversarial pass. A ban you cannot
  grep is a ban that gets broken, including by the pass that writes it.
- 🔴 **A before/after sweep must assert the NEW value is PRESENT, not only that
  the old one is GONE. Zero-of-both means you measured nothing.** A 16-route
  check reported "0 stale strings" and read as a clean pass; it was fetching a
  DIFFERENT app on another port (see `.claude.local.md`, which owns that trap),
  and the only tell was that the replacement strings scored 0 as well. Print
  both counts per route: a stale-only assertion cannot tell success from an
  empty page.
- 🔴 **A multi-word heading NEVER matches a grep of rendered HTML**, the opposite
  failure to the `NextIntlClientProvider` one above. `WordReveal` splits on `\n`
  then on whitespace, so `وتُولد الفرص` ships as two `.wr-word` spans with a tag
  between them and a search for the phrase returns **0**. It reads as "the
  heading is missing" and cost two false alarms in one session. Search a SINGLE
  word, or strip tags first (`re.sub(r'<[^>]+>','',block)`).
- 🔴 **One string often serves MANY keys, so a targeted copy edit LEAKS.**
  Measured 2026-07-29: **61** AR strings are shared across **165** keys.
  `المكتب المرن` is 6 keys (the space cards, the offers list,
  `SpaceCoworking.eyebrow`, `Booking.space.*`, a `/startups` form dropdown), and
  `الفعاليات` includes `Nav.events`. Before editing one heading, group
  `messages/ar.json` by VALUE and read the key list. Key-path parity will NOT
  catch this: the paths never change, only the shared value does.

## Cross-cutting gotchas

These bite anywhere in the tree. Layer-specific traps live in the scoped files.

**Working alongside other sessions**

- 🔴 **`git add <file>` sweeps that file's pre-existing uncommitted work into your
  commit.** Parallel sessions leave in-flight work in this tree (the 2026-07
  redesign sat uncommitted for days; an SEO workstream appeared mid-session), so
  run `git status` before staging and disclose before committing files carrying
  work you did not author. **To commit while another session is live, build the
  commit in a separate worktree** rather than staging in the shared tree:
  `git worktree add <tmp> -b <branch> HEAD`, reconstruct each shared file as HEAD
  plus only your own hunks, typecheck and build there, commit,
  `git worktree remove`. Commit `01dfd0e` is what happens otherwise: it swept a
  half-finished, broken file from another session into an unrelated feature
  commit.
- 🔴 **AN UNTRACKED FILE CANNOT COME BACK FROM GIT, AND MOST OF THE NEW WORK HERE
  IS UNTRACKED.** Measured 2026-07-30: **43** untracked files under `app/` and
  `test/`, **32** of them under `app/admin/` and `test/` alone. So `rm` on a `??`
  path is permanent, while `git rm` on a tracked one is not. Copy anything you are
  about to delete into the scratchpad first, and run `git ls-files <path>` to learn
  which kind you are holding. This is not hypothetical: deleting `/admin`'s
  dashboard on 2026-07-30 orphaned `test/admin-booking-lookup.test.ts`, which was
  the ONLY assertion behind a payment-link access check and had never been
  committed. ⚠️ `git rm` is also atomic (one untracked pathspec aborts the whole
  command, removing nothing) and refuses a locally-modified file without `-f`, so
  a delete can silently not happen at all.
- **Corollary: `git diff --stat` cannot show you your own edit here.**
  `messages/*.json` reads as ~440 changed lines when yours is 2, because the diff
  is against HEAD and the tree may carry another session's copy rewrite. Prove
  your own write instead: capture the file text before, and diff line indices
  after (`[i for i,(a,b) in enumerate(zip(before.splitlines(), out.splitlines())) if a!=b]`).
- 🔴 **A config-diff needs BOTH sides compiled at the same moment.** Proving "my
  `tailwind.config.ts` change did not touch the marketing site" means compiling
  HEAD's config and yours against identical content. A baseline generated even
  an hour earlier silently mixes another session's SOURCE drift into the result:
  measured 2026-07-29, a stale baseline reported `.text-9xl` and `.text-base` as
  config-caused when the real answer was two unreferenced `@keyframes`.
  Regenerate both back to back, and scope the content glob to the marketing tree
  only (`lib/` is NOT in the real globs; including it made `lib/utils.ts`'s own
  docblock examples compile into the probe).
- **A `tsc` error OR a failing TEST in a file you did not touch may be another
  session writing it right now.** Re-run before diagnosing, and don't "fix" it:
  you will collide with their in-flight edit. **Attribute before you diagnose**:
  `git status <path>` on the failing file, then re-run scoped
  (`npx vitest run test/ --exclude '<their file>'`). On 2026-07-28 a copy-only
  change appeared to break 24 tests; all 24 were a parallel session moving
  `resolveBranchId` into `rekaz/catalog.ts` without updating three `vi.mock`
  factories, plus making `app/sitemap.ts` async without awaiting it in
  `admin-surface.test.ts`. The suite also grew 294 → 344 between two consecutive
  runs, so even the test COUNT is not a stable baseline.
- **A leaf-key count that drops hard is probably not your deletion.** Removing 9
  keys took `messages/*.json` from 844 paths to 662. Attribute the gap before
  panicking: diff paths against `git show HEAD:messages/en.json` and bucket them,
  `Counter(k.split('.')[0] for k in gone)`. It was 224 `EventsPage` keys moving
  into Supabase, and exactly 9 of mine.
- 🔴 **A read-modify-write of `messages/*.json` can CLOBBER a concurrent
  session, and the loss is INVISIBLE**: the file stays valid JSON and en/ar
  parity still holds, so every check you would think to run still passes. The
  corollary above tells you how to see your own edit; this is the other
  direction. After writing, diff your before-snapshot against the result and
  assert that ONLY your namespaces moved. Verified live 2026-07-28: a parallel
  session rewrote `EventsPage.intro` inside this session's own edit window, and
  the only reason it was noticed was a leaf-key count that moved the wrong way.
- **A targeted Edit into a Markdown TABLE can be ORPHANED by a concurrent
  rewrite.** A row added to `server/CLAUDE.md`'s table applied cleanly and then
  sat below another session's newly-inserted prose, outside the table, rendering
  as a stray line. Re-read the region afterwards: "the edit applied" is not "the
  edit landed where you meant".
- **Format-on-save linter** rewrites Tailwind arbitrary values
  (`tracking-[-0.24px]`→`tracking-[0.05em]`, `text-11`→`text-12`) and can swap a
  heading to `WordReveal`, so a component may change on disk mid-task. Re-Read it
  before a dependent edit.
- After rapid edits the editor's inline TS diagnostics lag and show **phantom**
  errors (names from just-removed code). `tsc --noEmit` is the source of truth.
  The quickest tell is a **line number past EOF**: a diagnostic citing line 344
  of a 335-line file is stale by construction.
- 🔴 **Measure a "this is still handled over there" rationale before you write
  it. A false fallback is worse than no comment**, because the next reader stops
  checking. Deleting `/about`'s stat block, this repo gained a `TONE.md` line and
  a code comment both saying the four capacities "remain stated where a buyer
  needs them (the space pages, the FAQ, `AboutPage.spaceBody`)". An audit
  measured it: `spaceBody` states NONE of them, `"25"` appears in zero strings
  site-wide, and no string anywhere says how many private offices exist. The
  sentence was written from memory of what the copy MEANT rather than from a
  grep. **Every "X survives in Y" claim needs the count that proves it, in the
  comment.**
- **Adversarial verification is what catches that class of error.** A 13-agent
  audit of one session's own copy work returned 23 findings; an adversary told to
  REFUTE killed 12, and the 11 survivors included two real defects self-review
  had missed (the false rationale above, and a claim contradicted by another
  route one click away). Self-review found neither. This is the complement to the
  phantom-finding warning below: verify findings against the live file, AND
  verify your own confident sentences against a measurement.
- **Re-verify audit findings against the live DOM and the current file before
  fixing.** A 13-agent responsive audit measured a `fixed z-[9999]` MotionToggle
  that the on-disk code had already moved into footer flow. Long audits plus
  parallel-session edits mean a finding can describe a page that no longer exists
  (1 of 3 majors and ~5 minors were moot). One live probe (`elementFromPoint`, or
  a computed position) kills a phantom fix.
- ⚠️ **A capture subagent's NUMBERS can be right while its CLAIM is wrong. Check
  the two separately.** Both agents on 2026-07-30 did it: one called the
  6-tatweel kashida degrade "narrower" than the 5-run (HarfBuzz says **+51px
  WIDER**, and the agent's own comparison image agreed), and one called a video
  subject "a murky red smudge nobody would notice" when the before/after plainly
  showed him. Re-derive a NUMERIC claim a second way; LOOK at the artifact
  yourself for a QUALITATIVE one. Both errors survived careful, well-evidenced
  write-ups, which is exactly what made them persuasive.

**Tooling**

- ⚠️ **A workflow's `<failures>` block is NOT a count of lost work.** A verify
  run reported `agents_error: 22` of 60 while its own `log()` showed all **55**
  findings adjudicated (27 survivors + 28 refuted): the stalled agents were
  retried. Reconcile against the script's own `log()` before reporting a gap;
  quoting the failures list would have invented one.
- ⚠️ **A detached `( cmd1; cmd2 ) &` makes the background-task notification
  LIE.** The launcher returns immediately, the harness reports "completed, exit
  0", and the real work runs on for another 40 minutes. Poll for the artifacts
  it produces rather than trusting the notification, or don't detach.
- **Next 16 prints NO bundle sizes** (`next build` has no "First Load JS"
  column), so route weight has to be measured off the built output:
  `find .next/static -name '*.js' -exec ls -la {} \; | awk '{s+=$5} END {print s/1024}'`.
  ⚠️ Total JS can legitimately go UP after a `dynamic import()` split while the
  per-route INITIAL payload goes down; count the scripts a route's HTML actually
  references, not the whole directory.
- 🔴 **ONE LIGHTHOUSE RUN IS NOT A BASELINE, AND ON THIS SITE THE ERROR IS BIG
  ENOUGH TO INVENT A REGRESSION.** Measured 2026-07-31: `/en/about` scored **96**
  on the first baseline sweep, and re-running the SAME unchanged build three
  times gave **83, 78, 82**. The 96 was an outlier, and comparing an optimised
  build against it read as a 16-point regression that did not exist. The
  optimised build, by contrast, returned 80/80/80 with zero spread. **Take a
  median of 3 per route before claiming any delta**, and treat anything under
  ~5 points as noise. `npx --yes lighthouse@latest` works with the sandbox off;
  give each run its own `--user-data-dir` or they collide.
- ⚠️ **Lighthouse's default throttling is SIMULATED (Lantern), so the timings in
  `network-requests` are real localhost numbers while the metric is a model
  computed on top of them.** The two do not reconcile, and `lcp-breakdown-insight`
  summing to ~200ms while LCP reports 6.7s is expected, not a bug. Read the
  breakdown for WHICH phase dominates and the metric for the score; never
  subtract one from the other.
- ⚠️ **`cmd | tail -3; echo $?` reports TAIL's exit code, not the command's.** It
  reads as a clean run on a failing lint or build. Redirect to a file, capture
  `$?` on the next line, then grep the file.
- 🔴 **ESLint flat config does NOT merge two settings of the same rule.** For a
  file matched by both blocks the LAST one wins outright, so a narrower "allow"
  block added after `no-restricted-imports` silently DELETES the server boundary
  rather than relaxing it. A later block must RESTATE every pattern that still
  applies (`eslint.config.mjs` block 1b does, and says so). Verify with a probe
  file per direction, never by reading.
- **Browser capture routes:** Python Playwright works (`python3 -m playwright`,
  Chromium installed); `npx playwright` does NOT (root-owned npm cache blocks
  it). ⚠️ That failure is specific to Playwright, **not to npx**:
  `npx --yes <pkg>` runs fine with the sandbox OFF (`registry.npmjs.org` is not
  in the allowlist), verified with `npx --yes @google/design.md@latest`. Don't
  avoid npx wholesale. System `chrome --headless=new --screenshot` sometimes
  never exits after writing the file: poll for the file then kill, and give it a
  scratch `--user-data-dir`. Run it via Bash `run_in_background` and poll in a
  SECOND call; the task notification then reports **exit 143/144 "failed"**,
  which is only your own `pkill` landing and does NOT mean the capture failed.
  Judge it by the PNG, never by the exit code.
  `--force-prefers-reduced-motion` gets deterministic
  static captures without Playwright.
- **Playwright MCP** writes screenshots only **inside the repo root** (sandbox):
  save there, then move to the scratchpad. Flaky under contention ("Browser is
  already in use" from a stale lock); retry, or clear stale `Singleton*` in its
  `ms-playwright-mcp` cache (sandbox off).
- **Parallel curl sweeps over uncompiled dev routes can WEDGE next-server** (0%
  CPU, accepts TCP, never responds, even for already-compiled routes; only a kill
  plus `npm run dev` relaunch recovers). Warm routes sequentially before any
  parallel fetch or assertion sweep.
- 🔴 **`HTTP ERROR 431` on `localhost:3000` is the BROWSER, not the app.** Node's
  header ceiling is 16KB and an old localhost cookie jar exceeds it, so the request
  dies before Next runs. `curl` works (no cookies) while the browser fails, which
  reads exactly like a broken site and sends you hunting a fault that is not there.
  Fix: private window, or clear `localhost` cookies. Reproduce the 431 with
  `curl -H "Cookie: c=$(python3 -c "print('x'*20000)")" http://localhost:3000/en`.
- **The claude-in-chrome extension can report "not connected" when it is fine.**
  `list_connected_browsers` then `select_browser` recovers it; do not conclude the
  page is broken.
- **Review many images or frames in one Read** by tiling:
  `ffmpeg -pattern_type glob -i '*.jpg' -filter_complex "scale=W:H,tile=CxR" -frames:v 1 sheet.jpg`.
  `drawtext` isn't compiled into this ffmpeg build, so print a cell→file/timestamp
  legend instead of burning labels in. Uniform every cell to identical dims FIRST
  (`scale=W:H:force_original_aspect_ratio=increase,crop=W:H`) or the `%02d`/`tile`
  step errors `-22` on mixed-size inputs; `pad` rejects `-1` offsets (use
  `(ow-iw)/2`). For labeled or mixed-size sheets, PIL is far easier (see
  `.claude.local.md`).
- ⚠️ **Deleting a route leaves a stale type in `.next` that fails `tsc`.** Next
  generates `.next/types/validator.ts` referencing every route it has seen, so
  after removing one, `npm run typecheck` fails with
  `Cannot find module '../../app/<route>/route.js'`. It names a file you
  deliberately deleted and reads like a real error. **`rm -rf .next/types` is
  enough**, and unlike `rm -rf .next` it does not force a running dev server to
  rebuild everything, which matters when the server belongs to another session
  (verified 2026-07-30, after deleting a temporary admin route).
- ⚠️ **A `*/` inside a block comment ENDS it.** Writing a glob or a path like
  `/ar/spaces/*/book` in a JSDoc terminates the comment early and everything
  after it parses as code (`TS1443`, `Unterminated template literal`). Use prose
  or a single-line `//` comment instead. Scan with a regex for `*/` occurring
  inside a `/* ... */` block, not by reading.
- **A JSX comment cannot sit inside an attribute list**, nor as an element's
  *sibling inside a ternary consequent* (`{x ? (<comment/><ul/>) : …}` is two
  adjacent expressions with no wrapper). `{/* … */}` (and `//`) between props is a
  parse error (`TS1005`); put it above the whole expression. Broke the build
  three times.
- **`grep -c "<img"` counts JSDoc prose, not elements**: it reported 18 raw
  `<img>` tags when there are 16 (two hits are comments *describing* them).
  Filter to real JSX before quoting any element count in a finding.
- 🔴 **TAILWIND READS YOUR COMMENTS, AND ONE ARBITRARY VALUE WRITTEN IN PROSE
  TAKES THE WHOLE SITE DOWN.** `content` in `tailwind.config.ts` is
  `./app/**` + `./components/**`, and the JIT extracts class-like tokens from
  RAW TEXT: it cannot tell a JSDoc paragraph from markup. A new
  `components/admin/Field.tsx` explained itself with the phrase "rather than a
  `bg-[url(...)]` arbitrary value", Tailwind compiled a real
  `background-image: url(...)` rule into `globals.css`, and Turbopack tried to
  resolve `...` as a MODULE. Result: **every route answered 500**, including the
  landing page and all eight booking routes.
  - **The error names the wrong file, by a mile.** It reads
    `./app/globals.css:1828 Module not found: Can't resolve '...'` and quotes
    generated CSS, so it presents as a stylesheet defect with no connection to
    the comment that caused it. `npm run lint` and `tsc --noEmit` both pass
    clean, because nothing is wrong with any TypeScript.
  - **Find it with a fixed-string grep** over the two content roots
    (`grep -rF 'url(...)' app/ components/`), not by reading the CSS.
  - ⚠️ **Fixing the source is not enough: Turbopack caches the failure.** The
    error stayed byte-identical, line numbers and all, after the token was
    removed and `globals.css` was touched. It took `rm -rf .next` plus a dev
    restart. So a stale identical error is not evidence your fix failed.
  - **The rule:** never spell a Tailwind arbitrary value in prose under `app/`
    or `components/`. Say "a Tailwind arbitrary background-image value" instead.
    Breaking the token with a Unicode ellipsis does NOT work either, it just
    generates a different unresolvable URL.
  - ✅ **MARKDOWN IS EXEMPT, and that is why the scoped docs may quote classes.**
    The globs are `./app/**/*.{js,ts,jsx,tsx,mdx}` and the same for
    `components/`, so a `.md` file inside those trees is never scanned:
    `app/CLAUDE.md` naming `max-w-[1120px]` and `components/CLAUDE.md` naming
    dozens of arbitrary values are all safe. Verified against the config
    2026-07-30. The rule above binds **code comments**, not these files. ⚠️ Note
    `.mdx` IS scanned; only `.md` is out.
- 🔴 **zsh globs `[locale]` in a PATH ARGUMENT**, not only in flag values:
  `find app/[locale]/spaces/_lib` dies with `no matches found`. Quote any path
  carrying the route group: `find "app/[locale]/..."`. It is the commonest path
  shape in this repo.
- **`npx vitest run <path>` reports "No test files found" for a path outside
  `include`** (`server/**/*.test.ts`, `test/**/*.test.ts`, in `vitest.config.ts`).
  A scratch test at the repo root silently matches nothing: put it in `test/`.
- **There is NO DOM test environment.** `vitest.config.ts` is
  `environment: "node"` and neither jsdom, happy-dom nor testing-library is
  installed, so a client component's BEHAVIOUR cannot be tested, only its pure
  helpers. Adding one churns the lockfile in a tree that usually carries another
  session's work. Verify in a browser instead, and say in the report that it was
  not machine-verified.
- ⚠️ **A temporary `return` at the top of a function makes `tsc` report a BOGUS
  error further down**, because TypeScript drops narrowing in unreachable code. A
  probe in `ticketStock` produced `'stock' is possibly 'null'` on a line that had
  just typechecked clean, and it reads as a real defect. Gate probes on an env
  var so the code stays reachable, which also lets ONE build serve several cases.
- 🔴 **Literal control characters cannot go in a `.ts` file or a Bash command.**
  A literal NUL or ESC byte in source is a hard ESLint parse error
  (`Unexpected keyword or identifier`), and the Bash tool refuses a command
  containing one. Write `\u0000`-style escapes in source, and build such test inputs
  with `chr(0)` in Python.
  ⚠️ And to WRITE such an escape INTO source, build it from CODE POINTS
  (`"\\u%04x" % n` in Python) rather than typing it: emitting `\u0000` directly
  can produce the real byte, which Bash then refuses ("command contains
  control characters") and Edit cannot match. Cost three blocked calls
  2026-07-28, and the damaged character class rendered as three visible
  dashes that silently stripped nothing.
- **A Next dev 500 hides its real error in the HTML body.** When every route
  500s while `lint` and `tsc` pass clean, it is a CSS/asset COMPILE error, not
  code: `curl -s localhost:3000/en` then
  `re.findall(r'"message":"(.*?)","stack"', html)`. Reading the rendered page
  tells you nothing, and the symptom you notice first (e.g. "all booking routes
  are down") points at the wrong subsystem.
- **To read live Rekaz catalog state, curl your own booking page rather than
  scripting the API.** `/en/spaces/<space>/book` renders real prices in Rekaz's
  own `order`, and the DEFAULT variant is `aria-pressed="true"` on card 0. That
  is how "both products default to One day" was established. No credential
  handling, so it sidesteps the classifier refusal below.
- 🔴 **Hand-rolled API calls that read `.env.local` are refused by the permission
  classifier.** A script reading a credential from that file and POSTing or
  PATCHing an external API was blocked twice in one session (bulk env upload to
  `api.vercel.com`, auth config to `api.supabase.com`). A *read* with the same
  token was allowed, so it is the write that trips it. Use the vendor's own CLI,
  which is the sanctioned tool and passes:
  `printf '%s' "$val" | vercel env add NAME production`. ⚠️ A denial also tends
  to refuse the next command or two including harmless ones (`vercel ls` right
  after), so verify with a plain `curl` against the live site rather than
  concluding the CLI broke.

**Dead code, so grep hits there are not live**

- `components/Proof.tsx` and `components/MotionToggle.tsx` are mounted on **no**
  route. Don't spend edits there. See `components/CLAUDE.md` for why MotionToggle
  was unmounted and why it must not be re-added from an audit.
- **Dead KEYS exist too, and a message file gives no hint.** `Hero.trustLine` has
  **zero** code references repo-wide (verified 2026-07-31) while both files still
  carry it: the hero renders the three `SpaceFinder` chips instead. Same for
  `Proof.legitimacy[*]`, since `Proof` is unmounted. Correcting a fact in either
  is right, but it ships nothing, so don't cite one as evidence a claim is live.
- `components/admin/RevealedSecret.tsx` (and its `RevealButton`) joined them on
  2026-07-30: its only caller was `/admin`'s deleted booking lookup. It is kept
  because it is this repo's one correct rendering of a bearer capability, and
  `test/admin-page-guards.test.ts` still pins its no-anchor rule. 🔴 Bringing it
  back means WRITING ITS TEST AGAIN FROM SCRATCH. `test/admin-booking-lookup.test.ts`
  was deleted with the feature and the owner confirmed on 2026-07-31 that it
  should not be kept, so no copy exists anywhere. It was the only assertion
  behind the reveal's entire access check, and `RevealedSecret`'s own docblock
  now records the two properties it pinned, which is the part that mattered.
- In `server/`, `fetchAllReservations`, `fetchAllSubscriptions` and
  `bookableRooms` lost their last production caller in the same change, as did
  `bookingsByMobile` and `getBookingPaymentLink` in `server/db/bookings.ts`. All
  five are still exercised by tests and still documented in
  `docs/rekaz-api-findings.md`, so they are reference material, not live paths.
