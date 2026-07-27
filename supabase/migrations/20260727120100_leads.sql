-- Leads: someone told us they are interested in a space.
--
-- This is the proving slice for the backend foundation. It was chosen because
-- every plausible direction the product takes (booking, waitlist, founding
-- members, event RSVPs, a contact form) needs lead capture underneath it, and
-- because it can be exercised end to end without changing a single component on
-- the site.
--
-- 🔴 Rekaz remains the system of record for reservations, subscriptions,
-- invoices and ZATCA compliance. A lead is explicitly NOT a reservation. It is
-- first-party interest captured before any commitment exists, which is data
-- Rekaz has no concept of and therefore data we genuinely own.
--
-- PDPL note: every personal column below is nullable except the interest
-- itself, and the client IP is stored only as a salted hash. Collect the
-- minimum, keep it identifiable for no longer than it is useful.

create table public.leads (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Who ------------------------------------------------------------------
  full_name   text check (char_length(full_name) between 1 and 120),
  email       text check (char_length(email) between 3 and 254),
  -- E.164, normalised in the domain layer before it ever reaches this table.
  -- Storing a single canonical format is what makes deduplication and any
  -- future WhatsApp or SMS integration possible without a parsing step.
  phone_e164  text check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),

  -- What they want -------------------------------------------------------
  -- `text` + check rather than a Postgres enum on purpose: adding a value to an
  -- enum inside a transaction is restricted and dropping one is impossible,
  -- whereas a check constraint is a single ALTER. These values mirror the four
  -- products in lib/links.ts (BOOKING). A unit test asserts they stay in sync.
  interest    text        not null check (
                interest in ('shared_seat', 'private_office',
                             'meeting_room', 'event_hall', 'other')),
  note        text check (char_length(note) <= 2000),

  -- Where it came from ---------------------------------------------------
  locale      text        not null default 'en' check (locale in ('en', 'ar')),
  source      text        not null default 'web'
                          check (char_length(source) between 1 and 40),
  page_path   text check (char_length(page_path) <= 512),

  -- Operations -----------------------------------------------------------
  status      text        not null default 'new' check (
                status in ('new', 'contacted', 'converted', 'archived')),

  -- Privacy --------------------------------------------------------------
  -- Salted hash, never the address itself. A bare IP is personal data under
  -- PDPL; a salted hash still supports abuse investigation and per-client rate
  -- limiting while identifying nobody on its own.
  ip_hash     text,
  consent_at  timestamptz,

  -- A lead with no way to reach them is not a lead, it is noise. Enforced here
  -- rather than only in application code so that a future admin tool, a manual
  -- SQL insert or a bulk import cannot create one either.
  constraint leads_needs_a_contact_channel check (
    email is not null or phone_e164 is not null
  )
);

comment on table public.leads is
  'First-party interest captured on mazj. NOT a reservation; Rekaz owns those.';
comment on column public.leads.interest is
  'Mirrors the four products in lib/links.ts BOOKING, plus "other".';
comment on column public.leads.ip_hash is
  'Salted hash of the client IP. Never store the address itself (PDPL).';

-- Operations reads newest-first; that is the only access pattern today.
create index leads_created_at_idx on public.leads (created_at desc);
-- Partial: the working queue is almost always "what has nobody handled yet".
create index leads_open_idx on public.leads (created_at desc)
  where status in ('new', 'contacted');

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
revoke all on table public.leads from anon, authenticated;
