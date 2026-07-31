-- What WE created in Rekaz, written down so it can be found again.
--
-- 🔴 THE PROBLEM. Today the booking path drops everything Rekaz hands back the
-- moment `createBooking` returns. `BookingResult` keeps the payment link and the
-- invoice id just long enough to redirect a browser, the `reservationIds` array
-- is discarded at the point it is received, and the only surviving trace of a
-- purchase is an `idempotency_keys` row that deletes itself after 24 hours. So
-- when a customer phones three days later, nothing on our side knows that
-- booking ever happened, and the operations team is left searching Rekaz by eye.
--
-- 🔴 HOW A HUMAN FINDS A ROW HERE: BY MOBILE NUMBER, NOT BY A REFERENCE.
-- This is the single decision that shapes the whole table, and an earlier draft
-- got it backwards. Rekaz's create responses carry NO human reference at all:
-- `POST /reservations/bulk` answers `{invoiceId, reservationIds, paymentLink}`
-- and `POST /subscriptions` adds only an internal `id`. Neither carries a
-- `reservationNumber` or a `subscriptionCode`. A table keyed on the number a
-- customer reads off their invoice would therefore have that column NULL for
-- every successful booking it ever stored, and the lookup it exists for could
-- never once run.
--
-- The mobile number does work, and it works on BOTH sides of the wall. Measured
-- against the live tenant on 2026-07-28: `GET /reservations?customerMobile=`
-- genuinely filters, narrowing 562 rows to 7 and reaching records from January
-- 2025. (Rekaz implements filtering on some endpoints and ignores it on others,
-- with nothing in the docs to tell them apart, so this had to be measured.) So
-- "ask the customer for their mobile number" is a route that finds the booking
-- here AND finds it upstream, which is exactly what a support call needs.
--
-- ⚠️ One asymmetry to keep straight. Rekaz's filter is a SUBSTRING match, so a
-- staff member reading that list must check each returned row's own mobile
-- before trusting it. The lookup on THIS table is an exact match on a full HMAC
-- and has no such failure mode.
--
-- 🔴 Rekaz remains the system of record for the booking, the invoice and ZATCA
-- compliance. This is a POINTER, not a copy: ids, a hash and a link. It holds no
-- customer name, no email and no mobile number in the clear. A second copy of a
-- customer's contact details would be a new PDPL collection serving no question
-- this table is asked.
--
-- SECURITY POSTURE, unchanged from the baseline and non-negotiable: RLS enabled
-- in the same migration that creates the table, ZERO policies (RLS with no
-- policy denies everything), and privileges revoked from `anon` and
-- `authenticated`, because Supabase installs DEFAULT PRIVILEGES that RLS alone
-- would leave one careless policy away from exposing. Two separate mistakes are
-- required to expose anything. Reachable only by the secret key.
--
-- ⚠️ Supabase's advisor will report INFO `rls_enabled_no_policy` here. That IS
-- the design, not a finding.

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------

create table public.bookings (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- What was bought ------------------------------------------------------
  -- `text` + check rather than a Postgres enum, throughout this file: adding a
  -- value to an enum inside a transaction is restricted and dropping one is
  -- impossible, whereas a check constraint is a single ALTER.
  flow        text        not null check (flow in ('reservation', 'subscription')),

  -- 🔴 Mirrors `SPACE_SLUGS` in server/domain/spaces.ts, which is the URL
  -- segment under /spaces/. It is NOT the vocabulary `startup_applications.space`
  -- uses (`shared_seat`, `private_office`, ...), which mirrors `lib/links.ts`
  -- BOOKING instead. Two different questions, two different lists, and nobody
  -- should "harmonise" them: this column has to join to a route, that one has to
  -- join to a marketing link. Duplicated across the frontend/backend boundary
  -- rather than imported across it, same as every other constant here.
  space_slug  text        not null check (
                space_slug in ('coworking', 'private-office',
                               'meeting-room', 'event-hall')),

  -- 🔴 The IMMUTABLE price id, never Rekaz's `id`. Price ids rotate whenever
  -- anyone edits an amount in the Rekaz dashboard, so a stored `id` stops
  -- resolving the first time the owner corrects a typo. Same rule
  -- server/services/booking.ts already follows when it resolves a price.
  price_immutable_id text  not null check (char_length(price_immutable_id) between 1 and 64),

  -- When the thing that was bought begins. It is what makes a row legible to a
  -- human on the phone: "the Tuesday morning one".
  --
  -- ⚠️ A subscription records midnight UTC on its start day, because a day is
  -- all Rekaz was ever given (`POST /subscriptions` takes `startAt` as a date,
  -- and server/services/booking.ts validates it as `YYYY-MM-DD`). Nothing
  -- renders a clock time off this column, so unlike `events` it needs no
  -- precision marker.
  starts_at   timestamptz not null,

  -- Rekaz's handles ------------------------------------------------------
  -- An array because `POST /reservations/bulk` answers with `reservationIds`,
  -- plural, and storing Rekaz's own shape means no reshaping the day a booking
  -- carries two lines. We send exactly one item today.
  --
  -- ⚠️ NO CROSS-FIELD CONSTRAINT PAIRS THESE WITH `flow`, deliberately. The
  -- write that fills this table runs AFTER the customer's money path has already
  -- succeeded and is best effort by design, so a check constraint firing here
  -- destroys the only record of a real booking in order to enforce a tidiness
  -- rule nothing reads. `flow` already says which Rekaz screen to open.
  rekaz_reservation_ids text[],
  rekaz_subscription_id text  check (char_length(rekaz_subscription_id) <= 64),

  -- 🔴 NULLABLE, AND NULL IS THE NORMAL CASE. See the header: no create response
  -- carries a human reference. The ONLY thing in the tree that ever produces one
  -- is server/rekaz/reconcile.ts, which runs exclusively on the indeterminate
  -- branch of `createBooking` (a Rekaz timeout or 5xx after the write was
  -- dispatched) and learns the `reservationNumber` or `subscriptionCode` from a
  -- LIST read.
  --
  -- That makes this column narrow and valuable rather than broken: the rows that
  -- have one are precisely the rows where a customer was told "your booking was
  -- created (reference X) but we could not open payment, please contact us", so
  -- the reference they quote is the reference stored here. Every other row is
  -- found by mobile.
  reference   text        check (char_length(reference) <= 120),

  -- ⚠️ Also nullable, and measured. `invoiceId` is documented as always present
  -- and came back UNDEFINED on a real reservation on 2026-07-27. A column that
  -- refuses the value the API actually sends is a column that refuses the row.
  invoice_id  text        check (char_length(invoice_id) <= 64),

  -- The payment link ------------------------------------------------------
  -- 🔴 THIS IS A CAPABILITY. Anyone holding this URL can pay for this booking,
  -- and the URL identifies one customer's purchase. Three rules follow.
  --
  --   1. It is stored ABSOLUTE. Rekaz returns a RELATIVE path
  --      (`/orders/pay/...`), so a raw one sends the buyer to our own origin and
  --      404s the last click of the purchase. `absolutePaymentLink` resolves it;
  --      server/db/bookings.ts refuses to store anything else.
  --   2. It is read by ONE narrow query, behind the admin's three access gates,
  --      for a member of staff finishing a purchase by hand. It is deliberately
  --      absent from the record the admin list renders. Never a browser, never
  --      `anon`, never `authenticated`.
  --   3. It is RETAINED AT MOST 72 HOURS, then nulled in place by
  --      `bookings_purge_payment_links` below. The row survives; the capability
  --      does not.
  --
  -- Nullable for three separate reasons, all real: an indeterminate write never
  -- produced one, the retention purge takes it away, and Rekaz has answered 2xx
  -- with the field missing.
  payment_link text       check (char_length(payment_link) <= 2000),

  -- ⚠️ "We took the link away" and "there never was one" are DIFFERENT FACTS and
  -- lead to opposite conclusions. The first is routine expiry. The second is a
  -- Rekaz write we could not confirm, i.e. somebody may have a booking they
  -- cannot pay for, which is a support case. Collapsing them into a bare null
  -- would hide the second inside the first, forever.
  payment_link_purged_at timestamptz,

  -- Who, pseudonymously ---------------------------------------------------
  -- 🔴 `hashIdentifier(mobile, IP_HASH_SALT, 'mobile')`, NEVER the number, and
  -- this is the column the staff lookup keys on. Under PDPL a mobile number is
  -- personal data, and the input space of Saudi mobiles is small enough that an
  -- unsalted hash is a lookup table rather than a pseudonym.
  --
  -- Byte-identical to the `submitterHash` the booking audit log already writes
  -- and to the per-mobile rate-limit bucket, deliberately: one pseudonym joins
  -- the row, the bucket and the log line. Two independent hashes of one number
  -- would be two values nobody could join.
  --
  -- ⚠️ Hashing does NOT make the lookup weaker. Staff type the number the
  -- customer just read out, the server hashes it with the same salt, and the
  -- match is exact. What it removes is a phone book sitting in a second database.
  --
  -- NOT NULL: a row nobody can find is not worth writing. `hashIdentifier`
  -- truncates to 32 hex characters, so the bounds below are loose on purpose,
  -- to survive a future change of digest length without a migration.
  mobile_hash text        not null check (char_length(mobile_hash) between 16 and 128),

  -- Salted HMAC of the client address, never the address. Evidence for a human
  -- reading a trail after a complaint, never proof and never something automated
  -- may act on: it descends from a forwarded header and CGNAT collapses many
  -- unrelated people onto one value.
  origin_hash text        check (char_length(origin_hash) <= 128),

  -- State -----------------------------------------------------------------
  --   pending        created, unpaid, and holding whatever it holds
  --   indeterminate  dispatched to Rekaz, outcome never learned
  --
  -- 🔴 THOSE ARE THE ONLY TWO VALUES BECAUSE THEY ARE THE ONLY TWO ANYTHING CAN
  -- WRITE. `paid`, `cancelled` and `expired` are absent on purpose. Rekaz pushes
  -- no payment status and exposes no webhook, so the only way to learn that a
  -- booking was paid is to go and read, and nothing does; there is no cancel
  -- wrapper in `server/rekaz/` and no scheduled job anywhere in this repo. A
  -- status list containing values with no writer reads, six months later, as a
  -- feature that exists.
  --
  -- Adding one when its writer arrives is a single ALTER, which is the whole
  -- reason this is `text` + check and not an enum. 🔴 Whatever adds `cancelled`
  -- must be able to tell paid from unpaid FIRST: a sweep that cannot recognise a
  -- paid booking will eventually cancel one, and that is worse than never
  -- sweeping at all.
  status      text        not null default 'pending'
                          check (status in ('pending', 'indeterminate')),

  -- 🔴 THE RETENTION PROMISE, MADE STRUCTURAL. A row cannot claim to have purged
  -- a capability it is still holding. Without this, a future code path that
  -- stamps the timestamp and forgets the null leaves a live payment link sitting
  -- behind a column that says it is gone, and nothing anywhere would notice.
  constraint bookings_purged_link_is_gone check (
    payment_link_purged_at is null or payment_link is null
  )
);

comment on table public.bookings is
  'What MAZJ created in Rekaz, so it can be found again. Looked up by hashed mobile. Server-only.';
comment on column public.bookings.reference is
  'reservationNumber or subscriptionCode. Null on every normal booking: only the reconcile path ever learns one.';
comment on column public.bookings.payment_link is
  'ABSOLUTE Rekaz checkout URL. A capability: retained 72h max, then nulled. Admin-only, one narrow read.';
comment on column public.bookings.payment_link_purged_at is
  'We took the link away. Distinct from never having had one, which is a support case.';
comment on column public.bookings.mobile_hash is
  'hashIdentifier(mobile, IP_HASH_SALT, ''mobile''). Never the number. The staff lookup key.';
comment on column public.bookings.status is
  'pending | indeterminate. Only these two have writers; see the migration for why.';

-- The admin list is everything, newest first.
create index bookings_created_at_idx on public.bookings (created_at desc);

-- 🔴 THE STAFF LOOKUP, and the reason this table has the shape it has. "Every
-- booking this number made, newest first" is both the support question and the
-- question an abuse investigation asks.
create index bookings_mobile_hash_idx
  on public.bookings (mobile_hash, created_at desc);

-- The narrow second lookup: a customer quoting the reference our own error copy
-- gave them after an indeterminate write. Partial, because the column is null on
-- every normal booking and those rows can never answer this question.
create index bookings_reference_idx
  on public.bookings (reference)
  where reference is not null;

-- Exactly what the retention purge scans, and it shrinks as links are purged.
create index bookings_live_link_idx
  on public.bookings (created_at)
  where payment_link is not null;

-- One invoice is one booking, because we send exactly one item per call. A
-- second row for the same invoice is a double-record, and a staff lookup that
-- returns two rows for one purchase is worse than one that returns none.
-- Partial, because `invoiceId` genuinely arrives undefined sometimes.
create unique index bookings_invoice_idx
  on public.bookings (invoice_id)
  where invoice_id is not null;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;
revoke all on table public.bookings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retiring a capability
-- ---------------------------------------------------------------------------

-- Nulls payment links that have outlived their purpose.
--
-- 72 hours from creation. Long enough that somebody whose phone died, or who was
-- waiting for a spouse to send a card number, can come back the next day and
-- still finish. Short enough that a live "pay for this" URL is not sitting in
-- our database for months attached to a purchase somebody made once.
--
-- 🔴 WHAT ACTUALLY CALLS THIS, stated plainly rather than promised. There is no
-- cron in this repo and none is being added: `vercel.json` carries only a region
-- pin, and both existing garbage collectors run opportunistically inside the
-- function that needs them precisely because pg_cron is not enabled here.
--
-- So the trigger is the BOOKING WRITE PATH. `recordBooking` in
-- server/db/bookings.ts calls this after every successful insert. That is a real
-- caller rather than a hypothetical one, it fires exactly when the table grows,
-- and it costs one cheap UPDATE against a partial index on a request that has
-- already spent seconds talking to Rekaz.
--
-- ⚠️ THE HONEST LIMIT OF THAT: the sweep runs at the rate MAZJ takes bookings.
-- A link created on a Friday afternoon outlives 72 hours if nobody books again
-- until Tuesday. It is bounded by traffic, not by the clock, and closing that
-- gap needs the same scheduled job the abandoned-hold sweep will need. Nothing
-- here should be read as a guarantee finer than that.
create or replace function public.bookings_purge_payment_links(
  p_retain_hours integer default 72
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  -- A zero or negative window would null every live checkout on the site,
  -- including one a customer has open in another tab right now.
  if p_retain_hours < 1 then
    raise exception 'bookings_purge_payment_links: retain hours must be >= 1';
  end if;

  update public.bookings b
     set payment_link = null,
         payment_link_purged_at = v_now
   where b.payment_link is not null
     and b.created_at < v_now - make_interval(hours => p_retain_hours);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.bookings_purge_payment_links(integer) is
  'Nulls payment links older than the retention window. Idempotent. Called from the booking write path.';

-- Postgres grants EXECUTE to PUBLIC by default, which would expose this over
-- PostgREST's /rpc/ endpoint to anonymous callers, i.e. a way for anybody to
-- destroy every in-flight checkout on the site.
revoke all on function public.bookings_purge_payment_links(integer)
  from public, anon, authenticated;
grant execute on function public.bookings_purge_payment_links(integer)
  to service_role;
