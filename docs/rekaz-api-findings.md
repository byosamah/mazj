# Rekaz Merchant Public API: verified findings

**Recorded 2026-07-27 by probing the LIVE production API** with MAZJ's real
merchant credentials. Every claim below was observed, not read.

This is the engineering counterpart to
[`rekaz-api-review-ar.md`](./rekaz-api-review-ar.md), which is a letter to Rekaz
written on 2026-07-19 from the published documentation alone. That document is
still accurate about what the docs *say*. This one records what the API
*does*, and the two disagree in several places that matter.

> ⚠️ **There is no sandbox.** Every request here hit the production tenant, which
> holds 555 reservations and 97 subscriptions of real customer data. Reads are
> harmless. A write creates a record MAZJ's operations team will see in their
> dashboard. Do not POST casually.

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

Product `type` drives which booking flow applies, and the two are entirely
different endpoints:

| Product | id | type | Flow |
|---|---|---|---|
| غرفة الاجتماعات (الملقى) | `3a14b646-4fa3-7c31-ddce-d7302c01403f` | `0` Reservation | slots + `POST /reservations/bulk` |
| قاعة الفعاليات (المعارج) | `3a14ba65-3e22-27e0-b83d-102655855092` | `0` Reservation | slots + `POST /reservations/bulk` |
| مقعد في المساحة المشتركة | `3a14ba38-8e8c-04f3-7ae2-5f138e27702c` | `1` Subscription | `POST /subscriptions` |
| مكتب خاص (حيّز) | `3a157fb0-1745-397c-e803-bb6cc4d3321c` | `1` Subscription | `POST /subscriptions` |

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

**Opening hours, as the API reports them:**

| Product | Slots/day | UTC window | Riyadh (UTC+3) |
|---|---|---|---|
| غرفة الاجتماعات | 12 | 06:00-18:00 | 09:00-21:00 |
| قاعة الفعاليات | 14 | 07:00-21:00 | 10:00-24:00 |

**Friday and Saturday return no slots at all.** Confirmed across three
consecutive weeks: `2026-07-31`, `08-01`, `08-07`, `08-08`, `08-14`, `08-15` are
absent from the response entirely. Sunday to Thursday, which matches the
staffed hours in `CLAUDE.md`.

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

## 🔴 `GET /reservations` ignores every filter it documents

The most dangerous finding in this document, because it fails **silently and
plausibly**. Measured against the live tenant, 555 reservations:

| Query | Result |
|---|---|
| no filter | 100 rows, `totalCount` 555 |
| `upcoming=true` | **identical 100 rows** |
| `dateMin` + `dateMax` (2-day window) | **identical 100 rows** |
| `statuses=Confirmed` | **identical 100 rows** |
| `skipCount` / `maxResultCount` | genuinely works |

No error, no warning. You get the unfiltered list wearing the shape of a
filtered one, so a date-bounded query looks like it worked and quietly returns
whatever happened to be on page 1.

🔴 **And the sort order is not what you would guess.** Rows come back ordered by
**`creationTime` descending, NOT `startAt`.** Verified across all 555:
`creationTime` is monotonically descending; `startAt` is not.

Those two facts combine into a trap worth stating plainly. "Read page 1, that is
where the upcoming bookings are" is true only while customers book close to the
date. A reservation created three months ago for next Tuesday sits on page 4, so
that code silently drops exactly the long-lead bookings, which for an events
hall are the expensive ones. It looks correct for months and then loses the
biggest reservation of the year.

**The only correct approach is to page and filter in code.**
`fetchAllReservations` does that, stopping once a page's oldest `creationTime`
predates a 180-day lookback, capped at 4 pages.

⚠️ `GET /customers?mobileNumber=` **does** filter correctly (284 customers → 1).
So filtering is implemented on some endpoints and not others, with nothing in
the documentation to distinguish them. **Verify each filter you rely on.**

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

`fetchAllReservations` therefore pages **sequentially** with an early stop, and
the admin dashboard caches the assembled result for 60 seconds.

## Errors

🔴 **The documented error envelope is not what the API returns.** The docs
promise `{"error": {"code", "message", "details", "validationErrors"}}`. Every
validation failure observed returned **RFC 9110 ProblemDetails instead**, with
messages **in Arabic** regardless of `Accept-Language`:

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": { "PriceId": ["The value 'BAD' is not valid for PriceId."] },
  "traceId": "00-a639fa99de2cdb95f350a8652e1fddbc-cf39424cf2893552-01"
}
```

Field names in `errors` are **PascalCase** and match the query parameter, not the
JSON body casing. `Accept-Language: en` changed nothing.

**Never surface a Rekaz message to a user.** It may be Arabic on an English page,
and it leaks internal field names. Map to our own `AppError` codes and render
copy from `messages/*.json`. `traceId` is worth logging: it is what Rekaz support
will ask for.

## What is genuinely missing

Confirmed absent from both the documentation and the live surface.

| Gap | Consequence |
|---|---|
| 🔴 **No payments API** | `POST /reservations/bulk` returns `paymentLink` pointing at `https://platform.rekaz.io/i/XXXX`. Card entry cannot happen on our domain. This is the one hard architectural constraint. |
| 🔴 **No webhook signature** | 21 events, 10 retries with exponential backoff, and no HMAC, shared secret or signing header of any kind. Anyone who learns the URL can forge `ReservationConfirmedEvent`. Mitigation: an unguessable path, plus re-fetching the entity by id before trusting any payload. |
| 🔴 **No end-customer auth** | No customer login, no OTP, no per-customer scoped token. A "my bookings" page means building auth ourselves and filtering with an admin key, where one missing `.eq()` exposes the whole customer base. Same failure mode `server/CLAUDE.md` warns about for the Supabase admin client. |
| 🟡 **No idempotency keys** | A double-tapped booking button creates two reservations. `idempotency_keys` in our own database stops being optional the day we POST a booking. |
| 🟡 **No sandbox** | Development and testing run against production data. |
| 🟡 **No OpenAPI spec** | Every type is hand-written and needs review whenever Rekaz ships a change. There is no drift alarm. |
| 🟢 No coupon validation, no invoice retrieval, no refund endpoint, no product images (`productProviders[].image` is `null`), 100-record page cap | Smaller. Recorded so nobody rediscovers them. |

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

**Live volumes at time of writing:** 555 reservations, 97 subscriptions, 0
packages, 5 providers, 4 products, 1 branch.

## Credential hygiene

⚠️ The current credentials were pasted into a chat transcript on 2026-07-27.
Rekaz displays a generated key **once**, so they cannot be re-read from the
dashboard, only regenerated. **Rotate them before launch** at
`platform.rekaz.io` under User Management > API Keys, and update `.env.local`
plus the Vercel environment.
