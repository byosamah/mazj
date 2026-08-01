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

## Undoing this

```
git revert <the temp commit>          # or: git merge feature/onsite-booking
```

Then, before deploying: confirm `test/booking-links.test.ts` came back with it,
and confirm the eight `LEGACY_STORE_PATHS` rules returned to `next.config.mjs`
**in the same commit** that removed the outbound ones.
