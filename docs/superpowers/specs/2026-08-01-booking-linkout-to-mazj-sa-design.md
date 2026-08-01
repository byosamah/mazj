# Booking links back out to mazj.sa (temporary)

**Date:** 2026-08-01
**Status:** built, verified, on `main`
**Owner decision:** yes, this session
**Revert target:** branch `feature/onsite-booking` (= `main` at `e139159`)

## Why

Rekaz's API is not fit to take bookings right now. Until they fix it, no buyer
should reach the on-site booking flow. Every Book control on the site sends the
buyer to the product's own page on the mazj.sa storefront instead, in a new tab,
in their own language.

This is **temporary and reversible by design**. Nothing is deleted. The whole
on-site booking stack (`app/[locale]/spaces/*/book/`, `components/booking/`,
`server/services/booking.ts`, `server/rekaz/booking.ts`) is untouched on disk.

## The four owner decisions this was built on

1. **Today's `main` is parked on `feature/onsite-booking`; the temporary change
   goes ON `main`**, so it is what deploys to production. Restoring on-site
   booking is a revert of one commit, or a merge of the keeper branch.
2. **Buttons AND routes.** The Book controls link out, and the four
   `/spaces/<space>/book` routes redirect out, so a bookmark, a shared link or a
   search result cannot reach the broken flow either.
3. **Bare `mazj.sa`, not `www`.** Verified live: both resolve to the same
   Cloudflare addresses and all eight product pages answer 200, but
   `www.mazj.sa/<path>` 301s to the bare host every time. `www` buys nothing and
   costs a round trip on the last click before payment.
4. **The store link matches the visitor's locale.** EN reader → `mazj.sa/en/…`,
   AR reader → `mazj.sa/ar/…`.
   ⚠️ Known and accepted: the store's English pages carry English chrome but
   **Arabic product names**, because Rekaz holds no English content for this
   tenant. That is upstream, not caused by this change.

### 🔴 Correction, same day: "zero copy changes" was a DEFECT, not a virtue

The first version of this record listed "no copy changes, no message files
edited" as a benefit. That was wrong, and an adversarial verification pass caught
it. Moving booking off-site **falsified copy that was true that morning**, most
sharply `SpaceOffice.faq[3].a`: *"You book and pay right here"* / *"تحجز وتدفع من
هنا"*, sitting on the very page whose button now leaves the site.

`TONE.md` had already recorded this exact trap in the OPPOSITE direction on
2026-07-27 (links moved on-site while buttons still read "Book on mazj.sa"). It
has now happened twice, in mirror image, so it is recorded there as a law rather
than an incident: **changing a link does not change the sentence around it, in
either direction.**

Fixed the same day, owner decision "the flatly false ones only": two keys ×
two languages, all four **pure deletions** per `TONE.md`'s standing rule that the
location is simply deleted rather than reworded.

| key | was | now |
|---|---|---|
| `SpaceOffice.faq[3].a` | "You book and pay **right here**, by card or split payments…" | "You book and pay by card, or split payments…" |
| `SpacesPage.intro` | "…and finish your booking **right here**." | "…and finish your booking." |

⚠️ **Roughly seven more strings per language still over-claim and were
deliberately left** (same owner decision). They stretch rather than lie: two
"booked right here" day-pass answers, three "the live price is shown as you
book" lines, and `TermsPage.sections[3]` / `PrivacyPage.sections[1]` saying
spaces are booked "on our website". 🔴 The last two are LEGAL copy and must be
re-read before any launch.

**Explicitly NOT done, owner amendment:** `lib/schema.ts` is unchanged. The
JSON-LD `Offer` urls still name the on-site `/spaces/<space>/book` page rather
than the store. Those URLs now 307 outward, so the structured data resolves to
the right place with one hop, and the site is `noindex` on its current origin
anyway. Leaving it alone also keeps the revert smaller.

## Design

### One function, one source of truth

`lib/links.ts` gains `bookingUrl(space, locale)`. It builds the store URL by
**inverting `LEGACY_STORE_PATHS`**, which already held the four Rekaz slugs, so
a slug is spelled exactly once in the file and the two maps cannot drift.

`BOOKING` is left completely unedited. It is no longer linked from anywhere, but
it is still the canonical list of which `/book` routes exist: `bookingUrl()`
keys off it and the redirect rules are built from it. Editing it would turn the
revert into a rewrite.

### Call sites

`CtaButton` already opens any `http(s)` href in a new tab with
`rel="noopener noreferrer"`, so most call sites changed by swapping the value
alone. The pattern in each was the same: a module-scope constant holding a
ready-made `href` became a `space` key, because a store URL depends on the
visitor's locale and a module constant cannot know it.

| File | Change |
|---|---|
| `components/Hero.tsx` | `Link` → raw `<a target="_blank" rel="noopener noreferrer">`; `useLocale()` now yields `locale`, not just `rtl` |
| `components/SpacesGrid.tsx` | `CARDS[].href` → `CARDS[].space` |
| `components/SpaceOffers.tsx` | `OFFERS[].href` → `OFFERS[].space` (kept separate from `id`: `eventHall` there is `event` in links) |
| `components/StepInto.tsx` | day-pass CTA |
| 4 × `app/[locale]/spaces/*/page.tsx` | `SpaceDetail` cta href |

🔴 `Hero.tsx` is the one that is not a `CtaButton`. Its pill is hand-written, so
it carries `target`/`rel` itself. It was exactly this markup until 2026-07-29,
became a same-tab `Link` when booking moved on-site, and is back now. The rule
underneath all three states: **the markup must match where the href points.**

### Redirects

Eight new rules in `next.config.mjs`, four bare and four locale-prefixed.

🔴 **`permanent: false` (307), never 308.** A permanent redirect is cached by
browsers and by Google indefinitely, so it would **survive the revert**:
customers would keep being thrown to mazj.sa long after on-site booking returned,
and no deploy could call them back. A temporary move must declare itself
temporary.

⚠️ The bare, locale-less form needs its own rule and defaults to `/en`.
`redirects()` runs **before** middleware in Next's routing order, so next-intl
never gets to add a prefix first.

### 🔴 The loop, and why eight rules were deleted

`next.config.mjs` previously held eight rules pointing the **other** way:
mazj.sa store path → our `/book` page. Adding the outbound rules while those
existed is an infinite bounce the day this app serves `mazj.sa`: their rule sends
the buyer in, ours sends them straight back out, and the browser gives up with
`ERR_TOO_MANY_REDIRECTS` **on the revenue path**.

So they were removed in the same commit. On this branch they had no job anyway:
their entire purpose was "old store links must reach our new on-site booking",
and on this branch there is no on-site booking.

**Both directions is never correct.** Restoring them is right only in the same
commit that removes the outbound ones. `test/booking-links.test.ts` asserts their
absence so nobody can reintroduce them from a diff.

⚠️ **Cost, accepted:** a request to `/en/subscription/private-office` on *this*
app now renders a branded 404 instead of redirecting inward. That only matters
in a world where `mazj.sa` serves this app, which is the documented launch
blocker (root `CLAUDE.md`, launch item 4) and not today's world. It is the
correct trade while the store owns that domain.

## What pins it

`test/booking-links.test.ts` was rewritten. 12 tests:

- all eight finished URLs, written out **literally** (a derived map is only as
  readable as its expected output, and a literal table is what catches an
  inversion that pairs the wrong slug to the wrong space)
- every space covered, none invented
- the locale is always written in; an unrecognised locale resolves to `en` rather
  than emitting `/undefined/`
- the origin agrees with `server/rekaz/store.ts`'s `REKAZ_STORE_ORIGIN`
  (cross-boundary sync test, per `server/CLAUDE.md`)
- the bare host, not `www`
- `BOOKING` still holds internal paths, so the revert stays a revert
- all four routes redirected in **both** shapes
- 🔴 every rule is `permanent: false`
- 🔴 the inbound store rules are **gone**

🔴 **Reverting the code without reverting this test leaves a suite that fails
green**: it would still be asserting that booking links leave the site. The
pre-change version is on `feature/onsite-booking`.

## Verification performed

- `npm run lint` → exit 0
- `npx tsc --noEmit` → exit 0
- `npm run test` → **578 passed, 1 failed**. The failure is
  `test/rekaz.integration.test.ts > offers the one-time ticket products`, a
  pre-existing canary: MAZJ currently has **no ticketable event product** in
  Rekaz. Attributed, not assumed: the Rekaz credential is live
  (`npm run check:rekaz` ✅) and that test imports none of the eleven changed
  files.
- **All 12 redirect shapes** curl'd against the dev server: 4 bare → `/en/`
  store pages, 4 `/en/` → `mazj.sa/en/`, 4 `/ar/` → `mazj.sa/ar/`, every one a
  307.
- **Loop guard confirmed live**: all eight old inbound store paths no longer
  redirect into the site.
- **12 routes' rendered HTML** (both locales × landing, `/spaces`, 4 detail
  pages), with `<script>` blocks stripped so `NextIntlClientProvider`'s
  serialised namespaces cannot false-positive:
  **26 store links, 0 stale `/book` links, 0 wrong-locale links, 26/26 anchors
  carrying `target="_blank"` + `rel="noopener"`, exactly 8 distinct
  destinations.** Both counts printed, because a stale-only assertion cannot
  tell success from an empty page.
- **Hero pill verified in a browser**, because its `<a>` only exists after a
  client-side selection and static HTML cannot see it.

## Post-deploy verification: are the destinations actually right?

A 200 proves a page exists, not that it sells the right thing. Closed 2026-08-01
with 16 live fetches plus a 13-agent adversarial pass (4 matchers, 8 refuters on
two lenses each, 1 completeness critic).

**Result: 4/4 products matched, high confidence, 0 of 8 adversaries refuted.**
The strongest evidence was not name-matching:

- The meeting room's Rekaz product id in the storefront's own payload
  (`3a14b646-4fa3-7c31-ddce-d7302c01403f`) is **byte-identical** to the id
  recorded in `docs/rekaz-api-findings.md` from live API probes.
- The store's coworking featured image correlates with our
  `public/images/spaces/day-desk.jpg` at Pearson **1.000** (four controls scored
  −0.149 to 0.012). Same photograph, so same room.

**`www.mazj.sa` is equivalent and slower.** All 8 paths on both hosts answer 200;
`www` 301s to the bare host in exactly 1 hop and returns **byte-identical**
response sizes. Its TLS cert's SAN covers both names (the bare cert covers only
`mazj.sa`). Hence the bare host in `STORE_ORIGIN`.

⚠️ **The JSON-LD `price` is ONE VARIANT, not the price.** Coworking publishes
`10080.00` (the annual) while the page's entry rate is 90/day; the private office
publishes `510.00` against 170/day. Never quote a store JSON-LD figure as "the
price", and note a price-aware surface (a Google rich result, an AI answer) will.

### Store-side findings, NOT fixable in this repo

Owner informed, no document requested (2026-08-01). Recorded so they are not
rediscovered:

1. 🔴 **Tabby is enabled at checkout on a SANDBOX key.** `pk_test_fd66015f-…`
   appears on all 16 captured pages and is the store's ONLY test key, beside
   Moyasar's `pk_live_`. Our copy names Tabby in 4 strings per language (hedged
   "where available"). Pre-existing; payment always went to Rekaz.
2. 🔴 **The store's coworking product advertises FINGERPRINT entry, 13 times**
   (`بصمة`), including a first-visit enrolment precondition. Our own copy says it
   **zero** times, stripped site-wide 2026-07-23 as PDPL-sensitive. ⚠️ **This
   change is what exposes it**: buyers previously booked on-site and never read
   that description.
3. 🔴 **The private-office store page never mentions the 20% meeting-room
   discount**, which our copy promises in 10 strings per language (`خصم`, `20%`
   and `الملقى` all count zero there, while the sibling coworking product DOES
   document its 15% perk). Rekaz has no coupon API, so a person honours it.

⚠️ **One adversarial finding was REFUTED by measurement, recorded so it is not
re-raised:** an agent reported a "cancellation expectation gap", claiming our
copy implies flexibility against the store's no-refund policy. It does not.
`Faq.groups[1].items[3].a` says *"it stays non-refundable once it's placed"* and
`TermsPage.sections[4]` says it again. The agent had read only the space page's
own FAQ.

### The checkout walkthrough, 2026-08-01

Four agents drove the live store in a real browser, one product each, both
locales, **deliberately stopping before any server write**. 🔴 `wroteAnything`
came back **false** on all four: no form submitted, no order or reservation
created, no card entered.

⚠️ **One honest caveat:** the storefront fires `POST /api/app/cart/new-cart` by
itself on every page load, 1 to 3 times, before anyone clicks. That happens to
any member of the public opening the page. It leaves empty anonymous carts with
no product, no date and no customer. Nothing holds a room.

**Result: the buy path is healthy up to the last click, and about 30 API calls
across four products and two locales returned zero failures.**

🔴 **The premise this test was built on was WRONG, in the useful direction.** The
worry was a lazily-fetched availability call a healthy page could hide. It is not
lazy: `GET /api/app/reservation-v2/availabilities` fires on plain **page load**
and returns a whole month. So the earlier "page returns 200" evidence was
stronger than anyone credited, and picking a date fires no request at all.

- Meeting room: **276 real bookable hours across 23 days**, all free, 110 SAR,
  Sun-Thu 09:00-21:00, Fri/Sat correctly absent.
- Events hall: **373 slots**, all free.
- Both subscription products have a Start Date control that fires **zero**
  network calls and applies **no** availability or capacity gating.
- Arabic is a real mirror on all four: RTL, Arabic month names, correctly
  Gregorian (no Hijri leak).

### 🔴 Store-side defects found by the walkthrough

Ranked by money. Re-derived independently where numeric, per this repo's rule.

1. 🔴 **NOTHING IS BOOKABLE AFTER 31 DECEMBER 2026.** Measured month by month
   against the availabilities endpoint, both rooms: Aug 276/373, Sep 288/386,
   Oct 276/390, Nov 276/392, Dec 276/379, then **Jan 2027 onward returns zero**,
   confirmed through Jun 2027. That is a five-month horizon as of today and it
   shrinks by one month every month. Anyone planning an event further out is
   told there is nothing. Almost certainly a Rekaz calendar setting.
2. 🔴 **An English buyer cannot book the events hall.** After picking a time, a
   required three-question form appears whose labels are **Arabic only**
   (`وصف الفعالية`, plus a commercial-registration upload) while the chrome
   around it is English. Verified by eye in
   `scratchpad/checkout/event-en-05-slot-picked.png`. This is the highest-value
   product on the store (690-1,550 SAR).
3. 🔴 **Both instalment options run on bad credentials.** Tabby's quote is sent
   with `pk_test_…` on the live store and Tamara logs `Invalid public key` on
   **every** page load, while both are advertised in large type on every
   product. Split payment is a major conversion lever in Saudi.
4. ⚠️ **A failed add-to-cart discards everything** (date, time, typed answers)
   and returns the buyer to step one showing English "An error occurred" even on
   the Arabic site. One network blip is one lost sale with no retry.
5. ⚠️ **`mazj.sa` soft-404s: HTTP 200 on every nonexistent URL**, serving a 404
   page inside a success response. Independently confirmed on `/en/cart`,
   `/en/checkout` and two nonsense paths. Matters at the domain move: Google can
   index unlimited junk.
6. ⚠️ No money attached: the pricing call ships custom-field answers as the
   literal string `[object Object]`; the calendar covers the first two variant
   cards while open; Arabic weekday headers collide as `خميسجمعة`.

✅ **Useful for the launch plan:** the storefront makes **no** calls to
`mazj.sa` at all. Every request goes to `platform.rekaz.io`, the same host our
own code already uses. So pointing `mazj.sa` at Vercel breaks the store's
**pages**, not its data layer. That is the blocker already recorded in root
`CLAUDE.md` launch item 4, not a new one.

**Still unverified, and it cannot be closed for free:** the customer form, order
creation and the payment hand-off. On all four products "add to cart" is a
server write (`POST /api/app/cart/cart-items/<cartId>` carrying the date and
time), and `/cart`, `/checkout` and `/orders` all render "page not found", so
the form only exists after that write. Closing it costs exactly one deliberate
throwaway booking on the live calendar, cancelled by hand, and needs the owner's
say-so.

## Undoing this

```
git revert <the temp commit>          # or: git merge feature/onsite-booking
```

Then, before deploying: confirm `test/booking-links.test.ts` came back with it,
and confirm the eight `LEGACY_STORE_PATHS` rules returned to `next.config.mjs`
**in the same commit** that removed the outbound ones.
