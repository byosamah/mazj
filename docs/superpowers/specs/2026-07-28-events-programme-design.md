# The events programme: admin authoring, public registration, self-sorting archive

Design record, 2026-07-28. Owner decisions taken in session; every option below
was chosen explicitly, not inferred.

## The problem

`/events` is presentational. `EventsPage.upcoming` in `messages/{en,ar}.json`
holds three fabricated cards carrying a visible "Example" badge, and
`EventsPage.archive` holds 42 real past events typed in by hand. Nobody can
register for anything, and publishing an event requires a developer to edit two
JSON files and commit.

MAZJ has run 42 events since 2022 across four recurring series. The programme is
one of the strongest things the business has, and the website currently cannot
sell a single seat at one.

## What is being built

1. **Events live in the database**, authored in `/admin/events`, bilingual,
   with a poster uploaded at creation time.
2. **Each event gets its own page**, `/{locale}/events/{slug}`, shareable on
   Instagram, with real `Event` structured data and the registration form.
3. **People register on the site.** Free events confirm immediately. Paid
   events create a real Rekaz order and hand the buyer to Rekaz's checkout.
4. **The archive sorts itself.** An event moves from "coming up" to the archive
   when its end time passes, computed at read time. There is no cron job, no
   status to flip, and no way to forget.
5. **The 42 historical events move into the database** so the archive has one
   source of truth.

## Owner decisions

| Question | Decision |
|---|---|
| Registration | Free sign-up we keep the list for, AND paid events that go to Rekaz checkout |
| Rekaz setup | ONE "Event ticket" product in the Rekaz dashboard, one price per paid event |
| Event pages | Yes, one URL per event |
| Legacy archive | Migrate all 42 into the database |
| Poster image | Uploaded in the admin (Supabase Storage) |
| Capacity | Seat limit, closes when full, no waitlist |
| Paid seats | Held for 30 minutes while the buyer pays, then released |
| Bilingual | English AND Arabic both required to publish |

## 🔴 The one hard constraint, stated before anything else

**Rekaz's public API is read-only for the catalog.** `GET /products` exists;
there is no POST. Probed live on 2026-07-28: the tenant holds exactly four
products, all rooms (meeting room, events hall, open desk, private office).

So this site **cannot create a ticket**. Somebody has to add the price inside
the Rekaz dashboard first. Once it exists, our admin lists it in a dropdown and
everything after that is automatic.

**Tickets must be a SUBSCRIPTION-type product (Rekaz `type: 1`), not a
reservation.** A reservation-type price is only sellable against a slot that
Rekaz reports as available for that product, which means configuring working
hours per event and hoping the event's real window lines up with a generated
slot. A subscription price needs only a start date. The admin dropdown therefore
lists subscription prices only, and says plainly why when nothing qualifies.

⚠️ **Consequence the owner should know:** each ticket sold appears in Rekaz's
subscriptions list as a one-day subscription. That is the only shape Rekaz
offers for "sell this thing for money and give me a payment link". It is not a
workaround we chose over something better; there is nothing better.

## Data model

Two tables, `public.events` and `public.event_registrations`, both RLS-enabled
with zero policies and grants revoked from `anon` / `authenticated`, per the
posture in `server/CLAUDE.md`. Reachable only by the secret key.

### `events`

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `slug` | unique, ASCII, the URL segment |
| `status` | `draft` / `published` / `cancelled` |
| `title_en`, `title_ar` | required |
| `summary_en`, `summary_ar` | one line, the card |
| `description_en`, `description_ar` | the detail page body |
| `host_en`, `host_ar` | "Asma Habib" |
| `series`, `edition` | optional, e.g. `coffeeSketch` / `V10` |
| `starts_at`, `ends_at` | timestamptz, UTC |
| `date_precision` | `day` or `month`. Only the legacy import uses `month` |
| `location_en`, `location_ar` | defaults to the events hall |
| `poster_path` | Supabase Storage object path, null allowed |
| `capacity` | int, null means unlimited |
| `rekaz_price_immutable_id` | null means the event is free |
| `ticket_amount` | display-only snapshot taken when the price was picked |

`registration_closes_at` is deliberately **absent**. Registration closes when
the event starts. One rule, no field, nothing to misconfigure. Adding a
different cutoff later is one migration.

🔴 `rekaz_price_immutable_id`, never `id`. Price ids rotate whenever anyone
edits a price in the Rekaz dashboard, so an event stored against `id` would stop
being buyable the first time the owner corrected a typo in the amount. The
immutable handle survives and the live `id` is resolved at purchase time. This
is the same rule `server/services/booking.ts` already follows.

`ticket_amount` is a **snapshot for display only** and is never used to charge
anybody. The amount actually billed is whatever that immutable price costs at
the moment of purchase, resolved server-side. Storing a price and billing it
would be the exact class of bug the booking service exists to prevent.

### `event_registrations`

| Column | Notes |
|---|---|
| `id` | uuid pk |
| `event_id` | fk, cascade delete |
| `full_name` | cleaned and bounded to 120 chars |
| `email` | optional, bounded to 254 |
| `phone_e164` | required, normalised, check-constrained |
| `status` | `confirmed` / `pending_payment` / `expired` / `cancelled` |
| `hold_expires_at` | set on `pending_payment` only |
| `rekaz_reference` | the subscription code, once Rekaz answers |
| `locale`, `ip_hash` | provenance; the IP is a salted HMAC, never an address |

`unique (event_id, phone_e164)`: one seat per mobile number per event. A
double-tap therefore cannot produce two rows, which is what makes the free path
naturally idempotent.

### Seat counting, and the race that would otherwise sell the last seat twice

A seat is taken when a registration is `confirmed`, OR is `pending_payment`
with `hold_expires_at > now()`. Expired holds stop counting automatically, so
the 30-minute release needs no scheduled job.

🔴 **The claim is a SQL function holding a row lock on the event**, not a count
followed by an insert. Counting and then inserting from application code lets
two concurrent requests both read "1 seat left" and both insert. Every
alternative that stays in application code has the same hole. So:

```
public.event_claim_seat(...) returns (outcome, registration_id, ...)
  select ... from public.events where id = p_event_id for update
  -- everything below is serialized per event, which is exactly the
  -- granularity we want: two different events never block each other
```

Outcomes: `claimed`, `full`, `duplicate`, `closed`, `not_found`. The service
maps each to its own copy. `duplicate` is reported to the visitor as "you are
already on the list", not as an error, because from their side it is good news.

Expired holds are cleaned opportunistically inside the same function (roughly
one call in fifty), the same trick `rate_limit_hit` uses to stay bounded without
depending on `pg_cron`.

## The write path (`server/services/event-registration.ts`)

Mirrors `server/services/booking.ts`, which is the reference implementation for
"a stranger is POSTing to us".

1. Load the event. Refuse unless `published` and not yet started.
2. Normalise the mobile through `server/domain/phone.ts`. This module has had
   **no caller** since `leads` was dropped; it finally gets one. It handles
   Arabic-Indic digits, which is whether the Arabic half of the site works.
3. Clean and bound the name and email through `server/domain/text.ts`. A public
   form writing unbounded text into an internal screen is a real problem, and a
   control character in it is a 503 blaming our database for their input.
4. **Rate limit on two dimensions, in the order the booking service established.**
   Per-origin (10/hr) is charged first and short-circuits. Per-mobile (5/hr) is
   charged only after the request is known to be well-formed and non-replayed.
   🔴 That ordering is the mitigation, not a detail: the mobile bucket is keyed
   on a **victim**, so charging it early lets throwaway requests carrying a
   stranger's number lock the real owner out of registering.
5. Claim the seat atomically.
6. **Free event:** status `confirmed`. Done. The visitor sees a confirmation.
7. **Paid event:** status `pending_payment` with a 30-minute hold, then:
   - claim an idempotency key (`beginIdempotent`), because Rekaz has none and a
     double-tap otherwise creates two orders and two invoices;
   - resolve the price by `immutableId` across the live catalog;
   - 🔴 look the customer up by mobile and send `customerId` if Rekaz already
     knows them. Rekaz returns **403** for `customerDetails` carrying a mobile
     that already belongs to a customer. This is not optional and removing it
     took booking down for every returning customer on 2026-07-28;
   - create the subscription, absolutise the payment link (Rekaz returns a
     **relative** path and redirecting to it raw lands the buyer on our own
     404), store the reference, return the link.
8. On an indeterminate upstream failure, hold the idempotency key and release
   the seat is **not** safe, so the same `markIndeterminate` discipline applies:
   the key is completed with a sentinel and the visitor is told to make contact
   rather than being invited to create a second order.

Errors return a **code**, never a message. `AppError.message` on this path is
assembled from up to 300 characters of Rekaz's raw Arabic response plus their
traceId and our internal path, and a Server Action's returned value is not
redacted by Next. Copy is rendered from `messages/*.json` by code.

## Poster upload

Supabase Storage bucket `event-posters`, public read, writes only through the
secret key from an authenticated admin action.

- MIME allowlist: jpeg, png, webp. Checked from the bytes, not the filename.
- Max 5 MB.
- The stored object name is generated, never the uploaded filename. A
  user-supplied filename in a public URL is a path-traversal and content-type
  surprise waiting to happen.
- `MediaFrame` renders a plain `<img>`, so a remote Supabase URL needs no
  `next.config.mjs` change and no `next/image` remote pattern.

An event with no poster renders the `.dot-field` texture the quiet routes
already use, rather than a broken frame or a stock photo.

## Public routes

```
/{locale}/events                     list: upcoming, then the archive
/{locale}/events/{slug}              one event, and its registration form
/{locale}/events/{slug}/calendar.ics the event as a calendar file
```

Both pages render dynamically. The site is unlaunched, Supabase is 39 ms away in
Frankfurt, and the seats-remaining figure is the kind of number that must not be
a minute old. The list query is wrapped in a 60-second cache the way the admin
dashboard's is, because a marketing list does not need to be to the second.

### 🔴 `Event` JSON-LD becomes legitimate, and the ban is lifted

`app/[locale]/events/page.tsx` and `app/CLAUDE.md` both carry a red warning
never to add `Event` structured data here, because the entries were fabricated
examples with real host names attached, and fabricated structured data is a
**site-wide** manual action, not a page-scoped one.

The ban was conditional and the condition is now met: it says "revisit ONLY when
`upcoming` holds confirmed events with real ISO dates". Markup is emitted for
**published, future** events only, on the detail page only. Draft, cancelled and
past events emit nothing. Both comments get rewritten to say so, because a
warning that is no longer true is worse than no warning.

### The archive

One continuous list, grouped by year, newest first, exactly as `PastEvents.tsx`
renders it today. Rows for events that have a detail page become links. The
`v` edition marker and the year `<h2>` grouping both survive; they are good and
they are already accessible.

## The admin

```
/admin/events            list, with a New event button
/admin/events/new        the create form
/admin/events/{id}       edit, plus who registered, plus CSV download
```

One entry in `app/admin/nav.ts` and the guard, chrome and active state come for
free. 🔴 Every page calls `requireAdmin()` **above its first data read**, and
every Server Action calls it too: an action is a public POST endpoint reachable
by id from the client bundle, so sitting under `(protected)/` protects nothing.
`test/admin-page-guards.test.ts` already fails if a page omits it.

The create form is two columns, English and Arabic, and refuses to publish with
either side empty. Saving as a draft with one side empty is allowed, because
half-written is a normal state and losing the work is not.

The ticket field is a live dropdown built from `GET /products`, filtered to
subscription-type prices. When the "Event ticket" product does not exist yet,
the field explains what to create in the Rekaz dashboard instead of rendering an
empty select.

## Migrating the 42

Generated from `EventsPage.archive` in both message files, matched by array
index (the two files are required to keep every array the same length in the
same order, and the i18n rule in `CLAUDE.md` is what guarantees it).

- `"1 February"` + `y: "2025"` becomes `2025-02-01` at `day` precision.
- `"February"` + `y: "2024"` becomes `2024-02-01` at `month` precision, and
  renders as "February 2024" rather than inventing a first-of-the-month.
- `s` and `v` map to `series` and `edition`.
- All are `published` with `ends_at` in the past, so they land in the archive by
  the same rule as everything else. No special case.

`EventsPage.archive` and `EventsPage.upcoming` are then deleted from **both**
message files. The chrome around them (labels, empty states, CTAs) stays.

🔴 If the database is unreachable, the archive section renders an honest failure
panel. It does **not** fall back to hardcoded copy. A silent fallback is how a
broken data path stays broken for a month.

## Testing

- `test/rls.integration.test.ts` gains both new tables. They must be refused
  with the publishable key, like every other table.
- Seat claiming: concurrent claims on a one-seat event produce exactly one
  `claimed` and one `full`.
- Hold expiry: a `pending_payment` row past `hold_expires_at` stops counting.
- Date precision formatting, in both locales.
- Slug generation and uniqueness.
- i18n key parity for the new namespace, by leaf-key PATH, never by value
  (Arabic uses Arabic-Indic numerals, so value comparison false-fails).
- `test/admin-surface.test.ts`: `/admin/events` absent from the sitemap.
- Sitemap: published events present, drafts absent.

## Deliberately out of scope

Waitlists, confirmation emails, attendee check-in, ticket transfers, refunds,
recurring-series automation, and reading payment status back from Rekaz
webhooks. Each is a real feature and none of them was asked for. The Rekaz
webhook receiver in particular is unsigned (21 events, no HMAC, anyone who
learns the URL can forge a confirmation) and needs its own design.

An event's paid registration therefore sits at `pending_payment` until an admin
confirms it, or until the hold expires. The admin list shows both states
distinctly, because "nobody paid" and "we cannot tell" are different facts.
