# On-site booking

**Date:** 2026-07-27 · **Status:** DRAFT, not yet approved
**Phase 2 of 2.** Builds on the Rekaz client proven by
[Phase 1](./2026-07-27-admin-dashboard-design.md).

## Problem

MAZJ sells four products. Today every Book button on this site leaves for
`mazj.sa`, a Rekaz-hosted storefront with different branding, at the exact
moment the visitor decided to buy. That handoff is the thing this project exists
to remove.

It also becomes a hard blocker at launch. The owner intends `www.mazj.sa` to
serve THIS site, and the store paths are `mazj.sa/subscription/*` and
`mazj.sa/reservation/*`. The moment the domain moves, every one of those 404s.
Booking must live here before either domain points at Vercel.

## The one thing that cannot move

🔴 **Rekaz has no payments API.** `POST /reservations/bulk` returns a
`paymentLink` to `https://platform.rekaz.io/i/XXXX`, and the packages
documentation confirms nothing activates until that link is paid. Card entry
therefore stays on Rekaz's domain. Everything before it moves here.

That link is on `platform.rekaz.io`, not `mazj.sa`, so it is unaffected by the
domain move. Confirmed in [`../../rekaz-api-findings.md`](../../rekaz-api-findings.md).

## Decisions taken

Owner, 2026-07-27.

| Decision | Choice |
|---|---|
| Scope | All four products |
| Entry point | A step on each space page: `/spaces/<space>/book` |
| Payment handoff | Plain redirect, no explanatory copy |
| Start date | Match the mazj.sa store: default TODAY, editable |
| Events hall document | Collect it, store it ourselves |
| Prices | Live from Rekaz, inside the booking flow only. Marketing pages stay price-free |
| Legacy store URLs | 301 to the new booking pages |

⚠️ On the payment handoff I recommended a line of copy before the jump, because
an unannounced domain change at the card step is what a scam looks like. The
owner chose a plain redirect. Recorded, not re-litigated: build the redirect.

## Two flows, not one

The products split cleanly by Rekaz's `type`, and the two halves share almost
nothing except the customer step and the handoff.

| | Reservation (`type: 0`) | Subscription (`type: 1`) |
|---|---|---|
| Products | Meeting room, events hall | Shared seat, private office |
| Needs | A date AND a time slot | A start date only |
| Reads | `GET /reservations/slots` | nothing extra |
| Writes | `POST /reservations/bulk` | `POST /subscriptions` |
| Extra | Events hall has 2 required custom fields + 1 file | none |

**Step order, both flows:** choose duration → choose date (+ time, reservations
only) → enter details → review total → pay.

Duration first, because it changes both the price and, for reservations, the
slot geometry: Rekaz returns windows sized by the chosen price's duration, so
the calendar cannot be drawn before a duration exists.

## What the API forces

Each of these was measured, not assumed. Full detail in the findings doc.

- 🔴 **Never hardcode a `priceId`.** They rotate whenever a price is edited in
  the Rekaz dashboard. Resolve from `GET /products` per request.
- 🔴 **`MinQuantity` is required** on the slots endpoint despite being
  documented optional.
- 🔴 **Slot date ranges are padded**, so the response must be re-filtered to the
  day actually requested, and `isOutDated` windows dropped.
- 🔴 **Slots overlap.** A 2-hour price yields 07:00-09:00, 08:00-10:00,
  09:00-11:00. They are a list of start options, not a tiling of the day.
- **Closed Friday and Saturday.** The API returns no slots at all on those days,
  so the date picker must disable them rather than show an empty result.
- **Opening hours differ per product**: meeting room 09:00-21:00 Riyadh, events
  hall 10:00-24:00.
- 🔴 **`nameEn` is Arabic.** Every user-facing product name, price name and
  custom-field label comes from `messages/*.json`, keyed by Rekaz id. Rendering
  anything Rekaz returns into the English site prints Arabic.
- **Do not parallelise Rekaz calls**, and cache reads. See Phase 1.

## Idempotency, finally needed

🔴 **Rekaz has no idempotency keys**, so a double-tapped Book button creates two
reservations and two invoices. This is the feature `idempotency_keys` was built
for and has been waiting on since the backend foundation; `server/CLAUDE.md`
names it explicitly.

Every booking POST goes through `idempotency_begin()` keyed on a client-supplied
key plus a fingerprint of the request. A retry returns the original
`paymentLink` rather than creating a second booking.

Rate limiting applies too: booking is a public write endpoint that creates real
records in MAZJ's operations system.

## The events hall document

Two required custom fields (attendee count, event description) go to Rekaz with
the booking. The commercial-registration file cannot: Rekaz documents no upload
endpoint.

Owner chose to collect and store it. That means a **private Supabase Storage
bucket**, the file linked from the admin dashboard so the team can retrieve it.

⚠️ **This is new personal-data exposure.** MAZJ would hold customers' business
documents, which it does not today. Under PDPL that carries retention and
deletion obligations. The bucket must be private with no public policy, access
only via the admin, and a retention rule decided before launch. Flagged because
the owner accepted it knowingly, and it should not be forgotten by whoever
implements it.

## Legacy URL redirects

Four store paths must 301, and each exists in **two** shapes, because
`mazj.sa/subscription/<slug>` 308s to `mazj.sa/ar/subscription/<slug>`.

⚠️ The `/ar/...` shape collides with this site's own `/ar` locale prefix, so it
reaches the `[...rest]` catch-all rather than failing at the edge. The redirects
must be declared in `next.config.mjs` ahead of locale routing.

## How the mazj.sa store actually behaves

Observed on the live storefront, 2026-07-27, which is the behaviour the owner
asked to match.

**Subscription products:**

| Element | Exact string | Form |
|---|---|---|
| Duration | `نوع الاشتراك` | Radio group, one row per price |
| Start date | `تاريخ بدء الاشتراك` | A button showing a date, opening a calendar |
| Submit | `اشترك الآن` | Price rendered on the button itself |

✅ **Answered: the start date is pre-filled with TODAY** (the button read
`2026-07-27` on that date), and is editable. So: default today, let them change
it. Not tomorrow, which is what this spec originally proposed.

**Reservation products:**

| Element | Exact string |
|---|---|
| Section heading | `الموعد` |
| Calendar toggle | `التقويم` |
| Empty day | `لا يوجد مواعيد في هذا اليوم` |
| Nearest availability | `متاح من الاثنين، 27 يوليو` |
| Jump shortcut | `أقرب تاريخ متاح` |

The date picker is a **horizontally scrolling strip of individual days**, each
labelled day-number plus weekday (`27 اثنين`), running more than a month ahead,
with Previous/Next controls. Fridays and Saturdays are rendered rather than
hidden. The empty state is genuinely good and worth copying: it names the
nearest available date and offers a one-tap jump to it.

🔴 **The store verifies the customer's phone with an OTP before checkout.**
Observed: a `التحقق من رقم الجوال` modal asking for `رقم الجوال` with a country
selector and an `الدخول` button.

**We cannot replicate this.** The Rekaz public API exposes no customer
authentication, no OTP endpoint and no per-customer token; that is §4.3 of the
review letter. Our flow would create the booking with `customerDetails` inline,
i.e. **unverified guest checkout**.

That is a real difference from the current store and it cuts both ways: fewer
steps and better conversion, but nothing stops a fake or mistyped phone number
attached to a real reservation. Since payment still happens on Rekaz's page, an
unpaid junk booking cannot cost money directly, but it can hold a slot. **The
owner should decide knowingly**, and the options are to accept it, to send our
own OTP (Supabase can send SMS, at a cost), or to keep the two subscription
products on the store where verification already exists.

✅ **Owner decision: accept unverified guest checkout.** No OTP. The reasoning
accepted was that payment still happens on Rekaz, so an unverified booking that
is never paid stays `Pending` and costs nothing but a held slot.

✅ **Owner decision: match returning customers silently** by mobile number, so
Rekaz's 284-customer list does not accumulate duplicates of regulars.

🔴 **Silently means silently.** The matched customer's name, email or history is
NEVER rendered back to the page. This form is public and unauthenticated, so
echoing anything found by phone number turns it into a lookup tool: type a
number, learn who it belongs to. The match exists to attach the booking to the
right Rekaz record on the SERVER, and the response says nothing about whether a
match happened.

✅ **Owner decision: fully bilingual**, with English written by us.

Rekaz holds no English, so every product name, price name and custom-field label
needs an English string in `messages/en.json`. 🔴 Key them by **`immutableId`,
never `id`**: price ids rotate on every edit in the Rekaz dashboard, so an
`id`-keyed map silently loses its English the first time someone changes a
price. A test asserts every live price has an English label, so a price added in
Rekaz fails the build rather than quietly rendering Arabic on the English site.

## Open questions

1. **What happens after payment?** Rekaz's hosted page decides where the visitor
   lands, and no return-URL parameter is documented. If none exists, the journey
   simply ends on Rekaz and we cannot show a confirmation.
3. **What happens after payment?** Rekaz's hosted page decides where the visitor
   lands. If it can return them to a URL we choose, we need a confirmation page;
   if not, the journey simply ends on Rekaz.
4. **Webhooks.** 21 events, no signatures. Worth receiving so the admin reflects
   reality, but untestable until this site is deployed, and any payload must be
   re-fetched by id before being trusted.

## Out of scope

Customer accounts, a "my bookings" page, refunds, coupon validation, packages
(zero rows today), and the attendances endpoint.
