-- The events programme: MAZJ's own events, and who signed up for them.
--
-- 🔴 Rekaz remains the system of record for room bookings, invoices and ZATCA
-- compliance. It has no concept of "an event MAZJ hosts" or "somebody attending
-- one", and no endpoint that could hold either. This is genuinely first-party
-- data, which is precisely why it belongs here and not there.
--
-- Design record: docs/superpowers/specs/2026-07-28-events-programme-design.md
--
-- SECURITY POSTURE, unchanged from the baseline and applied to both tables:
-- RLS enabled in the same migration that creates them, zero policies (RLS with
-- no policy denies everything), and privileges revoked from `anon` and
-- `authenticated` because Supabase installs DEFAULT PRIVILEGES that RLS alone
-- would leave one careless policy away from exposing. Two separate mistakes are
-- required to expose anything.

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Identity -------------------------------------------------------------
  -- The URL segment under /{locale}/events/. ASCII and lowercase so the same
  -- link works in both locales and survives being pasted into an Instagram
  -- bio, which is where these are actually shared.
  slug        text        not null unique
                          check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
                                 and char_length(slug) between 2 and 80),

  -- `text` + check rather than a Postgres enum: adding a value to an enum
  -- inside a transaction is restricted and dropping one is impossible, whereas
  -- a check constraint is a single ALTER.
  status      text        not null default 'draft'
                          check (status in ('draft', 'published', 'cancelled')),

  -- Content, in both languages ------------------------------------------
  -- 🔴 Both sides are required at the DATABASE level for anything published.
  -- The site is bilingual and next-intl cannot help here: this content is rows,
  -- not message files. A published event missing one language is an Arabic
  -- visitor landing on English copy, which the whole i18n rule in CLAUDE.md
  -- exists to prevent. Drafts are exempt, because half-written is a normal
  -- state and losing the work is not.
  title_en    text        check (char_length(title_en) between 1 and 160),
  title_ar    text        check (char_length(title_ar) between 1 and 160),
  summary_en  text        check (char_length(summary_en) <= 400),
  summary_ar  text        check (char_length(summary_ar) <= 400),
  description_en text     check (char_length(description_en) <= 6000),
  description_ar text     check (char_length(description_ar) <= 6000),
  host_en     text        check (char_length(host_en) <= 160),
  host_ar     text        check (char_length(host_ar) <= 160),
  location_en text        check (char_length(location_en) <= 200),
  location_ar text        check (char_length(location_ar) <= 200),

  -- Recurring series -----------------------------------------------------
  -- MAZJ runs four of them (Coffee & Sketch reached V9). The edition marker is
  -- what the deleted "series poster cards" on /events were really conveying,
  -- and it says it in place instead of duplicating the row in a second section.
  series      text        check (char_length(series) <= 60),
  edition     text        check (char_length(edition) <= 12),

  -- When -----------------------------------------------------------------
  -- UTC. The venue is UTC+3; conversion happens once, at render, through
  -- server/domain/riyadh-time.ts.
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,

  -- 🔴 How much of `starts_at` is actually KNOWN, which is not the same question
  -- as what it contains. A timestamptz always holds a clock time; that does not
  -- mean anybody recorded one.
  --
  --   exact  a real time was entered. Render "Saturday 12 October, 7:00 PM".
  --   day    the day is known, the time is not. Render "12 October 2023".
  --   month  only the month is known. Render "October 2023".
  --
  -- Four of the imported historical events record only a month ("February
  -- 2024"), and none of the 41 records a time. Storing a placeholder hour and
  -- then rendering it would be inventing a fact and publishing it. Precision
  -- travels with the value so the formatter can tell the truth instead.
  --
  -- New events created in the admin are always 'exact': the form asks for a
  -- time and refuses to publish without one.
  date_precision text     not null default 'exact'
                          check (date_precision in ('exact', 'day', 'month')),

  -- Poster ---------------------------------------------------------------
  -- Object path inside the `event-posters` storage bucket. Null renders the
  -- .dot-field texture the quiet routes already use, never a broken frame.
  poster_path text        check (char_length(poster_path) <= 400),

  -- Capacity -------------------------------------------------------------
  -- Null means unlimited. Al-Ma'arij seats 30, which is the number this exists
  -- to respect.
  capacity    integer     check (capacity is null or capacity between 1 and 5000),

  -- Ticketing ------------------------------------------------------------
  -- 🔴 The IMMUTABLE id, never Rekaz's `id`. Price ids rotate whenever anyone
  -- edits a price in the Rekaz dashboard, so an event stored against `id` stops
  -- being buyable the first time the owner corrects a typo in the amount, with
  -- nothing anywhere to notice. The live id is resolved from GET /products at
  -- purchase time. Same rule server/services/booking.ts already follows.
  --
  -- Null means the event is FREE. That is the whole switch.
  rekaz_price_immutable_id text
                          check (char_length(rekaz_price_immutable_id) between 8 and 64),

  -- ⚠️ DISPLAY ONLY, and never used to charge anybody. A snapshot taken when
  -- the price was picked, so the admin list can show "50 SAR" without a Rekaz
  -- round trip. What is actually billed is whatever that immutable price costs
  -- at the moment of purchase, resolved server-side. Storing a price and then
  -- billing it is exactly the class of bug the booking service exists to stop.
  ticket_amount numeric(10, 2) check (ticket_amount is null or ticket_amount >= 0),

  -- An event that ends before it starts is a data-entry slip that would sort
  -- into the archive the moment it was published. Caught here so a future admin
  -- tool, a manual SQL insert or a bulk import cannot create one either.
  constraint events_ends_after_start check (ends_at > starts_at),

  -- The bilingual gate, enforced for published events only.
  constraint events_published_is_bilingual check (
    status <> 'published'
    or (title_en is not null and title_ar is not null
        and summary_en is not null and summary_ar is not null)
  )
);

comment on table public.events is
  'Events MAZJ hosts. NOT a Rekaz room booking; Rekaz owns those.';
comment on column public.events.rekaz_price_immutable_id is
  'Null means free. Otherwise the Rekaz price immutableId; the live id is resolved at purchase.';
comment on column public.events.ticket_amount is
  'Display snapshot only. Never used to charge. The live price governs.';
comment on column public.events.date_precision is
  'exact | day | month. How much of starts_at was actually recorded, not what it contains.';

-- The public list asks exactly one question: what is published, and when does
-- it start. Both directions of that sort are served by this one index.
create index events_published_starts_at_idx
  on public.events (starts_at desc)
  where status = 'published';

-- The admin list is everything, newest first, drafts included.
create index events_created_at_idx on public.events (created_at desc);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registrations
-- ---------------------------------------------------------------------------

create table public.event_registrations (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  event_id    uuid        not null references public.events (id) on delete cascade,

  -- Who ------------------------------------------------------------------
  full_name   text        not null check (char_length(full_name) between 2 and 120),
  email       text        check (char_length(email) between 3 and 254),
  -- E.164, normalised by server/domain/phone.ts before it ever reaches here.
  -- That module handles Arabic-Indic digits (U+0660-0669), which is whether the
  -- Arabic half of the site works, not a nicety. A correct Saudi value is
  -- always exactly 13 characters.
  phone_e164  text        not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),

  -- State ----------------------------------------------------------------
  --   confirmed        a seat, held permanently
  --   pending_payment  a seat, held until hold_expires_at, then released
  --   expired          the hold lapsed; the row survives as evidence
  --   cancelled        withdrawn by an admin
  status      text        not null default 'confirmed'
                          check (status in ('confirmed', 'pending_payment',
                                            'expired', 'cancelled')),
  hold_expires_at timestamptz,

  -- Rekaz ----------------------------------------------------------------
  -- The subscription code, once Rekaz answers. It is what lets a human resolve
  -- a payment by hand, and Rekaz exposes no way to recover a payment link for
  -- an existing order, so this is the only thread back.
  rekaz_reference text     check (char_length(rekaz_reference) <= 120),
  -- ⚠️ Stored so an interrupted buyer gets the SAME checkout rather than a
  -- second order. Effectively a capability URL, which is why it is only ever
  -- handed back to a request presenting the same mobile number, and why this
  -- table is unreachable without the secret key. Same property the booking
  -- flow's idempotency replay already has.
  rekaz_payment_link text  check (char_length(rekaz_payment_link) <= 2000),

  -- Provenance -----------------------------------------------------------
  locale      text        not null default 'en' check (locale in ('en', 'ar')),
  -- Salted HMAC, never the address. A bare IP is personal data under PDPL; a
  -- hash still supports abuse investigation while identifying nobody on its own.
  ip_hash     text        check (char_length(ip_hash) <= 128),

  -- 🔴 ONE row per person per event, forever. This is what makes a double-tap
  -- on the free path naturally idempotent, and it is unconditional rather than
  -- partial on purpose: somebody whose hold expired re-claims by UPDATING their
  -- existing row, so the registration list never grows a second entry for the
  -- same human.
  constraint event_registrations_one_per_mobile unique (event_id, phone_e164),

  -- A held seat with no expiry never releases, and an expiry on a permanent
  -- seat is a lie the seat counter would eventually believe.
  constraint event_registrations_hold_matches_status check (
    (status = 'pending_payment' and hold_expires_at is not null)
    or (status <> 'pending_payment' and hold_expires_at is null)
  )
);

comment on table public.event_registrations is
  'Who signed up for a MAZJ event. Server-only; no browser ever reads this.';
comment on column public.event_registrations.rekaz_payment_link is
  'Absolutised checkout URL. Handed back on retry so a buyer never creates two orders.';

-- The admin reads one event's list, newest first. The only access pattern.
create index event_registrations_event_created_idx
  on public.event_registrations (event_id, created_at desc);

-- Seat counting reads live holds constantly; expiring them reads dead ones.
create index event_registrations_holds_idx
  on public.event_registrations (event_id, hold_expires_at)
  where status = 'pending_payment';

create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;
revoke all on table public.event_registrations from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Claiming a seat, atomically
-- ---------------------------------------------------------------------------

-- 🔴 THIS IS A SQL FUNCTION AND NOT APPLICATION CODE, for one reason.
--
-- Counting seats and then inserting a registration is two statements, and two
-- concurrent requests both read "one seat left" before either writes. Both
-- succeed. The event is oversubscribed and nothing anywhere notices until
-- thirty-one people arrive at a room that seats thirty. No amount of care in
-- TypeScript closes that: the gap is between the statements, not in them.
--
-- The `for update` on the event row serializes every claim for THAT event, and
-- only that event. Two different events never block each other, which is
-- exactly the granularity wanted: a popular event's queue is short-lived and
-- an unrelated one is unaffected.
--
-- Outcomes, all four of which the caller renders differently:
--   claimed    a seat is theirs
--   duplicate  they already hold one (reported to them as good news, not an
--              error, because from their side it is)
--   full       capacity reached
--   closed     not published, or already started
--   not_found  no such event
create or replace function public.event_claim_seat(
  p_event_id     uuid,
  p_full_name    text,
  p_email        text,
  p_phone_e164   text,
  p_locale       text,
  p_ip_hash      text,
  -- 0 or null means confirm immediately, i.e. a free event. Anything else holds
  -- the seat for that many seconds while the buyer is at Rekaz's checkout.
  p_hold_seconds integer
)
returns table (
  outcome             text,
  registration_id     uuid,
  registration_status text,
  seats_left          integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now        timestamptz := now();
  v_status     text;
  v_starts_at  timestamptz;
  v_capacity   integer;
  v_taken      integer;
  v_existing   public.event_registrations%rowtype;
  v_new_status text;
  v_hold       timestamptz;
  v_id         uuid;
begin
  -- Serialize claims for this event. Everything below runs alone.
  select e.status, e.starts_at, e.capacity
    into v_status, v_starts_at, v_capacity
  from public.events e
  where e.id = p_event_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text, null::integer;
    return;
  end if;

  -- Registration closes when the event starts. One rule, no extra column, and
  -- nothing to misconfigure.
  if v_status <> 'published' or v_starts_at <= v_now then
    return query select 'closed'::text, null::uuid, null::text, null::integer;
    return;
  end if;

  -- Opportunistic release of dead holds, on roughly one call in fifty. Keeps
  -- the seat count honest without depending on pg_cron being enabled, the same
  -- trick rate_limit_hit uses to stay bounded. Note this runs INSIDE the row
  -- lock, so it can never race the count below it.
  if random() < 0.02 then
    update public.event_registrations r
       set status = 'expired', hold_expires_at = null
     where r.event_id = p_event_id
       and r.status = 'pending_payment'
       and r.hold_expires_at <= v_now;
  end if;

  select * into v_existing
  from public.event_registrations r
  where r.event_id = p_event_id
    and r.phone_e164 = p_phone_e164;

  if found then
    -- A live claim of any kind is a duplicate. The caller decides what to say:
    -- a confirmed seat gets "you are on the list", a live hold gets the stored
    -- payment link back rather than a second Rekaz order.
    if v_existing.status = 'confirmed'
       or (v_existing.status = 'pending_payment'
           and v_existing.hold_expires_at > v_now) then
      return query select 'duplicate'::text, v_existing.id, v_existing.status,
                          null::integer;
      return;
    end if;
    -- Otherwise their previous claim expired or was cancelled. They may claim
    -- again, but only if there is still room, so fall through to the count.
  end if;

  -- A seat is taken by a confirmed registration, or by a hold that has not yet
  -- lapsed. Expired holds simply stop counting, which is the entire mechanism
  -- behind the 30-minute release.
  select count(*) into v_taken
  from public.event_registrations r
  where r.event_id = p_event_id
    and (r.status = 'confirmed'
         or (r.status = 'pending_payment' and r.hold_expires_at > v_now));

  if v_capacity is not null and v_taken >= v_capacity then
    return query select 'full'::text, null::uuid, null::text, 0;
    return;
  end if;

  if p_hold_seconds is null or p_hold_seconds <= 0 then
    v_new_status := 'confirmed';
    v_hold := null;
  else
    v_new_status := 'pending_payment';
    v_hold := v_now + make_interval(secs => p_hold_seconds);
  end if;

  if v_existing.id is not null then
    -- Re-claiming after a lapsed hold. Updated rather than inserted so the
    -- registration list never shows the same person twice.
    update public.event_registrations r
       set full_name = p_full_name,
           email = p_email,
           locale = p_locale,
           ip_hash = p_ip_hash,
           status = v_new_status,
           hold_expires_at = v_hold,
           rekaz_reference = null,
           rekaz_payment_link = null
     where r.id = v_existing.id
    returning r.id into v_id;
  else
    insert into public.event_registrations
      (event_id, full_name, email, phone_e164, locale, ip_hash,
       status, hold_expires_at)
    values
      (p_event_id, p_full_name, p_email, p_phone_e164, p_locale, p_ip_hash,
       v_new_status, v_hold)
    returning id into v_id;
  end if;

  return query select 'claimed'::text, v_id, v_new_status,
                      case when v_capacity is null
                           then null::integer
                           else v_capacity - (v_taken + 1) end;
end;
$$;

comment on function public.event_claim_seat(uuid, text, text, text, text, text, integer) is
  'Atomically claims one seat. Serializes on the event row. Returns claimed|duplicate|full|closed|not_found.';

-- Postgres grants EXECUTE to PUBLIC by default, which would expose this over
-- PostgREST's /rpc/ endpoint to anonymous callers, i.e. an unauthenticated way
-- to write registrations.
revoke all on function public.event_claim_seat(uuid, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.event_claim_seat(uuid, text, text, text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Releasing a hold that was never paid
-- ---------------------------------------------------------------------------

-- Called on the read path for one event, so a page load is enough to keep the
-- seat count honest even on an event nobody is currently registering for. Cheap
-- (the partial index above serves it exactly) and idempotent.
create or replace function public.event_expire_holds(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.event_registrations r
     set status = 'expired', hold_expires_at = null
   where r.event_id = p_event_id
     and r.status = 'pending_payment'
     and r.hold_expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.event_expire_holds(uuid) is
  'Releases lapsed payment holds for one event. Idempotent; safe on a read path.';

revoke all on function public.event_expire_holds(uuid)
  from public, anon, authenticated;
grant execute on function public.event_expire_holds(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Poster storage
-- ---------------------------------------------------------------------------

-- Public READ, because a poster is on a public marketing page and a signed URL
-- would expire mid-scroll. Writes are another matter entirely: NO policy is
-- created on storage.objects, so `anon` and `authenticated` cannot upload,
-- overwrite or delete anything. The only writer is the secret key, which
-- bypasses RLS by design and is only ever held by an authenticated admin action.
--
-- The MIME allowlist and size cap are enforced HERE as well as in the action.
-- The action's check is the one that gives a human a sensible error; this one
-- is the one that holds when somebody later adds a second upload path and
-- forgets.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-posters',
  'event-posters',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
