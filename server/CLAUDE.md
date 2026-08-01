# `server/`: backend mechanics and gotchas

Scope: the Supabase-backed backend added 2026-07-27. Before this the repo was
100% frontend: no API routes, no data layer, no database.

- **The layer contract, for humans** → [`./README.md`](./README.md). Read that
  first if you are adding anything here; it explains what each layer may import
  and how to add a table. This file is the mechanics, the traps and the
  verification recipes.
- Design records →
  [`../docs/superpowers/specs/2026-07-27-backend-foundation-design.md`](../docs/superpowers/specs/2026-07-27-backend-foundation-design.md)
  (the foundation) and
  [`../docs/superpowers/specs/2026-07-27-admin-dashboard-design.md`](../docs/superpowers/specs/2026-07-27-admin-dashboard-design.md)
  (the admin, and Phase 2's boundary)
- 🔴 **What the Rekaz API actually DOES**, probed live →
  [`../docs/rekaz-api-findings.md`](../docs/rekaz-api-findings.md). Read this
  before the review letter below; where they disagree, this one was measured.
- 🔴 **Strategic context** → [`../docs/rekaz-api-review-ar.md`](../docs/rekaz-api-review-ar.md).
  This backend exists to fill the gaps that document identifies. Read it before
  designing anything that touches bookings.
- Routes, layout, metadata → [`../app/CLAUDE.md`](../app/CLAUDE.md) · UI →
  [`../components/CLAUDE.md`](../components/CLAUDE.md) · project-wide →
  [`../CLAUDE.md`](../CLAUDE.md)

## What exists

**Five tables**, all in `public`, all RLS-enabled with zero policies and grants
revoked, i.e. reachable only by the secret key:

| Table | Purpose |
|---|---|
| `rate_limit_counters` | Fixed-window counters, one row per bucket, driven by `rate_limit_hit()`. |
| `idempotency_keys` | Stored responses keyed by `(scope, idempotency_key)`, driven by `idempotency_begin()`. |
| `events` | MAZJ's own programme, bilingual, admin-authored. 41 historical rows imported 2026-07-28. |
| `event_registrations` | Who signed up. One row per mobile per event, forever. |
| `startup_applications` | The startups & builders offer: who applied, what was decided, the code issued, and whether the applicant was ever actually told. Added 2026-07-28. |

### The events programme (added 2026-07-28)

Design record:
[`../docs/superpowers/specs/2026-07-28-events-programme-design.md`](../docs/superpowers/specs/2026-07-28-events-programme-design.md).

🔴 **An event moves itself into the archive. There is no cron and no status to
flip.** `eventPhase` compares `ends_at` to now at READ time. Keying on
`starts_at` instead would file a three-hour workshop under history the moment
its doors opened.

🔴 **`event_claim_seat` is a SQL function holding `for update` on the event row,
and it must stay one.** Counting seats and then inserting from TypeScript is two
statements, and two concurrent requests both read the last free seat before
either writes. No amount of care in application code closes that: the gap is
BETWEEN the statements. `test/events-seats.integration.test.ts` fires 12
simultaneous claims at a one-seat event and asserts exactly one `claimed`.

🔴 **"A seat is taken" is defined ONCE, in SQL.** `event_claim_seat` enforces it
when selling and `event_seats_taken` reports it when displaying. Counting rows in
TypeScript for the display side would restate the rule in a second language, and
the drift shows up as a page advertising seats the claim function refuses to
sell. The 30-minute payment hold needs no sweep for the same reason: an expired
hold simply stops counting, in both places at once.

🔴 **This endpoint has a rate limit and NO `idempotency_keys`, deliberately.**
The rule above says any public write endpoint needs both. Here the resource
itself is unique (`unique (event_id, phone_e164)`), so the CONSTRAINT is the
idempotency key, and it is strictly stronger than a client-supplied string,
which a caller can vary at will. The one case a client key would additionally
cover is a Rekaz write that timed out, where a later retry might create a second
order. That is accepted here and NOT accepted in booking, because an unpaid room
reservation holds a room while an unpaid event subscription holds nothing: our
own row holds the seat either way.

🔴 **A PAID EVENT IS NOT SOLD ON THIS SITE. Owner decision, 2026-07-30.**
`/events/<slug>` shows the live Rekaz price and links to that product's page on
the Rekaz storefront. Design record:
[`../docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md`](../docs/superpowers/specs/2026-07-30-paid-events-link-out-design.md).

A ticket is a Rekaz **one-time product** (`type: 2`, `typeString: "Merchandise"`),
and **Rekaz publishes no write endpoint for one**: the documented writes are
`POST /reservations/bulk`, `/subscriptions`, `/customers` and `/attendances`, and
their own storefront sells merchandise through an add-to-cart flow rather than a
single call. So the catalog is read-only in both directions here: the owner
creates the product and its price in the Rekaz dashboard, the admin picks it from
a dropdown, and the buyer completes the purchase over there.

`listTicketPriceOptions` admits merchandise AND subscription types and excludes
the four ROOM products, so the dropdown cannot offer "private office, one year,
34,000 SAR" one mis-click from a 50 SAR ticket. Reservation-type prices are
excluded too: they are only sellable against a slot Rekaz reports as available,
which would mean configuring working hours per event.

⚠️ **What that costs, accepted by the owner:** a paid event has **no attendee
list, no CSV and no confirmation that anyone paid**. Nothing is written here at
all.

✅ **The seat count and the sold-out state came BACK on 2026-07-31**, read from
Rekaz rather than from us. `ticketStock()` maps a product's `isOutOfStock` and a
price's `stock.remainingQuantity` onto the same shape `seatState` gives a free
event, so the page renders both identically: "3 seats left" at or below 8 left,
"Fully booked" when it is out, and nothing at all when the merchant set no limit.
🔴 The two counters may never be crossed: `EventView.seats` counts rows in
`event_registrations`, a paid event writes none, so reading it for a ticketed
event reports a capacity of thirty as thirty seats free forever.

⚠️ **The quantity fields are INFERRED, and only `isOutOfStock` is measured.**
Both live ticket products sit on `isUnlimited: true`, so `remainingQuantity` has
never been observed holding a number. Anything missing or non-numeric therefore
resolves to "say nothing", never to zero: a false sold-out costs a real sale.
`server/services/event-tickets.stock.test.ts` pins that asymmetry.

🔴 **BEING SOLD OUT IS NOT AN ERROR, and it used to be.** `resolveTicketPrice`
returned a `conflict` on `isOutOfStock`; the admin maps `conflict` to *"That
ticket price is no longer in Rekaz. Pick another, or set the event to free."* So
a ticket that had simply sold out told the owner its price was deleted while
prescribing the one irreversible action on that screen. Setting a sold-out event
to free makes every later sign-up free. Never route a temporary inventory state
through an error channel that a caller reads as permanent.

🔴 **`registerForEvent` REFUSES a ticketed event**, above every other rule and
before any rate-limit charge. The public page not rendering a form is not access
control: a Server Action is a public POST endpoint reachable by its id from the
client bundle, so without that check a crafted request would claim a FREE seat on
a paid event.

⚠️ **`createTicketOrder` and the 30-minute payment hold were DELETED on
2026-07-30**, so a grep finds nothing; both are in git. `attachRekazOrder` and
`getRegistrationById` in `db/events.ts` lost their only caller in the same change
and are kept as reference, like `bookableRooms`. The
`event_registrations.status = 'pending_payment'`, `hold_expires_at` and
`rekaz_reference` columns stay: dropping a column is harder to reverse than
leaving one unwritten, and `event_claim_seat` still takes `holdSeconds` (passed
`0` on every call) because an expired hold stops counting in both the claim and
the count, so the mechanism costs nothing while unused.

⚠️ **The storefront is served from `mazj.sa`, and the launch plan has
`www.mazj.sa` serving THIS site.** On that day every ticket button points at a
route this app does not have. The owner knows and accepted it as a launch-day
chore; probed 2026-07-30, `mazj.rekaz.io`, `mazj.rekaz.sa`, `store.mazj.sa` and
`shop.mazj.sa` all fail to resolve, so `mazj.sa` is currently the store's only
address. The origin lives once, in `rekaz/store.ts`, and `npm run check:env`
warns when the two domains match. It warns rather than throws on purpose: a boot
refusal over a link would take the booking flow down with it.

⚠️ **`rate_limit_counters` gained its first real caller on 2026-07-27**: the
admin magic-link request in `services/admin-auth.ts`. That endpoint is public
and sends email, which is exactly the test this section set. The paragraph below
still applies to `idempotency_keys`, which remains uncalled until something
POSTs a booking.

🔴 **`idempotency_keys` still has ZERO callers, and that is a known open
question, not an oversight.** They were built as part of the foundation, before the owner had
specified what the product needs. `leads`, the only thing that ever used them,
was dropped on 2026-07-27 for exactly that reason. They survive it because,
unlike `leads`, they encode no assumption about the product: a rate limiter does
not care what it limits, and idempotency does not care what it protects.

The decision is deferred until the owner describes the features, and the test is
simple: **any public write endpoint** (a form, a signup, an RSVP, a booking)
needs both. A read-only feature, or one that stays entirely on Rekaz, needs
neither. If the features turn out not to need them, drop them; it is one
migration and the code is small.

One argument is not speculative. `docs/rekaz-api-review-ar.md` §4.4 records that
**Rekaz has no idempotency keys**, and that a double-tapped booking button can
create two bookings. If any feature books through this site, `idempotency_keys`
is required rather than optional.

⚠️ Do not quietly delete either one to "clean up", and do not build features on
them without checking this section first. Ask the owner.

**Two feature areas**, added 2026-07-27 with the admin dashboard:

| Module | Purpose |
|---|---|
| `rekaz/` | Typed, server-only client for the Rekaz Merchant Public API. See below. |
| `services/admin-auth.ts` | Gate 1 of the admin's three access gates, plus the magic-link verification. |
| `services/booking.ts` | 🔴 The booking write path. Rate limit, idempotency, server-side price resolution, slot re-check. Everything the browser sends is a suggestion. |
| `rekaz/booking.ts` | The two Rekaz writes, plus `absolutePaymentLink`. |
| `rekaz/store.ts` | Rekaz's STOREFRONT (not API) URL per product, and the one place its origin is written. 🔴 Zero imports on purpose: `check:env` loads it under Node's raw TS stripping, where a relative extensionless import does not resolve. |
| `domain/spaces.ts` | Our `/spaces/<slug>` URLs to Rekaz product slugs. |
| `domain/admin-access.ts` | The `@mazj.org` rule itself. Shared by all three gates. |
| `domain/riyadh-time.ts` | UTC to `Asia/Riyadh`. Pure. |
| `supabase/session.ts` | The request-scoped client, carrying a signed-in user. |
| `services/startup-application.ts` | The startups offer: submit, decide, resend, redeem. Owns its two rate-limit dimensions and its idempotency. |
| `domain/startup-offer.ts` | Codes, references, the 30-day expiry, the stage/space vocabularies. Pure. |
| `email/` | Resend over plain `fetch` (no dependency), bilingual copy, and the four branded templates. |

**One endpoint**, `runtime = "nodejs"`, `dynamic = "force-dynamic"`:

| Route | Purpose |
|---|---|
| `GET /api/health` | Calls `health_ping()` and reports latency. A health check that cannot fail tells you nothing. |

🔴 **`health_ping()` must never gain a dependency on an application table.** The
probe originally queried `leads`, so dropping that table took the health endpoint
down with it. A liveness check should depend on nothing but the database being
reachable.

Enumerated columns use `text` + `check` rather than Postgres enums, because
adding a value to an enum inside a transaction is restricted and dropping one is
impossible, whereas a check constraint is a single `ALTER`.

### `leads` was dropped on 2026-07-27

It was the foundation's proving slice: it demonstrated the whole path end to end
(validation, rate limiting, idempotency, Arabic-Indic phone normalisation, RLS,
error mapping) and nothing on the site ever called it. The owner had not yet
specified what the product needs, and a speculative table does not belong in
production.

**It is recoverable from git** (commit `64abee4`): the table, the domain rules,
the zod schema, the service, the route and the tests. It held 0 rows when
dropped, so no data was lost. `test/rls.integration.test.ts` asserts it stays
gone, so a stale migration cannot quietly resurrect it.

`server/domain/phone.ts` was **kept** despite being its only consumer. It is
pure, tested, has no database or runtime footprint, and encodes knowledge that is
expensive to rediscover (Arabic-Indic and Persian digits, and the `+966 (0)5…`
trunk-prefix trap). It currently has no caller.

`set_updated_at()` was also kept: it is generic infrastructure any future table
with an `updated_at` column will use.

## The startups & builders offer (`startup_applications`, `email/`)

Added 2026-07-28. Design record:
[`../docs/superpowers/specs/2026-07-28-startup-offer-design.md`](../docs/superpowers/specs/2026-07-28-startup-offer-design.md).

A public form at `/[locale]/startups` writes an application; `/admin/startups`
approves it with a code or rejects it with a reason; either way the applicant
gets a branded email in their own language.

🔴 **The fact that shapes the whole feature: Rekaz has no coupon, discount or
promotion API** (`docs/rekaz-api-findings.md`). So the code minted here **cannot
be redeemed by software anywhere**, on this site or on mazj.sa. It is an
entitlement a MAZJ person honours in the room, and `redeemed_at` exists because
that is the only way redemption can ever be recorded. The approval email says so
in as many words; if that sentence is ever trimmed for brevity, every approved
founder goes hunting for a discount box that does not exist. **Do not build
anything that assumes this code can self-apply at checkout.**

🔴 **A DECISION AND ITS EMAIL ARE TWO SEPARATE FACTS.** The decision commits
first; the mail is attempted after and is never allowed to undo it. A Resend
outage, an unverified domain or a missing key leaves the approval standing, the
code in the row, and the reason in `decision_email_error`, which the admin
renders in orange with a resend control. The alternative (send first, or roll
back on a mail failure) means the owner presses Approve, sees an error, presses
again, and issues two codes while the founder waits.

⚠️ **The email variables are OPTIONAL in `server/env.ts`, deliberately, and that
is a departure from how `IP_TRUST_PROXY` is treated.** They are read by one
marketing feature. Required in production, a half-propagated DNS record would
throw at module scope and take the **live booking flow** down with it. So the
requirement moved to the point of use: `emailConfig()` returns a typed error
naming the exact missing variable, the admin screen prints it, and
`npm run check:env` warns. What is explicitly NOT done is a silent no-op that
reports success.

**Other things worth knowing before touching it:**

- **Two rate-limit dimensions, and the second is the important one.** Per origin
  (5/hour) and per submitted email address (3/**day**). This endpoint mails an
  address a stranger typed, which is the shape of an open relay. The email
  bucket is keyed on a possible VICTIM, so it is charged LATE, after validation
  and the idempotency replay, exactly as `booking.ts` charges its per-mobile
  bucket. Moving it up hands anyone a way to lock a specific person out of
  applying for a day.
- **A partial unique index enforces one OPEN application per address**
  (`where status = 'pending'`, on `lower(email)`). Partial on purpose: a rejected
  founder may re-apply, which is the outcome a good rejection email should
  produce. The service maps that conflict to "you already have an application
  with us", which is good news phrased as such rather than an error.
- **The rejection reason has a 10-character floor in a CHECK CONSTRAINT.** The
  owner's requirement was "if we rejected them, explain why", and a database
  constraint is what makes that survive a hurried afternoon and any future code
  path that forgets to ask.
- **Both decisions use a conditional UPDATE** (`.eq("status", "pending")`), which
  IS the concurrency control. Two admins with the queue open both pressing
  Approve would otherwise mint a second code and invalidate one already emailed.
- **Generated identifiers use a 32-symbol alphabet with `0/O` and `1/I` dropped
  as pairs**, and the same set is encoded as `[2-9A-HJ-NP-Z]` in **three** SQL
  check constraints. `test/startup-offer-sync.test.ts` pins that the TypeScript
  and the SQL agree; a drift means the app generates values its own database
  refuses, i.e. a 503 on a public form. Randomness is rejection-sampled, not
  `% 32`: today's alphabet divides 256 evenly, which is a property of a constant
  somebody may edit.
- **`server/email/copy.ts` holds the email copy, NOT `messages/*.json`.**
  `server/` may not import `next-intl`. The mechanism is duplicated, the content
  is not: no string is shared with the site. `copy.test.ts` asserts en/ar key
  parity, the TONE rules, and that the offer's terms never appear.
- 🔴 **Every interpolated value in `email/templates.ts` is HTML-escaped.**
  `founderName` and `startupName` come from a public form and the rejection
  reason from a textarea, and this HTML is sent from MAZJ's own verified sending
  domain. An unescaped `<` there is a phishing primitive, not a rendering bug.
  React is escaping nothing on that path, because none of it is React.
- ⚠️ **Arabic dates need `ar-u-ca-gregory-nu-latn`.** Plain `ar-SA` defaults to
  the Umm al-Qura (Hijri) calendar AND Arabic-Indic digits, so a code expiry
  would print as a correct date in the wrong system beside a deadline somebody
  must act on, and nobody reviewing the English would ever see it.
- **Log field names dodge the redaction denylist on purpose.** `delivered` and
  `deliveryFailure`, never `emailSent` / `decisionEmailError`: the logger
  redacts any key CONTAINING "email", so those would have written
  `[redacted]` on every line. The admin's own address is logged as
  `deciderHash`, an HMAC, for the same reason plus PDPL.

## 🔴 The boundary

**`server/` may not import React, `next/*`, `next-intl`, or `@/components`,
`@/app`, `@/lib`, `@/i18n`. Frontend code may not import `@/server/*`.**

Both directions are enforced by `no-restricted-imports` blocks in
`eslint.config.mjs`, so a violation is a lint error rather than a code-review
miss. Verified by writing three deliberate violations and confirming all three
fire.

The second direction is the load-bearing one: it is precisely what makes this
folder liftable into its own package or its own deployed service later without a
rewrite. Every framework import added here is a nail in that door.

The sanctioned crossings are **`app/api/**`** (route handlers, kept to about
five lines each), **`instrumentation.ts`**, and, since 2026-07-27,
**`app/admin/_lib/**`**.

The third was added with the admin dashboard. Admin pages are Server Components
that genuinely need the backend, and making them fetch their own HTTP API would
mean a server calling itself over the network with an absolute URL to build and
a cookie jar to forward by hand. So the crossing is a folder, not a rule-wide
exemption: only `_lib` may import `@/server/**`, and it exports plain view models
that the pages render. The underscore keeps Next from ever routing it and makes
the crossing obvious in a diff. **Do not import `@/server/*` from an admin page
directly, and do not re-export a backend module from `_lib`**: export data.

- **It is `server/core/`, NOT `server/lib/`.** It was named `lib` originally and
  had to be renamed: from `server/x.ts` the pattern `../lib/**` means the
  FRONTEND `lib/`, but from `server/db/x.ts` the same string means the backend's
  own. Same name, two meanings, so the boundary rule false-positived on 11
  legitimate internal imports. **Don't reintroduce a `server/lib/`.**
- When a module here needs a constant that also exists in `lib/`, **duplicate it
  rather than importing across the boundary**, and add a test that asserts the two
  stay in sync. That pattern lived in `leads.sync.test.ts` before `leads` was
  dropped; reuse the shape, not the file.

## The two Supabase clients

Confusing them is the most expensive mistake available in this codebase.

- **`supabase/admin.ts`** uses the secret key and **bypasses Row Level Security
  entirely.** It imports `server-only` so it can never reach a browser bundle. On
  a privileged client a `.eq()` filter **IS the access control**, not a
  convenience: forget it and you return every row to whoever asked. This is
  exactly the risk the Rekaz review §4.3 raises about their admin-only key.
- **`supabase/public.ts`** uses the publishable key, so RLS applies. Today its
  only job is letting `test/rls.integration.test.ts` attack the tables the way a
  browser could, and assert it is refused.

- **`supabase/session.ts`** is the third client, added 2026-07-27 when
  authentication shipped. It uses the PUBLISHABLE key and carries one visitor's
  session, so RLS applies to everything it does. Reaching for `supabaseAdmin()`
  to answer a question about the current user throws away the only mechanism
  that keeps one user out of another's rows.

  🔴 **Never cache a session client across requests.** It closes over one
  visitor's cookie jar, so a module-level singleton serves the first visitor's
  session to everyone landing on the same warm serverless instance. That is why
  `admin.ts` and `public.ts` may be singletons and this one may not.

  🔴 **It takes a cookie adapter rather than calling `cookies()` itself.**
  `@supabase/ssr` needs `next/headers`, which `server/` may not import, so the
  dependency is inverted: this module declares the cookie access it needs and
  `app/admin/_lib/supabase.ts` supplies the Next implementation. That is also
  why `app/admin/_lib/**` is now a sanctioned boundary crossing (see below).

**`import "server-only"` guards every secret-bearing module.** It throws outside a
React Server Component, which would break Vitest, so `vitest.config.ts` aliases it
to `node_modules/server-only/empty.js` (the package's own `react-server` export
condition). `scripts/check-env.mts` gets the same effect with
`node --conditions=react-server`.

⚠️ **Cast the CLIENT, never its `.from`.** `from` reads `this.rest`, so pulling it
off the object unbinds it and every query throws "cannot read properties of
undefined". In `test/rls.integration.test.ts` that read as a PASSING security
check, because the assertion is that no rows come back. Where a table is missing
from the generated types (see `db/bookings.ts`), cast `supabaseAdmin()` itself.

## 🔴 Database security posture

**Every table gets RLS enabled AND `revoke all from anon, authenticated` in the
SAME migration that creates it.**

That is not redundant. Supabase installs DEFAULT PRIVILEGES granting those roles
table access, so RLS alone leaves exactly one careless policy between you and
exposure. Revoking means two separate mistakes are required to expose anything.

Postgres also grants `EXECUTE` on functions to `PUBLIC` by default, which would
expose them over PostgREST's `/rpc/` endpoint to anonymous callers.
All three functions (`rate_limit_hit`, `idempotency_begin`, `health_ping`)
explicitly revoke and re-grant to `service_role` only.

`SECURITY DEFINER` functions must `set search_path = ''` and fully qualify every
name, or Supabase's advisor flags `function_search_path_mutable`, which is a real
privilege-escalation vector (a caller can point `public` at their own schema and
hijack a call).

⚠️ Supabase's security advisor reports INFO `rls_enabled_no_policy` on all three
tables. **That IS the design** (deny-by-default, server-only tables), not a
finding to fix.

## Concurrency primitives

Both live in the database rather than in process memory, because this runs on
serverless: each concurrent instance has its own heap, so an in-memory counter
limits each instance separately and the real ceiling becomes limit × instance
count, which is no ceiling at all.

🔴 **Every limit has TWO dimensions, and IP is the weaker one.** `checkRateLimits`
records several buckets concurrently and returns the strictest verdict. Booking
limits per-IP (8/hr) AND per-mobile (5/hr); the magic link limits per-IP (5/hr)
AND per-submitted-address (3/hr). One dimension is not enough in either
direction: Saudi carriers CGNAT many subscribers behind few addresses, so an IP
ceiling tight enough to stop an attacker also blocks a real office, while a
residential proxy pool rents a genuine un-forged address per request for pennies.
🔴 **An EMPTY bucket list is REFUSED, not allowed**: reaching that state means
every identity was absent, which is not a browser.

🔴 **`clientIp` returns `{ip, attested}`, never a string, and NEVER the literal
`"unknown"`.** That old sentinel hashed to a CONSTANT, so every header-less
request on the site shared one bucket: eight bookings an hour for everybody, with
nothing anywhere to notice. Absent is now `null` and the caller decides.

🔴 **Which header to trust is CONFIGURATION (`IP_TRUST_PROXY`), not detection.**
A request cannot report its own topology: every header that would reveal it is
set by the same client being judged. **Vercel OVERWRITES `x-forwarded-for`** to
prevent spoofing (so the header-rotation attack does not work there, and
`x-real-ip` carries the same attested value, which is what Vercel's own
`ipAddress()` reads); **Cloudflare APPENDS**, so its leftmost entry is the
client's own claim and only `cf-connecting-ip` means anything. Unset means
`none`, the least trusting reading, and `npm run check:env` warns about it. 🔴 Set
it to `vercel` at launch or both limits run permanently in their weakest mode.

**`rate_limit_hit`** is one `INSERT ... ON CONFLICT DO UPDATE`. A
read-then-write limiter loses races under exactly the concurrent load it is
supposed to defend against. It fails **closed**: if the database is unreachable
the request is refused, because the moment the database struggles is the moment an
abusive client is most able to hurt you.

🔴 **`idempotency_begin` is a SQL function, not client-side
insert-then-read.** Two reasons, both found by adversarial review. The
two-statement version could interleave between the conflicting insert and the
follow-up read. Worse, an `in_progress` row was **never reclaimable**: a request
that died after claiming a key (serverless timeout, OOM, redeploy mid-flight, or a
transient fault that defeats both the insert and the best-effort cleanup delete
milliseconds later) wedged that key at 409 **forever**, and the client behaviour
that triggers it is the correct one, retrying with the same key. The function now
reclaims rows older than `STALE_AFTER_SECONDS` (90) via a predicate inside the
UPDATE, so exactly one caller can win, and GCs completed rows after 24h the same
opportunistic way `rate_limit_hit` does. Outcomes:
`proceed | replay | in_flight | fingerprint_mismatch | retry`.

## Data handling

🔴 **Phone normalisation (`domain/phone.ts`) handles Arabic-Indic digits**
(U+0660-0669) and Persian (U+06F0-06F9). An Arabic keyboard emits `٠٥٣٤٦٠٠٤٨٨`,
which every ASCII-digit validator rejects. This is whether the Arabic half of the
site works, not a nicety. Stored as E.164, enforced by a check constraint.

- 🔴 **Decide "is this international?" AFTER stripping punctuation, never
  before.** Reading `hadPlus` off the raw string means a leading bracket hides the
  plus, so `(+971) 50 123 4567` (an extremely common way to write a number) fell
  through to the Saudi-only branches and a real UAE mobile was rejected as
  unreachable.
- 🔴 **A generic E.164 shape check is NOT validation.** The `+` branch used to
  concatenate digits without consulting the Saudi plan, so `+966 (0)53 460 0488`
  (the standard both-domestic-and-international print form) became the 13-digit
  `+9660534600488`. That satisfied `^\+[1-9][0-9]{7,14}$` in code AND the SQL
  check, so an undialable number was stored as canonical, often as a lead's only
  contact channel. Any `+966` number now has its national significant number
  validated against `[15]\d{8}` and the redundant trunk `0` removed. **A correct
  Saudi value is always exactly 13 characters.**

🔴 **Strip C0/C1 control characters from any free text before it reaches
Postgres.** A NUL passes `JSON.parse`, passes `z.string()`, and survives
whitespace collapsing, then the driver rejects it with `unsupported Unicode
escape sequence`, which the db layer maps to `upstream_unavailable`: a 503 blaming
our database for the caller's input. The `collapse()` helper (removed with `leads`, see git `64abee4`) stripped the C0/C1 ranges `U+0000`-`U+0008`, `U+000E`-`U+001F` and `U+007F`-`U+009F`, deliberately skipping `U+0009`-`U+000D` (tab, newline, CR and friends) because the whitespace pass has already turned those into spaces.

⚠️ **Write those ranges as escape sequences, never as literal bytes.** A literal
control byte in a `.ts` file is a hard ESLint parse error (`Unexpected keyword or
identifier`), and the Bash tool refuses a command containing one, so build such
test inputs with `chr(0)` in Python.

🔴 **A log field whose KEY contains `email`, `phone`, `mobile`, `name`, `ip`,
`key`, `auth`, `token`, `secret`, `session`, `address` or `message` is written as
`[redacted]`.** `core/logger.ts` matches on SUBSTRING, case-insensitively, at
every depth. The denylist is correct and stays, but it silently swallows fields
whose contents are already safe, and it did: `booking.attempt` shipped carrying
`submittedName` and `mobileSuffix`, both matched, so the line the code comment
called the answer to "who actually booked this?" recorded nothing, on every
booking, from the day it was written. Six more fields on that path and three in
`services/admin-auth.ts` were dead the same way. 🔴 **`receipt` contains `ip`**,
so the entire Rekaz response was redacted on the one path where a customer may
have been charged and we could not say what for.

Use `hashIdentifier(value, salt, domain)` from `core/hash.ts` for anything
personal, and name the field so it does not collide: `originHash`,
`submitterHash`, `idemPrefix`, `rekazResponse`, `submittedDomain`.
`test/booking-audit-log.test.ts` pins that they survive, because "the name
happens not to match the denylist" is luck, not a design.

⚠️ **An HMAC of the submitted mobile is CORRELATION, not attribution.** In an
impersonation the submitted number is the victim's, so its hash names the victim.
`originHash` is what separates the two. It is evidence and never proof (it
descends from a forwarded header, and CGNAT collapses many unrelated people onto
one value), so nothing automated may act on it.

**Never store a raw IP.** It is personal data under PDPL. `core/hash.ts` HMACs it
with `IP_HASH_SALT` (HMAC, not a plain hash: the IPv4 space is small enough to
brute-force an unsalted SHA-256 in minutes). Rotating the salt deliberately severs
the link to every previously stored hash.

## The Rekaz client (`rekaz/`)

🔴 **Read [`../docs/rekaz-api-findings.md`](../docs/rekaz-api-findings.md)
before touching anything here.** It records what the live API actually does,
probed with real credentials, and it contradicts Rekaz's own documentation in
several places that will otherwise cost you an afternoon. The short version:

- 🔴 **Always send an explicit `User-Agent`.** The API returns **403** to
  clients it does not recognise (`Python-urllib` is refused, `curl` is not).
  Node's `fetch` default passes today; a runtime upgrade changing it would read
  exactly like an expired credential.
- 🔴 **The credential is ADMIN-SCOPE.** `GET /customers` returns MAZJ's entire
  customer list: 287 people, with names, mobiles and email addresses. Same blast
  radius as `SUPABASE_SECRET_KEY`, same handling.
- 🔴 **AND IT HAS NOT BEEN ROTATED.** It was pasted into a chat transcript on
  2026-07-27 and nothing records it as replaced. Rotate before launch, and budget
  for a **short total outage** while doing it: Rekaz keeps one key active at a
  time, so booking, all four `/book` pages, `/events/<slug>` ticket prices and
  `/admin/events`' price picker answer `upstream_unavailable` from the moment the
  new key is generated until the new value is live in Vercel and redeployed.
  ⚠️ `/admin` itself is NO LONGER in that blast radius: the index stopped
  reading Rekaz on 2026-07-30 (root `CLAUDE.md`), so the admin now stays up
  through a key rotation and only its event-price controls degrade. Full
  instructions in
  [`../docs/rekaz-api-findings.md`](../docs/rekaz-api-findings.md).
- `__tenant` has **two** underscores. The Quick Start page says one; it is wrong.
- `MinQuantity` is **required** on `/reservations/slots` despite being
  documented as optional. `getSlotsRaw` defaults it to 1.
- **Slot date ranges are padded, not honoured.** Always re-filter to the day you
  asked for, and always drop `isOutDated`. `filterSlotsToRange` does both.
- **`nameEn` is byte-identical to `nameAr`.** Rekaz holds no English content, so
  `messages/en.json` remains the only source of English product names. An
  integration test fails the day that stops being true.
- **Price ids rotate when a price is edited in the Rekaz dashboard.** Never
  hardcode one; resolve from `GET /products` at request time.
- Three different collection shapes: `/branches` returns a bare array,
  `/providers` returns `{items}` with no `totalCount`, everything else returns
  the full envelope. Assuming the envelope yields `undefined`, not an error.
- 🔴 **Filters work on SOME endpoints and not others, and the map is not
  guessable.** Measured 2026-07-28: `customerMobile` DOES filter
  `/reservations` (562 rows to 7, reaching records from January 2025, and it
  tolerates the leading `+`) but it is a **SUBSTRING** match, so verify the
  returned row's own mobile before trusting it. `customerId` DOES filter
  `/subscriptions`; `mobileNumber` DOES filter `/customers`. Everything else on
  `/reservations` (`keyword`, `customerId`, `branchId`, `statuses`, `upcoming`,
  `dateMin`, `dateMax`) is accepted and silently ignored, including for values
  no record could hold. Note the crossover: `/reservations` honours
  `customerMobile` and ignores `customerId`, `/subscriptions` does the opposite.
  Full table in the findings doc; `test/rekaz-filters.integration.test.ts` pins
  the two the booking path bets on.
- 🔴 **TWO error envelopes are live, and neither carries a usable code.** Model
  binding and query validation (400) return RFC 9110 ProblemDetails; application
  and business failures (403, 404, 500) return the legacy
  `{error: {code, message, details, data, validationErrors}}` with `code`
  **always null**. `traceId` exists only in the ProblemDetails shape, so a 403 or
  a 500 leaves Rekaz support nothing to look up. A 403 is also two different
  things: a business rule (legacy JSON envelope) or a Cloudflare User-Agent block
  (plain text `error code: 1010`, never reaches Rekaz's logs).
- ⚠️ **`Accept-Language` IS honoured, for SOME strings.** This file said the
  opposite until 2026-07-28; we had simply never sent the header. The client
  sends `en` now so the log reads in English for whoever is on call. 🔴 **The rule
  that a Rekaz message never reaches a user is unchanged, and it now rests on two
  real reasons instead of one wrong one:** the message names internal field and
  entity names, and localisation is only PARTLY honoured, so "it will be in the
  reader's language" is not a property anything may depend on. Map to an
  `AppError` code and render copy from `messages/*.json`.

⚠️ **There is no sandbox.** THREE suites hit the production tenant:
`test/rekaz.integration.test.ts` (response shapes),
`test/rekaz-catalog-i18n.integration.test.ts` (every live price and custom-field
GUID has copy in BOTH message files, and no message key matches nothing live) and
`test/rekaz-filters.integration.test.ts` (the two filters the booking path bets
on). All three are read-only for that reason and all three **skip** without
credentials. Never add a write to any of them.

🔴 **`vitest.config.ts` sets `fileParallelism: false`, and that is what keeps
those three suites off each other's throat. Do not remove it.** Each file
sequences its OWN calls, which is useless on its own: vitest's default runs test
FILES in parallel workers, so with credentials present a plain `npm run test`
would fire all three at the same production API at once. That is the exact
pattern the findings doc records as catastrophic (six parallel requests hung
`/subscriptions` past two minutes, having answered in 1.5s moments earlier), and
it is the API that also serves mazj.sa's live checkout. Sequential files cost a
slower run and nothing else.

🔴 **Skipping is not free, and it is the shape of the gap rather than a
convenience.** A machine without the merchant key runs none of these, so a fresh
clone and any CI runner stay green while knowing nothing about the catalog, the
filters or the response shapes. The **21 hardcoded price GUIDs** in
`messages/*.json` had nothing verifying them at all until 2026-07-28, and a key
written from a rotating `pricing[].id` instead of its `immutableId` does not
fail: it falls through to `price.labelAr` and renders Rekaz's Arabic on the
English booking page. **Run the full suite with real credentials before any
release**, not only when the backend changed. The alarm these three raise is
tripped by somebody editing a price in the Rekaz dashboard, which is not a
commit and produces no diff.

⚠️ **Those tests FLAKE, and it is upstream, not us.** Rekaz answers between 1.2s
and 10.8s for the same endpoint and degrades sharply under concurrent load, so a
full `npm run verify` occasionally trips the client's 10s timeout and reports one
or two `upstream_unavailable` failures. **Re-run before investigating**; a clean
second run is the expected outcome, not a fluke. If it fails twice in a row,
that is a real signal. The one live booking test that exists was run by hand and
then deleted, precisely so nothing that writes can flake.

🔴 **`chargedAmount()` in `rekaz/types.ts` is the ONE rule for "what the buyer was
shown".** The booking page and `bookings.amount_snapshot` both call it. They were
two expressions in two files (`discountedAmount || amount` versus `amount`) and
agreed only while no price carried a discount: the first discounted price would
have shown a buyer one figure and handed the desk another.

⚠️ **It lives in `types.ts`, NOT `catalog.ts`, on purpose.** Five suites
`vi.mock("../rekaz/catalog")` with an explicit object, so a helper added there
comes back `undefined` in every one of them (18 tests went red). A shared pure
helper belongs in a module nothing mocks wholesale.

## 🔴 Booking identity: Rekaz forces the binding

**A customer Rekaz already knows MUST be sent as `customerId`. Sending
`customerDetails` with their mobile number returns HTTP 403,
`رقم الجوال مسجل مسبقاً لعميل آخر`.** An unknown mobile is accepted; `customerId`
is accepted. Rekaz neither deduplicates nor creates a second record: it refuses.

⚠️ **Do not "fix" the impersonation risk by removing the lookup in
`services/booking.ts`.** That was tried on 2026-07-28 and took booking down for
every returning customer on both flows, with the failure surfacing as the generic
`internal` copy. `server/services/booking.customer.test.ts` pins the real
contract and explains it.

The risk is real and is NOT closed: the form is public, the number is unverified,
so anyone who knows a returning customer's mobile can book against their
account. It cannot be closed here. It needs proof of possession, and Rekaz
exposes no OTP primitive (REK-029 in `docs/MAZJ-Rekaz-API-Report.pdf`). What
mitigates it instead: the per-mobile rate limit, the audit trail
(`originHash` + `submitterHash`), and the fact that a matched account never
receives the submitter's name or email.

## The admin's three access gates

`/admin` is `@mazj.org` only. The rule lives in **one** place,
`domain/admin-access.ts`, because three gates that each ask the question
differently would eventually disagree and the gap would be invisible in all
three files.

| Gate | Where | Stops |
|---|---|---|
| 1 | `services/admin-auth.ts` | An outsider ever RECEIVING a magic link |
| 2 | Supabase `before user created` hook | The account EXISTING at all |
| 3 | `app/admin/(protected)/layout.tsx` **and every page under it** | A session reaching a page, and an anonymous request reaching the DATA |

🔴 **Gate 2 is the load-bearing one, and it is SQL, not TypeScript.** A request
straight to Supabase's own `/auth/v1/otp` with the publishable key, which is
public by design, bypasses gates 1 and 3 completely. Without the hook that
request creates a real `auth.users` row for any address on earth and mails them
a working link. The function is
`public.enforce_admin_email_domain`, registered as
`pg-functions://postgres/public/enforce_admin_email_domain`. **A migration alone
does not activate it**; the project's auth config must point at it too.

🔴 **The SQL and the TypeScript must stay behaviourally identical.** Both were
run against the same 19 adversarial cases and agree. If you change one, change
the other and re-run both.

🔴 **The rule is NOT `endsWith("@mazj.org")`.** RFC 5321 puts the domain after
the LAST `@` and allows a quoted local part containing one, so
`"anything@mazj.org"@evil.com` is delivered to `evil.com` and passes a suffix
test. Split on the last `@`, require exactly one, compare the domain to an ASCII
literal (which also rejects Cyrillic homographs).

🔴 **Gate 3 uses `getUser()`, never `getSession()`.** `getSession()` decodes the
cookie and believes it. On a page whose entire job is deciding who gets in, that
is not authorisation.

🔴 **The login endpoint must not become an enumeration oracle.** An allowed and a
refused address get the identical response. That is deliberate and it has a real
cost, named in the code: a genuine mail failure is also invisible to whoever is
waiting. The outcome is always in the log.

⚠️ **Supabase email is the built-in sender, capped at a few per hour and not
production-grade.** Custom email TEMPLATES are refused on the free tier with the
default provider (`400: Email template modification is not available for free
tier projects`), so the magic link uses Supabase's default template and the PKCE
`?code=` path. `completeAdminSignIn` also handles `token_hash`, so switching to
real SMTP and a custom template later needs no code change.

## Errors and HTTP

No exceptions cross a layer boundary: services return `Result<T, AppError>`, and
`AppError.code` is the stable contract. One table in `core/errors.ts` maps a code
to an HTTP status, so a status can never drift between two endpoints reporting the
same failure.

🔴 **Every route handler is wrapped in `route()` from `core/http.ts`.** Without
it, one `throw` below the route escapes the `Result` discipline and Next answers a
JSON request with an HTML error page, plus a stack trace in dev.

🔴 **`toPublicError` deliberately discards the message for `internal`.**
Unexpected failure text routinely carries connection strings, SQL fragments, table
names and occasionally row data, and an error response is the single easiest place
in a web application to leak all of it. The detail goes to the log; the client
gets a code.

🔴 **`route()` and `toPublicError` do NOT protect a Server Action.** They are
wired into `app/api/**` handlers only, and Next redacts *thrown* errors, not
*returned* action values, so a returned `AppError.message` serialises to the
browser verbatim. An action must return the `code` and let the page render its
own copy from `messages/*.json`. This shipped a real leak: a Rekaz 400 printed
300 characters of upstream ProblemDetails, its `traceId` and our internal API
path onto the public booking form, in Arabic, on the English page.

**`instrumentation.ts` throws in production but only WARNS in development**,
deliberately: most work in this repo is frontend, and refusing to start
`npm run dev` because nobody has pasted a Supabase key yet would block all of it.
Same asymmetry as `lib/site.ts`, keyed on `NODE_ENV` so it holds on any host.

## Tooling
- **Next 16: `revalidateTag(tag, profile)` takes TWO arguments.** For a Server
  Action that must see its own write (a Refresh button), use `updateTag(tag)`:
  `revalidateTag` purges for FUTURE requests, so a redirect after it still
  renders the cached copy the user just rejected.
  🔴 **For a page with NO server cache, neither applies.** `/admin/startups` is
  `force-dynamic` and queries Postgres on every render, so there is no tag to
  bust; the stale layer is the CLIENT router cache, and the call is `refresh()`
  from `next/cache`. Without it an action mutates a row and the page still shows
  the old state until a hard reload, i.e. the owner presses Approve and nothing
  visibly happens.
- **`vi.fn(async () => X)` narrows its return type to `X`.** `tsc` then rejects
  every other outcome the real function can return, while vitest itself runs
  fine, so `npm run test` passes and `npm run typecheck` fails. Annotate the mock
  against the real union: `vi.fn(async (): Promise<T> => ...)`.
- **Mutation-test a money-path fix.** Reintroduce the bug and confirm the test
  goes red; a test that passes on both the broken and the fixed code proves
  nothing. Back the file up to an explicit path inside the repo, NOT `$TMPDIR`,
  which differs between sandboxed and unsandboxed shells (a backup written in one
  mode is invisible in the other, and the restore silently fails).
- **`supabase-js` `.select()` needs a STRING LITERAL.** The row type is inferred
  from it, so a column list built by concatenation widens to `string`, inference
  falls back to `GenericStringError`, and every `.map(toRow)` fails to compile
  with an error naming `String` and explaining nothing. Write the literal inline
  or use `select("*")`.
- **The type generator emits every `text` RPC parameter as non-nullable
  `string`**, because a SQL signature does not record nullability. Postgres
  accepts null. Cast (`null as unknown as string`) rather than coercing to `""`,
  which stores an empty string that every reader downstream treats as a real
  value. Live example: `event_claim_seat`'s `p_email` / `p_ip_hash`.
- 🔴 **`vi.mock` does NOT intercept a call between two functions in the SAME
  module** (that is a local binding, not the module registry). So MOVING a
  function into a module silently changes what its callers' tests can control:
  relocating `resolveBranchId` into `rekaz/catalog.ts` broke three booking test
  files at once, and its fallback path stopped being covered because the mocked
  `listBranches` was no longer the one it called. Mock the layer BELOW instead
  (`./client`), and **run the WHOLE suite after any cross-module move**, not
  just the tests for the file you edited.
- **Integration tests may write to production, because there is no other
  database.** The pattern, from `test/events-seats.integration.test.ts`: an
  obviously-named fixture slug (`zz-test-*`), a delete BEFORE as well as in
  `afterAll` so a previous crashed run cannot fail this one, dates far out, and
  a final assertion that the cleanup actually took. Never do this against Rekaz,
  which has no cleanup path at all.

- 🔴 **The command sandbox breaks Node's outbound TLS, but not curl's.** Any
  test or script that `fetch`es an external host fails under the sandbox with a
  bare `TypeError`, which `client.ts` correctly maps to `upstream_unavailable`,
  so it reads as "Rekaz is down" rather than "your shell is wrong". Meanwhile
  `curl` to the same URL returns 200, because curl trusts the system keychain
  and Node ships its own CA store. **Run `npm run test`, `npm run verify` and
  anything else that talks to Rekaz or Supabase with the sandbox OFF.** Cost a
  full debugging detour on 2026-07-27: 10 of 12 integration tests "failed", and
  the 2 that "passed" were the ones asserting failure.
- ⚠️ **`Python-urllib` gets 403 from BOTH `platform.rekaz.io` and
  `api.supabase.com`.** Not a sandbox issue, an origin filter. Pass
  `User-Agent: curl/8.7.1` on any `urllib` probe.
- **`npm install` needs the sandbox off**: the npm cache under `~/.npm` is
  root-owned and outside the writable allowlist.
- **`npm run db:*` goes through `scripts/db.mjs`, not the CLI directly**, because
  npm scripts run in a shell that never read `.env.local`, so
  `--db-url "$SUPABASE_DB_URL"` would silently pass an empty string.
  `db:types:check` is the CI guard against generated types drifting from the
  schema.
- 🔴 **`supabase gen types --db-url` requires Docker running** (it runs
  `postgres-meta` in a container) **even against a REMOTE database**. `db push`
  does not.

  ✅ **But `--project-id` does NOT need Docker**, discovered 2026-07-28 with
  Docker Desktop stopped. It goes through the Management API using
  `SUPABASE_ACCESS_TOKEN`, which `.env.local` already carries:

  ```
  npx --yes supabase gen types typescript \
    --project-id sxksrvqehiqnonsirwtb --schema public > server/supabase/types.gen.ts
  ```

  Verified byte-identical to the `--db-url` output for the entire pre-existing
  schema (the diff against the checked-in file was 100% additions, nothing
  changed or removed), so `db:types:check` still passes afterwards. ⚠️ It is not
  wired into `scripts/db.mjs` because that script is built around `--db-url` and
  a second code path there is a second thing to keep in sync; use the command
  above by hand when Docker is down, and treat `npm run db:types` as canonical.

- ⚠️ **`supabase db push` prints a Docker error and then says "Finished" when
  Docker is stopped.** The failure is only its migration-catalog CACHE
  (`failed to inspect docker image`); the migration itself applies fine. Same
  family as the certificate error noted below: **do not trust either the error
  or the success message.** Verify with
  `npx --yes supabase migration list --db-url "$SUPABASE_DB_URL"` and check the
  `remote` column is populated for your timestamp.
  **When Docker is down, the Management API produces the same file:**
  `GET https://api.supabase.com/v1/projects/<ref>/types/typescript?included_schemas=public`
  with the PAT from `.env.local`, writing `.types` to `server/supabase/types.gen.ts`.
  Verified byte-identical on the overlapping tables on 2026-07-28, so
  `db:types:check` still passes afterwards. It is a GET, which the permission
  classifier allows; a POST or PATCH reading the same file is refused.
- The brew-installed `supabase` binary is broken on this machine (SIGKILL under
  Node 26); `npx --yes supabase` works, which is what the scripts use.
- **Ad-hoc database reads and writes go through PostgREST.** `psql` is not
  installed and the Supabase MCP's `execute_sql` answers `You do not have
  permission`, so both obvious routes are dead. What works, with the secret key
  from `.env.local` (bypasses RLS, takes `PATCH`/`DELETE` with a filter plus
  `Prefer: return=representation`, and is how the `zz-test-*` fixture pattern
  above is actually driven):
  `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/events?select=*" -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"`
- 🔴 **A module imported by `scripts/check-env.mts` may not use extensionless
  relative imports.** That script runs under Node's raw
  `--experimental-strip-types`, not a bundler, so `import {x} from "./types"`
  dies with `ERR_MODULE_NOT_FOUND` naming a file that plainly exists.
  `server/rekaz/store.ts` therefore has ZERO imports and duplicates the
  product-type numbers, pinned by a sync test in `store.test.ts`. Keep such a
  module import-free, or write the `.ts` extension.
- ⚠️ `supabase db push` can print a certificate error from its diff engine and
  then report "Finished" **without that being a failure**. Do not trust either
  the error or the success message: verify against
  `supabase_migrations.schema_migrations`.
- **`server/supabase/types.gen.ts` is generated. Never hand-edit it.** It is
  excluded from ESLint for that reason.

## Configuration

Credentials live **only** in `.env.local` (git-ignored). `.env.example` is the
committed template and needed a `!.env.example` negation to survive `.gitignore`'s
`.env.*` rule.

⚠️ Verify env-file ignore changes with `git add -n`, **not** `git check-ignore -v`,
which prints the matching rule for negations too and reads like a failure.

`.env.local` holds the project URL, the modern `sb_publishable_` / `sb_secret_`
keys (preferred over the legacy `anon` / `service_role` JWTs: independently
rotatable, no expiry semantics), `IP_HASH_SALT`, `SUPABASE_DB_URL`, and
`SUPABASE_ACCESS_TOKEN` (the owner's PAT, read by name by both the CLI and the
Management API, so `npm run db:*` and
`curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" https://api.supabase.com/v1/...`
both work without asking the owner again).

**The live project is `sxksrvqehiqnonsirwtb` ("mazj-production"), `eu-central-1`
/ Frankfurt**, org "MAZJ website", free plan. It replaced `bosbgpketmosatwbxpbf`
("MAZJ Website") in `ap-northeast-1` / Tokyo on 2026-07-27; that project was
deleted after confirming it held zero rows, zero `auth.users` and zero
`storage.objects`. 🔴 If you ever see `bosbgpketmosatwbxpbf` in a config, it is
stale: that project no longer exists. Tokyo measured **250ms per
query from Dammam versus Frankfurt's 96ms** (2.6x; cold connect 1898ms → 715ms).
Supabase binds region at the infrastructure level, so there is no in-place move:
it is a new project, new keys, replayed migrations. 🔴 **Never create a project
for this business in an APAC or US region.** Measured from Dammam: Paris 100,
Frankfurt 110, Mumbai 120, Singapore 140, Virginia 190, Tokyo 200. (Method: TCP
connect to each `aws-0-<region>.pooler.supabase.com:5432` via `nc` timed with
`time`, so each figure carries ~10ms of shell overhead; the ordering is solid and
the Tokyo-versus-Europe gap was confirmed by real query round-trips.)

⚠️ The direct `db.<ref>.supabase.co` host is **IPv6-only** (AAAA record, no A). It
works from the owner's machine because STC provides IPv6 egress. On an IPv4-only
network use the Supavisor pooler host instead.

🔴 **The same rule binds the COMPUTE, and `vercel.json` is where it is stated.**
Picking the right database region buys nothing if the code querying it runs on
another continent. Vercel's default function region is `iad1` (Washington DC),
and the first production deploy on 2026-07-28 ran there: `x-vercel-id` read
`bom1::iad1`, and `/api/health` reported **303-416ms** to a database sitting in
Frankfurt, i.e. an Atlantic crossing on every single query. `vercel.json` pins
`regions: ["fra1"]` to put the functions in the same city as Postgres. JSON
takes no comments, which is the only reason this paragraph is here and not in
that file.

⚠️ **A region is not a free choice on every plan.** Hobby permits exactly one,
so `regions` must stay a single-element array; adding a second fails the
deployment rather than degrading. If MAZJ ever moves to a plan with multiple
regions, Frankfurt stays primary: it is both nearest to Riyadh/Dammam of the
European options and colocated with Supabase, and those two pull the same way.

## Verification recipe

Run all of this after any schema or security change. All passing as of
2026-07-27.

1. Connect with `pg` over IPv6 and assert `relrowsecurity` is true, `pg_policies`
   is empty, and `role_table_grants` has zero rows for `anon` / `authenticated`.
2. `npm run test`, **with real credentials in `.env.local`.** The RLS integration
   tests attack every table with the publishable key and must all be refused; the
   three Rekaz suites read the live production tenant and pin its response
   shapes, its catalog-to-copy parity and the two filters booking depends on. All
   of them **skip** rather than fail without credentials, so a fresh clone stays
   green, 🔴 **which also means a green run proves nothing about Rekaz or the
   database unless the keys were present. Read the skip count, not just the
   colour.** 🔴 Run with the sandbox OFF or every network test fails misleadingly
   (see Tooling).
3. `npm run db:types:check`: generated types match the live schema.
4. `curl https://api.supabase.com/v1/projects/<ref>/advisors/{security,performance}`
   expects only INFO `rls_enabled_no_policy` (the design) and INFO
   `unused_index` on an empty table.
5. `npm run check:env` and `npm run verify`.

**End-to-end proof, recorded 2026-07-27 against the now-removed `leads`
endpoint.** Kept because it is evidence about the *mechanisms*, which survive,
not about the endpoint, which does not: the Arabic-Indic phone `٠٥٣٤٦٠٠٤٨٨`
normalised to `+966534600488`; `Idem@Example.COM` stored lowercased; a replayed
idempotency key returned the identical id with 200 instead of 201; a 30-request
flood produced exactly 13 rows with `Retry-After: 28`, i.e. the limiter cut in at
precisely the 20th request of the window and rejected requests wrote nothing;
`ip_hash` stored a 128-bit HMAC rather than an address; and error responses
leaked none of `SUPABASE`, `supabase.co`, `/Users/` or key material while the
server log carried the full diagnostic.

⚠️ **That path cannot be re-run today**: there is no write endpoint. The next
feature that adds one should reproduce these checks rather than trusting this
paragraph.

## Out of scope, deliberately

Payments (Rekaz exposes no API), webhook receivers, customer-facing accounts,
storage, realtime, refunds and coupon validation. Each gets its own spec. **Do
not build them speculatively.**

⚠️ **"Coupon validation" on that list is not a gap waiting to be filled, it is
an impossibility.** Rekaz publishes no coupon endpoint at all, which is exactly
why the startups offer's code is honoured by a person. Read
`docs/rekaz-api-findings.md` before anyone proposes closing it.

**Transactional email left this list on 2026-07-28**, with the startups offer.
It is Resend, it is `server/email/`, and it is scoped to that one feature: there
is no general mailer, no queue and no template registry, and none should be
built until a second feature actually needs one.

Auth, Rekaz reads and Rekaz WRITES all left this list on 2026-07-27, as the admin
dashboard and then on-site booking shipped. `idempotency_keys` finally has its
caller: `services/booking.ts`, verified on a real booking to return the original
payment link rather than creating a twin. It gained a **second** on 2026-07-28,
`services/startup-application.ts` under the scope `startup:apply`, which is the
same primitive doing the same job for a form rather than a purchase.
