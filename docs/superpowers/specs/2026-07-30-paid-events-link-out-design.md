# Paid events link out to the Rekaz store

**Decided by the owner, 2026-07-30.** Supersedes the on-site ticket purchase
built on 2026-07-28.

## The decision, in one sentence

**A paid event does not sell a ticket on this site. It shows the live price and
sends the buyer to that product's page on the Rekaz store.** Free events are
untouched.

## Why this, and not what was built

The on-site purchase path assumed a ticket had to be a Rekaz **subscription**
product, because that is the only product type with a usable write endpoint
(`POST /subscriptions`). The owner has chosen a **one-time product** instead
(Rekaz `type: 2`, `typeString: "Merchandise"`), and Rekaz publishes no write
endpoint for those: the verified list is `POST /reservations/bulk`,
`POST /subscriptions`, `POST /customers`, `POST /attendances`
(`docs/rekaz-api-findings.md`). Their own storefront sells merchandise through
an add-to-cart flow, not a single call.

Rather than reverse-engineer an undocumented purchase API and prove it with a
real charge against a live tenant, the site hands the buyer to the storefront
that already does this correctly.

This is the same ruling made about `/admin` on the same day: **stop keeping a
second copy of records that live in Rekaz.**

## The live product this was designed against

Measured 2026-07-30 via `GET /products`:

| Field | Value |
|---|---|
| name | فعالية تجريبية |
| slug | `faalyh-tjrybyh` |
| product id | `3a22bf80-6d12-1059-f748-28a2e4181007` |
| type | `2` (`Merchandise`) |
| price id == immutableId | `3a22bf80-6d12-fdab-c1c5-fa9ac86fc0b0` |
| amount | 50 SAR |
| stock | unlimited, max 1 per order |
| store page | `https://mazj.sa/ar/merchandise/faalyh-tjrybyh` (200) |

The catalog went from 4 products to 5 between 2026-07-28 and 2026-07-30. That
fifth product is why the admin's ticket dropdown looked broken: it was filtered
out for being the wrong type, so the only option shown was "Free".

⚠️ The product is literally named "Trial Event". It must be renamed in the Rekaz
dashboard before a real event points at it, or that is the line item on a
customer's invoice.

## What a paid event looks like after this

**Admin (`/admin/events/new` and the edit page)**

- The **Ticket** dropdown lists one-time products as well as subscriptions. Room
  products stay excluded, so a mis-click can never sell a 34,000 SAR private
  office as an event ticket.
- 🔴 **The Seats field is disabled, with a reason, whenever a ticket is
  selected.** After this change it controls nothing for a paid event. A live
  number box that does nothing is how somebody types 30, sells 90, and finds out
  at the door.
- The explainer under the ticket is rewritten. It currently promises
  "Each ticket sold shows up in Rekaz as a one-day subscription", which becomes
  false.

**Public (`/events/<slug>`)**

- Free event: unchanged. Form, seat count, sold-out state, all as today.
- Paid event: no form. The live Rekaz price, and one button to the store page in
  the reader's own language. Both `/en/...` and `/ar/...` return 200 on the
  store, so an English reader gets an English shell. The product name over there
  is Arabic regardless, because Rekaz holds no English content for this tenant.

## Deliberately NOT built

Accepted by the owner as a known blind spot, not an oversight:

- **No attendee list and no CSV** for a paid event. Who bought a ticket lives
  only in Rekaz.
- **No confirmation that anyone paid.** The site never learns the outcome.
- **Our own `capacity` does not apply.** No row is written, so `seats_taken`
  stays 0 and the Seats box is read-only for a ticketed event.

The owner counts tickets in the Rekaz dashboard. For a 30-seat hall that is a
reasonable trade against building and maintaining a purchase integration.

✅ **Two of the original four were closed on 2026-07-31**, see the follow-up at
the end of this document: the seat count and the sold-out state came back, read
from Rekaz instead of from us.

## 🔴 The one accepted risk

**The store link is a `mazj.sa` path, and the launch plan has `www.mazj.sa`
serving THIS site.** On that day every paid event's button points at this app,
which does not have that route, and every buyer lands on a 404 with the ticket
unsold.

There is no Rekaz-hosted alternative address today. Probed 2026-07-30:
`mazj.rekaz.io`, `mazj.rekaz.sa`, `store.mazj.sa` and `shop.mazj.sa` all fail to
resolve. `mazj.sa` is the only address this store has.

**The owner has been told twice and has accepted it as a launch-day chore rather
than a blocker.** The mitigation carried in this design is the cheapest one
available and costs no extra work: the store origin is a single named constant,
so pointing it at a subdomain later is a one-line change, not a hunt through
components. This is the same family of problem already solved for the four
booking products, which is recorded in the root `CLAUDE.md` launch plan.

## Files

| Path | Change |
|---|---|
| `server/rekaz/types.ts` | add `merchandise: 2` to `REKAZ_PRODUCT_TYPE` |
| `server/services/event-tickets.ts` | `listTicketPriceOptions` accepts subscription **and** merchandise; **delete** `createTicketOrder` |
| `server/rekaz/store.ts` | **new.** The store origin constant, `rekazStoreUrl(product, locale)` and `storeSharesDomainWith(origin)`. Pure, no config read, no network. ⚠️ Landed in `rekaz/`, NOT `domain/`, because `server/domain/` may import only `server/core/` and this is Rekaz-specific knowledge. It also ended up with ZERO imports: `check:env` loads it under Node's raw TS stripping, where an extensionless relative import does not resolve. |
| `server/services/event-registration.ts` | delete `purchaseTicket` and the paid branch of `registerForEvent` |
| `app/[locale]/events/_lib/events.ts` | `loadTicketAmount` also returns the store URL (it already resolves the parent product, so this is free) |
| `app/[locale]/events/[slug]/page.tsx` | paid branch renders the price and the outbound button instead of `EventRegistration` |
| `components/events/EventRegistration.tsx` | drop the paid path |
| `app/admin/(protected)/events/EventForm.tsx` | explainer copy; disable Seats when a ticket is selected |
| `messages/en.json` + `messages/ar.json` | the button label and the paid-event line, **both files, same edit** |
| `lib/schema.ts` | `eventSchema` already takes `offer: {price, url}`; the `url` becomes the store URL |

🔴 The URL path segment depends on the product type: `/{locale}/merchandise/{slug}`
for a one-time product, `/{locale}/subscription/{slug}` for a subscription one.
Both shapes are live and both were verified 200 on 2026-07-30. The bare
`/merchandise/{slug}` form 308s to `/ar/...`, so always build the locale in.

## Data

**No migration.** Measured 2026-07-30: 41 events, all published, **zero** with a
`rekaz_price_immutable_id`. Nothing existing changes behaviour.

`events.ticket_amount` (the display snapshot) and
`events.rekaz_price_immutable_id` both stay. So do
`event_registrations.status = 'pending_payment'`, `hold_expires_at` and
`rekaz_reference`, even though nothing will write them for now. Dropping columns
is a separate, harder-to-reverse decision and does not need to ride along.

## Documentation that becomes false

- `server/CLAUDE.md`: "Tickets are Rekaz SUBSCRIPTION-type prices" and "Every
  ticket sold appears in Rekaz's SUBSCRIPTIONS list as a one-day entry".
- `server/services/event-tickets.ts` docblock: the whole "a ticket has to be a
  SUBSCRIPTION-type product" rationale.
- `app/CLAUDE.md`: the `Event` JSON-LD rule that `offers.price` is the live Rekaz
  figure stays true and load-bearing. Only the `url` changes.
- `docs/rekaz-api-findings.md`: add the merchandise product type, the storefront
  URL shapes, and the fact that no merchandise write endpoint was found.

## Tests, as built

- `server/rekaz/store.test.ts`: the path segment per product type, the locale
  always written in, `null` for an unknown type, and that the literal type
  numbers still equal `REKAZ_PRODUCT_TYPE` (which the module deliberately does
  not import). Plus `storeSharesDomainWith` in both directions.
- `server/services/event-registration.ticketed.test.ts`: a ticketed event is
  refused, and refused BEFORE `claimSeat` is called. Carries a free-event control
  so a guard that refused everything could not pass, and pins `holdSeconds: 0`.
  **Mutation-tested**: removing the guard turns it red.
- `test/rekaz.integration.test.ts`: the live product-type assertion moved from
  the literal `[0, 1]` to `REKAZ_PRODUCT_TYPE`, and the duration-or-billingPeriod
  rule is now scoped to the two booking flows. A one-time price carries neither,
  correctly.

⚠️ **The launch collision is a `check:env` WARNING, not a test.** A test cannot
carry it: `.env.local` ships `NEXT_PUBLIC_SITE_URL` empty, so a CI assertion
would pass trivially today and still pass at launch, which is worse than nothing.
`npm run check:env` prints the store origin every run and warns when the two
domains match; verified to fire on `www.mazj.sa` and stay quiet on `www.mazj.org`.

## Verified against the running app

A `zz-test-*` fixture was published, rendered, and deleted (cleanup asserted, 41
events before and after). Measured on a production build, both locales:

| Check | Result |
|---|---|
| Store link | `https://mazj.sa/en/merchandise/faalyh-tjrybyh` and the `/ar/` twin |
| Opens in a new tab | `target="_blank" rel="noopener noreferrer"` |
| Form on a paid event | none |
| Live price | `SAR 50` / `٥٠ ر.س.` |
| JSON-LD `offers` | `price: 50`, `url` = the store page, not this page |
| Free event, unchanged | form present, 5 inputs, "Confirm my seat", no store link, no offers node |

## Decisions taken during implementation

1. **The outbound button opens in a new tab.** `CtaButton` already does this for
   any `http(s)` href, so it needed no new code and matches how every other
   external MAZJ link behaves.
2. **The events LIST shows no price.** `TONE.md` keeps money off marketing pages
   and the list is one; the price appears on the event page, which is the buying
   moment and where the relaxed rule already applies.
3. **Seats is read-only, not disabled, when a ticket is picked.** A disabled
   input submits nothing, so saving any unrelated field would have arrived with a
   blank capacity and silently wiped a stored number.
4. 🔴 **`chargedAmount()` replaced raw `price.amount` on all three event-ticket
   sites** (the admin dropdown label, the admin snapshot, the public page). Found
   in self-review, and it is a real defect this change made worse rather than a
   tidy-up: the figure on the page is now the last number a buyer sees before a
   storefront MAZJ does not control bills them, so a discounted Rekaz price would
   have advertised 50 while the store took 40. The booking path already used
   `chargedAmount` everywhere with a comment saying "NOT `price.amount`"; the
   event path never had.

---

# Follow-up, 2026-07-31: read what Rekaz already knows

The owner asked the obvious question about the design above: *"when I create a
product on Rekaz it shows in the admin and I can choose it, so why not fetch the
details and the image from it too, why do it twice?"*

## What was measured before answering

| Claim | Result |
|---|---|
| A new Rekaz product appears in the dropdown with no deploy | ✅ true, confirmed on a product the owner created that morning |
| The price is already shared | ✅ true, resolved live on every page load |
| Rekaz holds a product IMAGE | ❌ **false.** No image field on any of the 6 products; the storefront product page shows only the tenant logo and a VAT badge; the only `image` in that page is the WebSite JSON-LD node. `RekazProductProvider.image` already carried the comment "Always null for this tenant" |
| Rekaz holds an English name or description | ❌ **false.** `nameEn` is byte-identical to `nameAr` on every product, pinned by an existing test |
| Rekaz holds the date, host, location or series | ❌ **false.** A merchandise product has no date at all |
| Rekaz holds STOCK | ✅ **true, and we were ignoring it** |

So the real duplication was **two fields**, name and description, both Arabic
only. Not the image, not the dates.

## Why sync was refused and prefill was built instead

🔴 **41 of MAZJ's 41 events are free and have no Rekaz product at all.** If an
event's identity came from a product, free events would need a different
authoring path from paid ones, which is two forms for one thing. The price is
Rekaz's to own because Rekaz charges it; the words are the site's, because the
site is bilingual and Rekaz has no English.

**Prefill** keeps one form and one source of truth: picking a ticket fills the
Arabic title and description **only when they are blank**, never overwrites, and
never runs again on its own.

## Built

1. **`htmlToPlainText`** in `server/domain/text.ts`. Rekaz stores a description
   as HTML (`<p>بلا بلا بلا</p>`) and the field it prefills is plain text
   rendered with its line breaks preserved. Flattened on the server so markup
   never reaches the browser. ⚠️ It is **not a sanitiser** and its docblock says
   so; nothing may render its output as HTML.
2. **`ticketStock()`** in `server/services/event-tickets.ts`, returning the same
   shape `seatState` gives a free event so the page treats both identically.
3. **`resolveTicketPrice` stopped treating sold-out as an error.** See below.
4. **The admin form's two Arabic fields became controlled**, the only two on the
   form, so the prefill can write to them without reaching into the DOM by id.

## 🔴 The bug found on the way

Being out of stock returned a `conflict`, and the admin maps `conflict` to
*"That ticket price is no longer in Rekaz. Pick another, or set the event to
free."* A ticket that had merely sold out therefore told the owner its price was
deleted, while prescribing the single irreversible action on that screen: setting
a sold-out event to free makes every later sign-up free.

**The general rule this teaches:** never route a temporary inventory state
through an error channel whose consumers read it as permanent.

## What is inferred rather than measured

⚠️ Both ticket products sit on `isUnlimited: true`, so `remainingQuantity` has
**never been observed carrying a number**. Its meaning is read off its name. The
code therefore trusts `isOutOfStock` (a plain boolean, always read) outright, and
treats any missing or non-numeric quantity as "say nothing" rather than as zero,
because a false sold-out costs a real sale. `event-tickets.stock.test.ts` pins
that asymmetry, and is the place to check the inference the day somebody sets a
real quantity.

## Verified against the running app

The stock states cannot be produced without writing to Rekaz, so they were driven
through a temporary environment probe on a production build, against a published
fixture, both states rendered and compared:

| State | Panel | Buy button | Seats row | Price |
|---|---|---|---|---|
| 3 remaining | "Get your ticket" | present | "3 seats left" | SAR 100 |
| sold out | **"Fully booked"** | **gone** | "Fully booked" | still shown |

⚠️ **Two false passes were caught during that check and are worth recording.**
First, an early `return` probe made the rest of the function unreachable and
TypeScript drops narrowing in unreachable code, producing a type error that read
as a real defect in code that had just typechecked clean. Second,
`pkill -f "next start"` does **not** match the running server, so the second
probe hit the first probe's process and rendered a byte-identical page: the two
states only differed once the port was freed by pid. **Compare the two outputs,
never just the status code.**

⚠️ **The prefill itself was not machine-verified.** There is no DOM test
environment in this repo and adding one would churn the lockfile in a shared
tree. Its pure parts are covered (`htmlToPlainText`, and a live assertion that no
ticket option's description contains angle brackets); the click behaviour needs a
browser with an admin session.
