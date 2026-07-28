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

**Why it is split this way.** Claude Code loads this root file into every
session, but a `CLAUDE.md` inside a directory loads only when you actually work
in that directory. So a backend session does not pay for ~48KB of Arabic-clipping
rules, and a copy session does not pay for the migration mechanics. Keep it that
way: when you learn something new, put it in the **narrowest** file that covers
it, and only put it here if it genuinely bites everywhere.

`DESIGN.md` = how it LOOKS. `TONE.md` = how it SOUNDS. The `CLAUDE.md` files =
how it is BUILT (mechanics, gotchas, verification recipes).

## Project

**MAZJ (مزج)** is a bilingual (English + Arabic) marketing site built with
**Next.js 16** (App Router, Turbopack), **React 19**, **Tailwind CSS 3** and
**GSAP**, with a **Supabase** backend added 2026-07-27.

It is a pixel-faithful animated multi-page site: home plus `/about` `/contact`
`/events` `/faq` `/privacy` `/spaces` `/terms`, plus the four space-detail routes
`/spaces/{coworking,private-office,meeting-room,event-hall}`, all under
`app/[locale]/`. That is 12 route groups x 2 locales = 24 prerendered pages, with
`app/[locale]/[...rest]` catching everything else and rendering on demand. Since
2026-07-27 each space also has a `/book` child (4 routes x 2 locales, rendered on
demand) where booking happens against the Rekaz API.
`/pricing`→`/spaces` and `/community`→`/about` are redirects in
`next.config.mjs`. Routes are locale-prefixed: `/en` (LTR) and `/ar` (RTL).
English is the default; `/` redirects to `/en`.

Since 2026-07-27 there is also **`/admin`**, an English-only internal tool with
its own root layout, deliberately **outside** the locale system: no locale
prefix, no hreflang, no sitemap entry, `Disallow` in robots.txt. Sign-in is a
Supabase magic link restricted to `@mazj.org` by three independent gates. It
shows live Rekaz operations. See [`app/CLAUDE.md`](./app/CLAUDE.md) for the
routing and [`server/CLAUDE.md`](./server/CLAUDE.md) for the gates.

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
  staffed hours, 24/7 member access, VAT).
- Space access is QR code / card via Rekaz, **non-biometric**. "24/7" is
  **members only**; the team is staffed Sun-Thu 9-9. 🔴 Never re-introduce
  "fingerprint" or biometric copy (stripped site-wide 2026-07-23: biometric data
  is PDPL-sensitive and implies a controller registration MAZJ avoids).

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
3. **Two domains serving identical content is duplicate content.** `lib/site.ts`
   holds exactly ONE origin behind every canonical, hreflang, `og:url`, sitemap
   `<loc>` and JSON-LD `@id`, which is correct: **pick one primary** and have the
   secondary 301 to it, or serve cross-domain canonicals pointing at the primary.
   Do NOT let both resolve 200 with self-canonicals.
4. **Which domain is primary is an SEO decision, not a preference.** mazj.org
   holds the Arabic ranking equity (#1-3 on head terms); mazj.sa is the
   commercial domain and matches the brand's country. Whichever is secondary must
   301, not merely redirect in the browser, or that equity is lost. The existing
   `docs/mazj-org-301-redirect-map.md` assumes mazj.org is retired; re-read it
   against whatever is decided.

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build. See the two gates below. |
| `npm start` | Serve the production build |
| `npm run lint` / `lint:fix` | ESLint 9 flat config (`eslint.config.mjs`, `eslint-config-next/core-web-vitals`). Next 16 removed `next lint`; the script is plain `eslint .`. Currently exits 0 (the long-standing `react-hooks/set-state-in-effect` error in `Hero.tsx` is fixed), so any error you see is yours. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:watch` | Vitest. 294 tests: 11 RLS integration tests plus 12 Rekaz integration tests against the LIVE production tenant (read-only), all of which skip without credentials. 🔴 Needs the sandbox OFF, see below. |
| `npm run verify` | lint + typecheck + test, the pre-commit sweep |
| `npm run check:env` | Validates backend config without starting the app |
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
- **Corollary: `git diff --stat` cannot show you your own edit here.**
  `messages/*.json` reads as ~440 changed lines when yours is 2, because the diff
  is against HEAD and the tree may carry another session's copy rewrite. Prove
  your own write instead: capture the file text before, and diff line indices
  after (`[i for i,(a,b) in enumerate(zip(before.splitlines(), out.splitlines())) if a!=b]`).
- **A `tsc` error in a file you did not touch may be another session writing it
  right now.** Re-run before diagnosing, and don't "fix" it: you will collide
  with their in-flight edit.
- **Format-on-save linter** rewrites Tailwind arbitrary values
  (`tracking-[-0.24px]`→`tracking-[0.05em]`, `text-11`→`text-12`) and can swap a
  heading to `WordReveal`, so a component may change on disk mid-task. Re-Read it
  before a dependent edit.
- After rapid edits the editor's inline TS diagnostics lag and show **phantom**
  errors (names from just-removed code). `tsc --noEmit` is the source of truth.
- **Re-verify audit findings against the live DOM and the current file before
  fixing.** A 13-agent responsive audit measured a `fixed z-[9999]` MotionToggle
  that the on-disk code had already moved into footer flow. Long audits plus
  parallel-session edits mean a finding can describe a page that no longer exists
  (1 of 3 majors and ~5 minors were moot). One live probe (`elementFromPoint`, or
  a computed position) kills a phantom fix.

**Tooling**

- **Browser capture routes:** Python Playwright works (`python3 -m playwright`,
  Chromium installed); `npx playwright` does NOT (root-owned npm cache blocks
  it). ⚠️ That failure is specific to Playwright, **not to npx**:
  `npx --yes <pkg>` runs fine with the sandbox OFF (`registry.npmjs.org` is not
  in the allowlist), verified with `npx --yes @google/design.md@latest`. Don't
  avoid npx wholesale. System `chrome --headless=new --screenshot` sometimes
  never exits after writing the file: poll for the file then kill, and give it a
  scratch `--user-data-dir`. `--force-prefers-reduced-motion` gets deterministic
  static captures without Playwright.
- **Playwright MCP** writes screenshots only **inside the repo root** (sandbox):
  save there, then move to the scratchpad. Flaky under contention ("Browser is
  already in use" from a stale lock); retry, or clear stale `Singleton*` in its
  `ms-playwright-mcp` cache (sandbox off).
- **Parallel curl sweeps over uncompiled dev routes can WEDGE next-server** (0%
  CPU, accepts TCP, never responds, even for already-compiled routes; only a kill
  plus `npm run dev` relaunch recovers). Warm routes sequentially before any
  parallel fetch or assertion sweep.
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
  deliberately deleted and reads like a real error. `rm -rf .next` clears it.
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
- 🔴 **Literal control characters cannot go in a `.ts` file or a Bash command.**
  A literal NUL or ESC byte in source is a hard ESLint parse error
  (`Unexpected keyword or identifier`), and the Bash tool refuses a command
  containing one. Write `\u0000`-style escapes in source, and build such test inputs
  with `chr(0)` in Python.

**Dead code, so grep hits there are not live**

- `components/Proof.tsx` and `components/MotionToggle.tsx` are mounted on **no**
  route. Don't spend edits there. See `components/CLAUDE.md` for why MotionToggle
  was unmounted and why it must not be re-added from an audit.
