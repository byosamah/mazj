# Rekaz Merchant Public API: verified findings

**Recorded 2026-07-27 by probing the LIVE production API** with MAZJ's real
merchant credentials, and **re-probed on 2026-07-28** while the 54-finding defect
report was being answered. Every claim below was observed, not read.

🔴 **One thing here is still OPEN, and it is not a code change: the Rekaz key has
not been rotated.** It was pasted into a chat transcript on 2026-07-27, it is
admin scope, and it reads the entire customer list. See the Credential hygiene
section at the end of this file before launch.

⚠️ **A claim in this file is only as good as its last probe, and three of them
were WRONG for a day.** The error envelope, the `/reservations` filters and the
live volumes each taught something false until 2026-07-28, and each was wrong in
the direction that costs an afternoon rather than the direction that fails
loudly. Where a date appears beside a claim, that date is when it was MEASURED,
not when the paragraph was last edited. **Re-probe before building on one.**

This is the engineering counterpart to
[`rekaz-api-review-ar.md`](./rekaz-api-review-ar.md), which is a letter to Rekaz
written on 2026-07-19 from the published documentation alone. That document is
still accurate about what the docs *say*. This one records what the API
*does*, and the two disagree in several places that matter.

> ⚠️ **There is no sandbox.** Every request here hit the production tenant, which
> holds **562 reservations, 101 subscriptions and 287 customers** of real
> customer data (counted 2026-07-28). Reads are harmless. A write creates a
> record MAZJ's operations team will see in their dashboard. Do not POST
> casually.

## 🔴 Rekaz's own platform code is readable, and it settles arguments

`platform.rekaz.io/Abp/ApplicationLocalizationScript?cultureName=en` (and `=ar`)
returns a ~1.2MB flat map of EVERY UI string in the platform. The hosted checkout
component is a separate island bundle linked from any `/orders/pay/<id>` page.
Download once, grep locally, never crawl.

It answers "does Rekaz already have this feature?" It proved they ship coupons,
customer phone OTP (`Settings:Checkout:SendOtpToCustomerBeforeCheckout`), custom
domains, refunds with acquirer reversal, invoice and credit-note documents, ZATCA
Phase 2, cart locks and abandoned carts, and MULTIPLE named API keys. Four report
findings were wrong because we asked them to build things they already sell.

🔴 **A string table proves PRESENCE, never ABSENCE.** A hit is strong evidence. A
miss is not evidence: the feature may be server-side, in a bundle you did not
fetch, or named something you did not guess. Never write "they do not have X"
from a failed grep.

⚠️ Platform is not API. A capability in their dashboard does not kill a finding
about the API; it usually sharpens it to "expose what you already run".

## Connecting

| | |
|---|---|
| Base URL | `https://platform.rekaz.io/api/public` |
| Auth | `Authorization: Basic <base64 of key:secret>` |
| Tenant | `__tenant: <tenant id>` (**two** underscores) |
| Content | `Content-Type: application/json` |

Credentials live in `.env.local` as `REKAZ_AUTH_BASIC` and `REKAZ_TENANT_ID`.

🔴 **The key is admin scope, not a storefront key.** `GET /customers` returns the
entire customer list. It carries the same blast radius as the Supabase secret
key: server-only, never `NEXT_PUBLIC_`, never logged. This is the risk
`rekaz-api-review-ar.md` §4.3 raises, and it is real rather than theoretical.

🔴 **The API 403s any request whose `User-Agent` it does not like.** Measured:

| User-Agent | Result |
|---|---|
| `Python-urllib/3.12` | **403 Forbidden** |
| `curl/8.7.1` | 200 |
| `MAZJ-Site/1.0` | 200 |
| `Mozilla/5.0` | 200 |
| `node` | 200 |

There is an allow-shaped filter in front of the API, and the default agent of at
least one common HTTP client trips it. Node's `fetch` sends `node` and passes
today, but relying on a default that a runtime upgrade can change is how this
breaks silently in production at 2am. **Always send an explicit `User-Agent`.**
`server/rekaz/client.ts` does.

🔴 **The documented `_tenant` (one underscore) is wrong.** The Quick Start page
still shows it. `__tenant` (two) is what works. The Quick Start page is also
wrong about token lifetime: it claims a one-hour token needing refresh, but Basic
auth with a non-expiring key is what the API actually accepts. `rekaz-api-review-ar.md`
§4.9 guessed correctly that the newer API page wins.

## The live MAZJ catalog

One branch: `3a14a1b1-20c2-0538-4e55-c58ca11941d4` (`مساحة مزج - الخبر`).

🔴 **`nameEn` is byte-identical to `nameAr` on every product and every branch.**
Rekaz holds no English content at all. `rekaz-api-review-ar.md` §3 lists
bilingual catalog data as the API's first advantage; that advantage does not
exist for this tenant. **`messages/en.json` and `messages/ar.json` remain the
only source of English product names.** Never render `nameEn` into the English
site: it will emit Arabic.

Product `type` drives which flow applies, and they are entirely different
endpoints. **Counted 5 products on 2026-07-30**, up from 4 on 2026-07-28:

| Product | id | type | Flow |
|---|---|---|---|
| غرفة الاجتماعات (الملقى) | `3a14b646-4fa3-7c31-ddce-d7302c01403f` | `0` Reservation | slots + `POST /reservations/bulk` |
| قاعة الفعاليات (المعارج) | `3a14ba65-3e22-27e0-b83d-102655855092` | `0` Reservation | slots + `POST /reservations/bulk` |
| مقعد في المساحة المشتركة | `3a14ba38-8e8c-04f3-7ae2-5f138e27702c` | `1` Subscription | `POST /subscriptions` |
| مكتب خاص (حيّز) | `3a157fb0-1745-397c-e803-bb6cc4d3321c` | `1` Subscription | `POST /subscriptions` |
| فعالية تجريبية | `3a22bf80-6d12-1059-f748-28a2e4181007` | `2` **Merchandise** | 🔴 **no write endpoint. Storefront only.** |

### 🔴 `type: 2` is `Merchandise`, and there is NO API way to sell one

Added to the tenant between 2026-07-28 and 2026-07-30: `فعالية تجريبية`
(`faalyh-tjrybyh`), 50 SAR, unlimited stock, `maximumQuantityPerOrder: 1`. It is
MAZJ's event-ticket product.

**Nothing in this document's verified endpoint list writes one.** The POSTs are
`/reservations/bulk`, `/subscriptions`, `/customers` and `/attendances`, and
Rekaz's own storefront sells merchandise through an **add-to-cart** flow (the
product page loads an `add-to-cart-button` chunk from `static.rekaz.io`) rather
than a single call. Their webhook catalog does carry a `MerchandiseOrder` group
of 3 events, so merchandise orders are first-class on their side; we simply have
no documented way to create one.

⚠️ Note the price INSIDE a merchandise product still reports `"type": 1` and
`billingCycle: 1`. That is the PRICE's own type field and it is not the product
type. Reading it as one is how you conclude a merchandise product is a
subscription.

**That is why a paid MAZJ event links out** rather than transacting here. See
`docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md`.

### The storefront URL shapes

All verified 200 on 2026-07-30, and the origin is `https://mazj.sa` for every one
of them. `server/rekaz/store.ts` builds these.

| Type | Path | Example |
|---|---|---|
| `0` Reservation | `/{locale}/reservation/{slug}` | `/ar/reservation/qaah-alfaalyat-almaarj` |
| `1` Subscription | `/{locale}/subscription/{slug}` | `/ar/subscription/adwyh-almsahh-almshtrkh` |
| `2` Merchandise | `/{locale}/merchandise/{slug}` | `/ar/merchandise/faalyh-tjrybyh` |

⚠️ **The bare, locale-less path 308s to `/ar/...`**, so a link without a locale
sends an English reader to an Arabic page. Always write the locale in. `/en/` and
`/ar/` both answer 200, but the product NAME is Arabic either way, because this
tenant holds no English content.

🔴 **There is no Rekaz-hosted address for this store.** Probed 2026-07-30:
`mazj.rekaz.io`, `mazj.rekaz.sa`, `store.mazj.sa` and `shop.mazj.sa` all fail to
resolve, and the page self-canonicalises to `https://mazj.sa/...`. So when
`www.mazj.sa` starts serving the marketing site, the store has nowhere to live
and every ticket link breaks. `npm run check:env` warns when the two domains
match.

**The four `slug` values match `lib/links.ts` `BOOKING` exactly**
(`ghrfh-alajtmaaat-almlqa`, `qaah-alfaalyat-almaarj`, `adwyh-almsahh-almshtrkh`,
`private-office`), confirming those URLs are still correct as of today. `url` is
`null` on all four, so the storefront URL is built from the slug, not returned.

⚠️ **The live store is locale-prefixed and our links are not.**
`https://mazj.sa/subscription/<slug>` answers **308** and redirects to
`https://mazj.sa/ar/subscription/<slug>`. It works today, but the 301 map for
launch must cover **both** shapes, and `/ar/subscription/...` is the awkward one:
it collides with this site's own `/ar` locale prefix, so it would hit the
`[...rest]` catch-all rather than 404ing at the edge.

⚠️ **No subscription start-date constraints are configured.**
`subscriptionStartAt`, `subscriptionStartAtLimit` and `subscriptionStartAtMax`
are `null` on every product, in both the API and the storefront's own embedded
data. So Rekaz imposes no bound and the start date is entirely a UI decision.

⚠️ **Do not hardcode these ids.** Every `pricing[].id` in the catalog differs from
its `immutableId`, and the price ids carry a `3a2296xx` prefix stamped in July
2026 while the immutable ids date to 2024. That means **price ids are rotated
when a price is edited in the Rekaz dashboard**. Resolve products and prices by
fetching `GET /products` at request time. `immutableId` is the stable handle if
one is ever needed.

⚠️ `قاعة الفعاليات (المعارج)` has `branchIds: []` while the other three name the
branch. Filtering products by branch id would silently drop the events hall.

### Custom fields are required, and only on the events hall

`قاعة الفعاليات` carries three custom fields, two of them `isRequired: true`:

| Label | Type | Required |
|---|---|---|
| كم عدد الحضور؟ | `2` (number) | yes |
| وصف الفعالية | `1` (text) | yes |
| السجل التجاري - تصريح النشاط | `10` (file) | no |

A booking form for that product that omits the two required fields will be
rejected. The file upload field has no documented upload endpoint.

🔴 All labels and placeholders are **Arabic only** (`localizedLabel.OtherLanguages.en`
is `""`). English labels must come from `messages/en.json`, keyed by field id.

## `GET /reservations/slots`

The single most important endpoint for booking, and the one the docs describe
worst. Verified over a 3-week window, 192 slots.

**Required parameters.** `PriceId`, `StartDate`, `EndDate`, and `MinQuantity`.

🔴 **`MinQuantity` is required despite being documented as optional.** Omitting it
returns `400` with `يجب أن يكون الحقل MinQuantity بين 1 و 2147483647`. Pass `1`.

**What it returns.** Discrete, *overlapping* windows, each sized by the price's
`duration`, sliding at 1-hour granularity. The 2-hour events hall price yields
`07:00-09:00`, `08:00-10:00`, `09:00-11:00` and so on, not disjoint blocks. A UI
that renders these as a simple list of choices is correct; one that assumes they
tile a day is not.

```jsonc
{
  "from": "2026-07-28T06:00:00Z",
  "to": "2026-07-28T07:00:00Z",
  "availableReservationsCount": 1,
  "availableProvidersCount": 1,
  "availableProviderIds": ["3a14abdc-0ca4-4020-6f4a-0cab151244b7"],
  "isOutDated": false,          // true = window already in the past
  "isAvailable": true,
  "amounts": {
    "totalPrice": 110,
    "effectiveQuantity": 1,
    "totalAfterDiscount": 110,
    "depositAmount": null,
    "basePrice": 0,             // always 0 in observed responses
    "priceWithTax": 0           // always 0 in observed responses
  },
  "maxConnectedTo": "2026-07-28T18:00:00Z",
  "allProvidersAvailability": { "3a14abdc-...": true }
}
```

✅ **`basePrice` and `priceWithTax` being 0 is a defect in Rekaz's response, NOT
a money bug for MAZJ, and that is SETTLED.** Checked end to end on 2026-07-28:
the catalog carries `amount` **220** for the meeting room's `ساعتان` price, and a
real billed reservation at that price reports `reservationTotalAmount` **220.0**
and `orderTotalAmount` **220.0**. What the booking form displays is what Rekaz
bills. The two zeroed fields are never read here: `totalPrice` and
`totalAfterDiscount` carry the real figures and are the only ones anything in
this codebase touches. 🔴 **Do not "fix" the price path.** The finding stands as a
defect worth Rekaz fixing, because a merchant who computed VAT from
`priceWithTax` would bill zero tax, and in Saudi Arabia that is a ZATCA
compliance problem rather than a display bug. It needs nothing on our side.

**Bookable windows, as the API reports them.** 🔴 **These are REKAZ BOOKING
WINDOWS, not MAZJ's staffed hours, and since 2026-07-31 the two no longer look
alike.** The team is in the space **09:00 to 17:00** (owner correction; the site
said "9 to 9" until that date and it was never right), while Rekaz still offers
slots to 21:00 in the meeting room and to midnight in the events hall. Do not
"correct" either figure against the other: the numbers below live in Rekaz's
dashboard and can only be changed there, and MAZJ's staffed hours live in
`Location.staffedValue` in `messages/*.json` and in `lib/schema.ts`'s
`openingHoursSpecification`.

| Product | Slots/day | UTC window | Riyadh (UTC+3) |
|---|---|---|---|
| غرفة الاجتماعات | 12 | 06:00-18:00 | 09:00-21:00 |
| قاعة الفعاليات | 14 | 07:00-21:00 | 10:00-24:00 |

⚠️ **A room bookable four hours past the last staffed hour is an operations
question, not a defect in this repo.** Raise it with whoever runs the Rekaz
dashboard rather than editing anything here.

**Friday and Saturday return no slots at all.** Confirmed across three
consecutive weeks: `2026-07-31`, `08-01`, `08-07`, `08-08`, `08-14`, `08-15` are
absent from the response entirely. Sunday to Thursday, so the DAYS still match
the staffed days in `CLAUDE.md`. The HOURS no longer do, per the paragraph
above.

🔴 **The date range is padded, not honoured exactly.** Requesting
`StartDate=2026-07-28 & EndDate=2026-07-29` returned slots for the 27th, 28th
and 29th. Requesting a Friday-only range returned the preceding Thursday. **The
caller must filter the response down to the day it actually asked for**, and must
drop `isOutDated: true` entries. Do not assume a one-to-one mapping between the
request window and the response.

⚠️ **Correction to `rekaz-api-review-ar.md` §4.5.** That section flags a
documented example where `isAvailable: false` coexists with
`availableReservationsCount: 1`, and asks Rekaz to explain the contradiction.
Across 192 real slots, **zero** had `isAvailable: false`. The published example
appears to be simply wrong rather than describing a real semantic. The genuine
oddity is the date padding above, which the docs never mention.

## 🔴 `GET /reservations`: ONE filter works, every other one is silently ignored

Still the most dangerous finding in this document, because it fails **silently
and plausibly**. Re-measured 2026-07-28 against the live tenant, 562
reservations, one parameter at a time, each against a baseline request carrying
no filter at all:

| Query | Result |
|---|---|
| no filter | 100 rows, `totalCount` **562** |
| 🟢 `customerMobile=<a real number>` | **7 rows**, every one carrying that mobile |
| 🟢 `customerMobile=<a number nobody has>` | **0 rows** |
| `keyword` | identical 562 |
| `customerId` | identical 562, including for an id that does not exist |
| `branchId` | identical 562, including for an id that does not exist |
| `statuses=Confirmed` | identical 562 |
| `upcoming=true` | identical 562 |
| `dateMin` + `dateMax` (2-day window) | identical 562 |
| `skipCount` / `maxResultCount` | genuinely works |

🔴 **`customerMobile` GENUINELY FILTERS. That is new, and it corrects this
section's own headline.** This file said every documented filter was ignored;
that was measured before this parameter was ever tried. The 7 rows it returns
span **January 2025 to July 2026**, i.e. it reaches records `fetchAllReservations`
would never page back to. It is not a shortcut, it answers a question our own
paging cannot.

Two properties a caller must respect:

- **It tolerates the leading `+`.** `+966...` and `966...` return the identical
  7 rows. Worth knowing precisely because Rekaz STORES the number without the
  plus (see the reconciliation section below), so the two halves of that trap do
  not line up and you cannot reason about one from the other.
- 🔴 **It is a SUBSTRING match, not an exact one.** A four-digit fragment
  (`6233`) also matched. So a caller must still compare the returned row's own
  `customerMobile` to the number it asked for, digits against digits, before
  trusting a row. A substring filter treated as exact is how one customer's
  booking gets attributed to another.

**Everything else on that endpoint is confirmed ignored**, including when the
value is one no record could possibly hold. That last part is the tell: a real
filter returns nothing for a nonexistent id, and these return all 562.

No error, no warning. You get the unfiltered list wearing the shape of a
filtered one, so a date-bounded query looks like it worked and quietly returns
whatever happened to be on page 1.

🔴 **And the sort order is not what you would guess.** Rows come back ordered by
**`creationTime` descending, NOT `startAt`.** Verified across all 562:
`creationTime` is monotonically descending; `startAt` is not.

Those two facts combine into a trap worth stating plainly. "Read page 1, that is
where the upcoming bookings are" is true only while customers book close to the
date. A reservation created three months ago for next Tuesday sits on page 4, so
that code silently drops exactly the long-lead bookings, which for an events
hall are the expensive ones. It looks correct for months and then loses the
biggest reservation of the year.

**For a general list, the only correct approach is still to page and filter in
code.** `fetchAllReservations` does that, stopping once a page's oldest
`creationTime` predates a 180-day lookback, capped at 4 pages. **For one
customer's history, use `customerMobile` and verify every row you get back.**

### The filter map for the whole API

⚠️ Each of these was tested independently against the live tenant on 2026-07-28.
Nothing in Rekaz's documentation distinguishes a filter that works from one that
does not, so **verify any filter before you rely on it.**

| Endpoint | Filter | Works? |
|---|---|---|
| `/customers` | `mobileNumber` | 🟢 yes, 287 customers to 1, with or without the plus |
| `/reservations` | `customerMobile` | 🟢 yes, substring, 562 to 7 |
| `/reservations` | `keyword`, `customerId`, `branchId`, `statuses`, `upcoming`, `dateMin`, `dateMax` | 🔴 no, silently |
| `/subscriptions` | `customerId` | 🟢 yes, 101 to 1 |
| `/subscriptions` | `customerMobile` | 🔴 no, 101 either way |
| everything | `skipCount` / `maxResultCount` | 🟢 yes |

🔴 **Note the crossover in that table.** `/reservations` honours `customerMobile`
and ignores `customerId`; `/subscriptions` does the exact opposite. There is no
rule to infer, which is why the table exists and why
`test/rekaz-filters.integration.test.ts` pins the two the booking path bets on.

## Performance, and why concurrency is the wrong instinct

Rekaz is slow and highly inconsistent. Measured sequentially, gently:

| Endpoint | Observed |
|---|---|
| `/branches` | 0.8s to 3.3s |
| `/products` | 1.2s to **10.8s** |
| `/subscriptions` | 1.5s to 3.4s |
| `/reservations` (100 rows) | ~6s |

🔴 **Do not parallelise requests to Rekaz.** Firing six page requests at once
made `/subscriptions` hang past **two minutes**, having answered in 1.5s moments
earlier sequentially. Whether that is rate limiting or simply strain, the
conclusion is the same, and there is a second reason that outranks throughput:
**this API also serves mazj.sa, where real customers are checking out.** Load
pointed at it is load pointed at the revenue path.

`fetchAllReservations` therefore pages **sequentially** with an early stop.

⚠️ **Its only production caller was the admin dashboard, which was deleted on
2026-07-30** (owner ruling: MAZJ manages bookings in Rekaz's own platform, so
this tool no longer mirrors them). So the 60-second cache that used to sit in
front of this crawl is gone too, and with it the heaviest recurring read MAZJ
made of this API: two multi-page crawls every time a staff member opened
`/admin`, aimed at the same instance that serves mazj.sa checkout.
`fetchAllReservations`, `fetchAllSubscriptions` and `bookableRooms` now have
**no caller outside the test suite**. They are kept because they are the
measured, documented way to read this API and the measurements above are what
make them worth keeping; treat a grep hit in them as reference material rather
than as live behaviour.

## Errors

🔴 **TWO envelopes are live, not one, and the documentation describes only one of
them.** Corrected 2026-07-28: an earlier version of this section said
ProblemDetails had REPLACED the documented envelope. It has not. Which one you
get is decided by where inside Rekaz the request died.

| Failure class | Status | Envelope |
|---|---|---|
| Model binding, query validation | 400 | RFC 9110 ProblemDetails: `{type, title, status, errors, traceId}` |
| Application and business rules | 403, 404, 500 | the documented legacy envelope: `{error: {code, message, details, data, validationErrors}}` |

🔴 **`error.code` was `null` in every legacy body observed.** So the one field in
the whole API that exists to be branched on is never populated, and the only
thing left to branch on is a localised human message, which is precisely the
thing that must never be branched on.

🔴 **`traceId` exists ONLY in the ProblemDetails shape.** A 403, a 404 and a 500
carry no trace identifier at all, so on exactly the failures Rekaz support would
need to investigate there is nothing to quote them.

The ProblemDetails shape:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "PriceId": ["The value 'BAD' is not valid for PriceId."] },
  "traceId": "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01"
}
```

And the legacy shape, captured from a business-rule 403 on `POST /reservations/bulk`:

```json
{
  "error": {
    "code": null,
    "message": "Mobile number already exists with different customer",
    "details": null,
    "data": null,
    "validationErrors": null
  }
}
```

Field names in `errors` are **PascalCase** and match the query parameter, not the
JSON body casing.

### Localisation is PARTLY honoured, which is worse than either extreme

⚠️ **This corrects a claim this file taught for a day.** It said messages arrive
**in Arabic regardless of `Accept-Language`**. Measured 2026-07-28 with only the
header changed: that is false. The header IS honoured, for some strings. We had
simply never been sending it. `server/rekaz/client.ts` sends `Accept-Language: en`
now, so the server log reads in English for whoever is on call.

| String | `Accept-Language: en` | `Accept-Language: ar` |
|---|---|---|
| the legacy envelope's `message` | English | Arabic |
| ProblemDetails `title` | English | **English** |
| a range violation (`MinQuantity`) | English | Arabic |
| a type violation (`PriceId`) | English | **English** |

🔴 **Never surface a Rekaz message to a user. This correction does not weaken
that rule, it gives it a second independent reason.**

1. The message names internal field names (`PriceId`, `MinQuantity`) and
   internal entity names ("There is no entity Price with id ..."). That is
   upstream implementation detail, and on a public booking form it is also a
   free reconnaissance tool.
2. Localisation is only PARTLY honoured, so "it will arrive in the reader's
   language" is not a property anything may depend on. Half a form in the wrong
   language is not an improvement on all of it.

Map to our own `AppError` codes and render copy from `messages/*.json`. Log the
`traceId` where there is one: it is what Rekaz support will ask for.

⚠️ **403 does not mean what it usually means, and the two kinds are
distinguishable only by the body.** Rekaz returns 403 for a business rule ("this
mobile belongs to another customer") as well as for a genuine refusal, so status
alone cannot separate an integration bug from a data conflict. A business 403
carries the legacy JSON envelope above. The User-Agent 403 is not from Rekaz's
application at all: it is a **Cloudflare** block whose body is the plain text
`error code: 1010`, and it never appears in Rekaz's own logs, which is why their
support cannot see it happening.

⚠️ **A validation error echoes the submitted value back**, e.g.
`{"errors": {"PriceId": ["The value 'BAD' is not valid for PriceId."]}}`. Every
booking POST carries `customerDetails` inline, so a failure on the name, mobile
or email field echoes personal data into the response body, and logging a raw
upstream body (the normal way to debug a third party) writes it to a log store.
Two controls stand behind that, and both are pinned by
`test/booking-audit-log.test.ts` against the two real envelopes.
`server/rekaz/client.ts` parses the body before logging it, so the redactor sees
object KEYS rather than one opaque string and the key denylist can act; and since
2026-07-28 `redact` also scrubs mobile and email SHAPES out of string VALUES,
which is the half a key denylist can never reach. The second one is what keeps a
number out of `idempotency_keys.response_body`, the row that outlives the request
and is replayed to a later retry.

## What is genuinely missing

Confirmed absent from both the documentation and the live surface.

| Gap | Consequence |
|---|---|
| 🔴 **No payments API** | `POST /reservations/bulk` returns a `paymentLink` to a Rekaz-hosted checkout. Card entry cannot happen on our domain. This is the one hard architectural constraint. See the section below: the link is NOT the shape the docs claim. |
| 🔴 **No webhook signature** | 21 events, 10 retries with exponential backoff, and no HMAC, shared secret or signing header of any kind. Anyone who learns the URL can forge `ReservationConfirmedEvent`. Mitigation: an unguessable path, plus re-fetching the entity by id before trusting any payload. |
| 🔴 **No end-customer auth** | No customer login, no OTP, no per-customer scoped token. A "my bookings" page means building auth ourselves and filtering with an admin key, where one missing `.eq()` exposes the whole customer base. Same failure mode `server/CLAUDE.md` warns about for the Supabase admin client. |
| 🟡 **No idempotency keys** | A double-tapped booking button creates two reservations. `idempotency_keys` in our own database stops being optional the day we POST a booking. |
| 🟡 **No sandbox** | Development and testing run against production data. |
| 🟡 **No OpenAPI spec** | Every type is hand-written and needs review whenever Rekaz ships a change. There is no drift alarm. |
| 🟢 No coupon validation, no invoice retrieval, no refund endpoint, no product images (`productProviders[].image` is `null`), 100-record page cap | Smaller. Recorded so nobody rediscovers them. |

## 🔴 The payment link is RELATIVE, not absolute

Measured against a real booking created on 2026-07-27, not read from the docs.

The documentation shows:

```json
{ "paymentLink": "https://platform.rekaz.io/i/NcRo" }
```

The live API returned:

```json
{ "paymentLink": "/orders/pay/RMogHOPQc47FStqK" }
```

A **relative path**, and a different path shape. This is the single most
dangerous discrepancy in this document, because of where it lands: redirecting a
browser to a relative path resolves it against the CURRENT origin, so the final
click of a purchase sends the buyer to **our own** site and a 404. The booking is
already created and unpaid at that point, so it also leaves a `Pending`
reservation holding a room.

**The host cannot be inferred from the store domain.** Verified:

| URL | Result |
|---|---|
| `https://platform.rekaz.io/orders/pay/<id>` | **200** |
| `https://mazj.sa/orders/pay/<id>` | 404 (redirects to `/ar/orders/pay/<id>`) |

`absolutePaymentLink()` in `server/rekaz/booking.ts` resolves it against the API
**origin** (not the `/api/public` base path, which also 404s) and passes an
absolute URL through untouched, so the day Rekaz honours its own docs nothing
breaks. **Never use `paymentLink` raw.**

⚠️ `invoiceId` came back **undefined** on that reservation response despite being
documented. Do not depend on it.

## Writes: what a real booking looks like

Recorded from the one live test, since there is no sandbox to repeat it in.

- `POST /reservations/bulk` with `customerDetails` inline creates the customer
  and the reservation in one call. Guest checkout works.
- The reservation lands in status **`Pending`**, as the packages documentation
  implies. It becomes `Confirmed` only after the payment link is paid.
- `PUT /reservations/{id}/cancel` with `{cancellationReason, notifyCustomer}`
  answers **204** and genuinely releases the slot: the window reappeared as
  available immediately afterwards.
- ⚠️ Cancelled reservations REMAIN in `GET /reservations` with
  `status: "Cancelled"`. Anything counting bookings must filter them out.

## Reconciling a write you never got an answer to

Rekaz has no idempotency and no way to ask about a request by id, so a timed-out
POST leaves the booking in an unknown state. Two properties of the API make that
recoverable, and both were measured:

| Resource | How to find a just-created record |
|---|---|
| Reservations | Ordered **`creationTime` DESC**, so it is at the top of page 1. Match on `customerMobile` + exact `startAt` + recency. 🟢 **Since 2026-07-28 there is a better way:** `GET /reservations?customerMobile=` genuinely filters (562 rows to 7), so a reconciliation need not page at all. It is a SUBSTRING match, so still verify the row's own mobile. |
| Subscriptions | 🔴 **`customerId` genuinely filters here** (101 rows to 1), unlike almost everything on `/reservations`. ⚠️ `customerMobile` does NOT filter `/subscriptions`: 101 rows either way. The two endpoints honour opposite parameters. |

🔴 **Rekaz stores mobile numbers WITHOUT the leading `+`** (`966500000000` where
we send `+966500000000`), so a direct comparison never matches and reconciliation
would silently always report "not found". Strip to digits before comparing.

⚠️ `customerMobile` and `customerName` come back **empty strings** on some older
records, so neither can be a required match field in general. They are populated
on records we create ourselves via `customerDetails`.

🔴 **A fetched booking carries NO payment link.** `GET /reservations` exposes
`orderId`, `orderPaymentStatusString` and `meetingUrl`, and nothing resembling a
checkout URL. So a reconciled booking can be confirmed to exist and handed to
operations with its `reservationNumber`, but the customer **cannot** be sent to
checkout automatically. That is why `server/services/booking.ts` returns the
reference and tells them to make contact rather than retrying.

## Webhooks

Registered at `platform.rekaz.io/Identity/apikeys`. Envelope is
`{ Id, EventName, CreatedAt, Data }` with **PascalCase** properties, unlike every
REST response, which is camelCase. Success is any 2xx.

21 events across four groups: Reservation (5), Subscription (9), MerchandiseOrder
(3), Gift (4). Only the Reservation and Subscription groups are relevant to MAZJ.

⚠️ Untestable until this site is deployed to a public URL. Nothing about webhooks
can be verified locally.

## Reference: endpoints that exist

Verified reachable with our credentials. `GET` unless noted.

`/branches` · `/branches/{id}` · `/products` · `/products/{id}` · `/providers` ·
`/customers` · `/customers/{id}` · POST `/customers` ·
`/reservations` · `/reservations/{id}` · `/reservations/slots` ·
POST `/reservations/bulk` (max 5) · PUT `/reservations/{id}` ·
PUT `/reservations/{id}/{confirm,done,cancel}` ·
`/subscriptions` · `/subscriptions/{id}` · POST `/subscriptions` ·
PUT `/subscriptions/{id}/dates` · POST `/subscriptions/{id}/{pause,resume}` ·
`/packages` · `/attendances` · POST `/attendances`

Pagination is `skipCount` / `maxResultCount`, capped at 100, with `totalCount` in
the response.

**Live volumes, counted 2026-07-28:** 562 reservations, 101 subscriptions, 287
customers, 0 packages, 5 providers, 4 products, 1 branch. ⚠️ **Products became 5
on 2026-07-30** when the merchandise ticket appeared, which is exactly the kind
of drift the warning below is about: nobody committed anything.

⚠️ They were 555 / 97 / 284 on 2026-07-27. This is a live business, so treat any
figure in this file as the date beside it rather than as a constant, and re-count
before building a threshold, a page cap or a test assertion on one.

## 🔴 Credential hygiene: the key is STILL NOT ROTATED

**Status on 2026-07-28: disclosed, still in use, nothing anywhere records it as
replaced.** This is the only unfixed item in this document whose blast radius is
measured in customers rather than in developer hours, and it is the item most
likely to be forgotten because closing it is not a commit.

- The live `REKAZ_AUTH_BASIC` was **pasted into a chat transcript on
  2026-07-27**. A credential that has been through a transcript is disclosed.
  That is not a judgement about where the transcript lives, it is what the word
  means.
- The key is **admin scope**. `GET /customers` with it returns MAZJ's entire
  customer list: **287 people**, with names, mobile numbers and email addresses.
  Under PDPL that is not "an API key leaked", it is a personal-data breach
  waiting for somebody to read the transcript.
- Rekaz displays a generated key **once**, so it cannot be re-read from the
  dashboard, only regenerated. Rotate at `platform.rekaz.io` under
  **User Management > API Keys**, then update `.env.local` AND the Vercel
  project, on **Production and Preview**, and redeploy.

🔴 **Rotation is a deliberate, short OUTAGE. Schedule it, do not do it casually.**
Rekaz keeps exactly **one** key active at a time. There is no overlap window, no
second key to cut over to, and no way to pre-stage the new value. So from the
moment the new key is generated until it is live in Vercel and the redeploy has
finished, every booking, all four `/spaces/*/book` pages and the whole admin
dashboard answer `upstream_unavailable`. Minutes, not hours, but the failure is
total while it lasts. Do it outside staffed hours, with the Vercel environment
screen already open, and smoke-test one `/book` route per locale afterwards
because those call Rekaz live and are therefore the cheapest proof the new
credential works.

### The rotation, in order

🔴 **FIRST: check whether you need an outage at all.** Rekaz's own API Keys page
reads "Create a separate API key for each integration. Rotate or delete it when
needed.", with a plural empty state (`ApiKeys:EmptyTitle`, "No API keys yet"), a
duplicate-name error, and per-key Rename / Rotate / Delete. If you see **Create
API key**, use CREATE, DEPLOY, DELETE and nothing ever fails: create key 2 →
`.env.local` → `check:rekaz` → Vercel (both envs) → redeploy → smoke-test →
delete key 1. The steps below are the same list, minus the outage.

⚠️ Do NOT use the per-key "Rotate" action for this: its own confirmation says
"The current Base64 value will stop working immediately."

⚠️ The page sits behind `Platform.ApiKeysManagement` and a paid API addon, so
confirm on the dashboard before planning. The outage runbook below is the
fallback if your tenant genuinely only offers one key.

The same steps in the order they have to happen. 🔴 **The two that were missing
are both PRE-FLIGHT checks**, and that is the whole point of them: the key cannot
be re-read once generated, so anything discovered late costs a second full
outage rather than a correction.

1. 🔴 **Before touching Rekaz at all, run `npm run check:rekaz`** with the
   command sandbox OFF. One GET `/branches`, and it prints the branch name.
   What this buys is a known-good pass **on this machine and in this shell**, so
   that a failure later in the rotation has ONE candidate cause instead of
   three. Skip it and a red result at step 5 could equally be the new key, the
   sandbox breaking Node's TLS, or a `.env.local` that was already wrong before
   you started.
2. **Pick the window.** The outage runs from step 3 to step 7, so: outside
   staffed hours, with the Vercel environment screen already open and this list
   in front of you.
3. **Regenerate** at `platform.rekaz.io` under **User Management > API Keys**,
   and copy the value immediately. It is displayed once. Booking, all four
   `/spaces/*/book` pages, ticket prices on `/events/<slug>` and the price picker
   in `/admin/events` are down from this moment. ⚠️ `/admin` itself is NOT, since
   2026-07-30: the index reads only MAZJ's own Postgres, so somebody can still
   sign in and see the queues while the key is mid-rotation.
4. **Paste it into `.env.local`.**
5. 🔴 **Run `npm run check:rekaz` again, BEFORE it goes anywhere near Vercel.**
   This is the step that turns a mangled paste from a twenty-minute mystery into
   two seconds, while the clipboard still holds the key. A green tick here also
   means that if the deployment stays broken afterwards, the fault is the Vercel
   paste or the redeploy, not the credential.
6. **Replace the value on the Vercel project, on Production AND Preview.**
7. **Redeploy.** Vercel environment changes take effect on a new deployment, not
   on the running one, so this is where the outage actually ends.
8. **Smoke-test one `/spaces/*/book` route per locale.** They call Rekaz live,
   which makes them the cheapest deployed-side proof that the new credential is
   working where customers are.

⚠️ **What `npm run check:rekaz` can and cannot prove.** It validates the
**resolved environment**, with `.env.local` as the fallback rather than as the
source. 🔴 A variable already exported in your shell (or by direnv) BEATS the
file, so at step 5 a stale `export REKAZ_AUTH_BASIC` would pass on a value that
is neither the one you just pasted nor the one going to Vercel, and this
checklist would then tell you to blame the deployment. The script detects that
and says so on a pass; if you see that warning, open a clean shell and run it
again before believing the tick. Separately, Vercel keeps its own copy of
`REKAZ_AUTH_BASIC` that no local script can see, so a pass here can NEVER
green-light production and must not be reported as if it had. Its value is triage, and step 8 remains the only
deployed-side proof. What it does close is the gap that `npm run check:env`
leaves wide open and looks like it covers: `server/env.ts` validates the key with
a LENGTH check, so twenty characters of anything print a green tick beside a dead
credential, and the only live assertion (`test/rekaz.integration.test.ts`) SKIPS
without credentials, i.e. it reports success on exactly the condition it exists
to catch. Measured 2026-07-29 with a 32-character junk value in
`REKAZ_AUTH_BASIC`: `npm run check:env` printed "Backend environment is valid"
and exited 0, `npm run check:rekaz` printed HTTP 401 and exited 1.

### Three larger ideas, considered and refused

Recorded so they are not proposed again. Each was examined against what this
vendor actually does, and each failed on that rather than on effort.

- **Dual credentials with fallback on a 401.** Theatre. Rekaz keeps exactly ONE
  key active and the old one dies the instant the new one is generated, so the
  second slot is empty during the only window it would ever matter, and the
  replacement cannot be pre-staged because it does not exist until the old one is
  already dead. It would add a live-credential code path on the money path that
  is never exercised.
- **Moving the credential into the database, with an admin paste form.** This is
  the only design that genuinely removes the redeploy, and it is still a bad
  trade: a security regression sold as convenience. It moves an admin-scope key
  out of Vercel's encrypted environment into a table, adds a browser form that a
  secret is typed into, and creates an environment-versus-database ambiguity
  whose failure mode looks exactly like a bad key. All to save a few minutes of
  downtime on an event that happens at most once a year.
- **A maintenance mode for the booking routes.** Redundant, verified in the code
  rather than assumed: `loadBookableSpace` already returns null when Rekaz
  refuses and `BookingScreen` already renders the unavailable panel with the
  WhatsApp route. A switch shows the visitor the identical sentence, while adding
  a lever nobody remembers to flip back and new copy in both message files.

⚠️ **The tenant id is NOT a secret; the Basic key is.** `REKAZ_TENANT_ID` appears
throughout repo history (a `cdn.rekaz.io/tenants/<id>/` URL in
`components/CLAUDE.md`, since the initial commit) and is public on mazj.sa in
every product image URL. Alone it returns **401**. Only `REKAZ_AUTH_BASIC` is a
credential, and it has never been committed. Verified across all refs before the
first push to GitHub, so a future secret scan need not panic at the hit count.
