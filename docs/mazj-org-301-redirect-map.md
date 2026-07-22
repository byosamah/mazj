# mazj.org → new site — 301 redirect map

**Purpose.** mazj.org is a live 2021 WordPress site and the **only organic ranking equity MAZJ owns**: under Saudi geolocation it holds #1–#3 in Arabic for the head category terms (`مساحة عمل مشتركة في الخبر`, `مساحات عمل المنطقة الشرقية`). When the new site replaces it, every old URL must 301 to its new equivalent, or that position is stranded or cannibalized. This document is the map to apply **at launch**.

## The one decision baked into every row: everything targets `/ar`

mazj.org is `lang="ar" dir="rtl"` on every page (verified). Its ranking equity is **Arabic**. So:

- The homepage 301s to **`/ar`**, not `/`. The new site's `/` 307-redirects to `/en` (English default) — if the old Arabic homepage pointed there, every Arabic searcher who clicks the #1 result would land on English, and the equity that took years to build would transfer to the wrong locale.
- Every content page targets its `/ar/*` route for the same reason.

If MAZJ later wants English-default even on this domain, that is a separate decision; for preserving what actually ranks, Arabic targets are correct.

---

## 🔴 Do this NOW, before launch (independent of the redirects)

The redirects below can only fire once the new site is served at mazj.org. Until then, one thing on the old site is actively costing you:

- **`mazj.org/home-2/`** is a live, self-canonicalizing **duplicate homepage** (HTTP 200) sitting directly beneath the page that ranks. In WordPress, set it to `noindex` (Yoast/RankMath → the page → Advanced → "noindex") or trash it today. It cannibalizes the ranking homepage every day it stays indexed.

---

## The map (all 25 sitemap URLs, tiered)

**Tier 1 — carries the equity. Verify these individually at launch.**

| Old mazj.org URL | Decoded | → New | Why |
|---|---|---|---|
| `/` | home | **`/ar`** | Ranks #1–3 in Arabic. Land on `/ar`, never `/`. |
| `/عن-مزج/` | About MAZJ | `/ar/about` | Direct equivalent |
| `/الفعاليات/` | Events | `/ar/events` | Direct equivalent |
| `/faq/` | FAQ | `/ar/faq` | Direct equivalent |
| `/contactus/` | Contact | `/ar/contact` | Direct equivalent |
| `/terms/` | Terms | `/ar/terms` | Direct equivalent |
| `/home-2/` | duplicate home | `/ar` | Collapse the duplicate into the real home |

**Tier 2 — real content, no 1:1 page; fold into the nearest hub.**

| Old URL | Decoded | → New | Why |
|---|---|---|---|
| `/services/` | Services | `/ar/spaces` | "Services" = the four spaces |
| `/booking/` | Booking | `/ar/spaces` | Old booking flow → the chooser (which links out per-space to mazj.sa) |
| `/bk/` | booking shortlink | `/ar/spaces` | → chooser |
| `/reservation/` | Reservation | `/ar/spaces` | → chooser |
| `/tour/` | Book a tour | `/ar/contact` | New tour flow is WhatsApp on `/contact` |
| `/workshops/` | Workshops | `/ar/events` | → events |
| `/programs/` | Programs | `/ar/events` | → events |
| `/قهوة-وسكيتش/` | Coffee & Sketch | `/ar/events` | Recurring series → events archive |
| `/لقمة-وفايدة/` | Loqma w Fayda | `/ar/events` | Series → events |
| `/نساء-يصممن/` | Women Design | `/ar/events` | Series → events |
| `/my-account/` | Woo account | `https://mazj.sa` | Accounts/checkout live on the store |

**Tier 3 — WordPress taxonomy/author cruft. Hygiene only (prevent 404s); negligible equity.**

| Old URL | Decoded | → New |
|---|---|---|
| `/category/الفعاليات/` | events category | `/ar/events` |
| `/event-type/ورشة-عمل/` | workshop taxonomy | `/ar/events` |
| `/slide-types/المساحات/` | spaces slider taxonomy | `/ar/spaces` |
| `/portfolio-item/العلية/` | portfolio item | `/ar/spaces` |
| `/author/abdullah/` | WP author archive | `/ar/about` |
| `/author/moatazmulla/` | WP author archive | `/ar/about` |
| `/events/font/` | stray demo path | `/ar/events` |

---

## The config to apply

These are **host-scoped** with `has: [{type: "host", value: "mazj.org"}]`, so they fire **only** for traffic arriving on mazj.org and never change the site's English-default behavior on any other domain (localhost, previews, or a different launch host). Paste into the `redirects()` array in `next.config.mjs`, alongside the existing `/pricing` and `/community` rules.

> ⚠️ Do not apply until the new site is actually served at mazj.org. Host-scoped rules are inert everywhere else, so it is safe to merge early, but there is nothing to test until the domain points here.

```js
// --- Legacy mazj.org (2021 WordPress) → new site. See docs/mazj-org-301-redirect-map.md ---
// Host-scoped so English-default is untouched on every other deployment.
// All targets are /ar/* because mazj.org is lang="ar" and its ranking equity is Arabic.
{source: "/", has: [{type: "host", value: "mazj.org"}], destination: "/ar", permanent: true},
{source: "/home-2", has: [{type: "host", value: "mazj.org"}], destination: "/ar", permanent: true},
{source: "/عن-مزج", has: [{type: "host", value: "mazj.org"}], destination: "/ar/about", permanent: true},
{source: "/الفعاليات", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/category/الفعاليات", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/event-type/ورشة-عمل", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/workshops", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/programs", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/قهوة-وسكيتش", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/لقمة-وفايدة", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/نساء-يصممن", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/events/font", has: [{type: "host", value: "mazj.org"}], destination: "/ar/events", permanent: true},
{source: "/faq", has: [{type: "host", value: "mazj.org"}], destination: "/ar/faq", permanent: true},
{source: "/contactus", has: [{type: "host", value: "mazj.org"}], destination: "/ar/contact", permanent: true},
{source: "/tour", has: [{type: "host", value: "mazj.org"}], destination: "/ar/contact", permanent: true},
{source: "/terms", has: [{type: "host", value: "mazj.org"}], destination: "/ar/terms", permanent: true},
{source: "/services", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/slide-types/المساحات", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/portfolio-item/العلية", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/booking", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/bk", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/reservation", has: [{type: "host", value: "mazj.org"}], destination: "/ar/spaces", permanent: true},
{source: "/author/abdullah", has: [{type: "host", value: "mazj.org"}], destination: "/ar/about", permanent: true},
{source: "/author/moatazmulla", has: [{type: "host", value: "mazj.org"}], destination: "/ar/about", permanent: true},
{source: "/my-account", has: [{type: "host", value: "mazj.org"}], destination: "https://mazj.sa", permanent: true},
```

---

## 🔴 Three things that will bite if untested

These are the reasons this map is a *documented deliverable to apply and test at launch*, not a blind code edit. All three are unverified against a live matcher because the new site isn't at mazj.org yet.

1. **Non-ASCII sources.** Next.js matches `source` against the decoded pathname, so the literal Arabic above *should* match incoming `%D8%B9%D9%86-...` requests. This has historically been flaky in path-to-regexp. **Test every Arabic-slug row at launch** (commands below). Any that don't 301, either swap that `source` to its percent-encoded form or move it into `proxy.ts` with an explicit `decodeURIComponent(pathname)` comparison — the middleware gives you exact control the config matcher doesn't.

2. **Trailing slashes.** The indexed URLs all end in `/` (`/faq/`), but the sources above are slash-less (`/faq`). Confirm the project's `trailingSlash` setting collapses both, or add slash variants. The `curl` tests below hit the **indexed** (trailing-slash) form deliberately — that is what Google and bookmarks actually request.

3. **Redirect vs. middleware precedence.** `next.config` `redirects()` run **before** the next-intl middleware, which is what lets `/faq` reach `/ar/faq` instead of being locale-prefixed to `/en/faq` first. Verify the homepage specifically: `mazj.org/` must 308 to `/ar`, not 307 to `/en`. If the middleware wins on `/`, move the root rule into `proxy.ts`.

## Launch verification

Run against the deployed mazj.org, following redirects off:

```bash
for pair in \
  "/|/ar" \
  "/عن-مزج/|/ar/about" \
  "/الفعاليات/|/ar/events" \
  "/faq/|/ar/faq" \
  "/contactus/|/ar/contact" \
  "/terms/|/ar/terms" \
  "/home-2/|/ar"; do
  old="${pair%%|*}"; want="${pair##*|}"
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$old")
  got=$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "https://mazj.org$enc")
  echo "  $old -> $got   (want 308 …$want)"
done
```

Then re-submit the **old** `wp-sitemap.xml` in Google Search Console one last time after launch — it makes Google recrawl the old URLs and see the 301s faster, which is how the equity actually transfers. Keep the redirects permanent (never remove them); a 301 only passes signal while it exists.

---

*Source: mazj.org's live `wp-sitemap.xml` (25 URLs, fetched and decoded). Ranking claims are from an adversarially-verified scan under Saudi geolocation. New-site routes are from this repo's `app/[locale]/` tree.*
