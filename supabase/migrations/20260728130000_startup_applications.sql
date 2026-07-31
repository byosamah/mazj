-- The startups & builders offer: who applied, what was decided, and the code.
--
-- 🔴 Rekaz remains the system of record for bookings, invoices and ZATCA
-- compliance. It has no concept of "a startup applied for an offer" and, more
-- to the point, NO COUPON OR DISCOUNT API AT ALL (docs/rekaz-api-findings.md).
-- So the code stored here is not redeemable by software anywhere: it is an
-- entitlement a MAZJ person honours, and `redeemed_at` is how we know they did.
-- Any future work that tries to make this code apply itself at checkout should
-- read that findings document first.
--
-- Design record: docs/superpowers/specs/2026-07-28-startup-offer-design.md
--
-- SECURITY POSTURE, unchanged from the baseline: RLS enabled in the same
-- migration that creates the table, zero policies (RLS with no policy denies
-- everything), and privileges revoked from `anon` and `authenticated`, because
-- Supabase installs DEFAULT PRIVILEGES that RLS alone would leave one careless
-- policy away from exposing. Two separate mistakes are required to expose
-- anything. Reachable only by the secret key.

create table public.startup_applications (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Identity -------------------------------------------------------------
  -- The handle a human quotes. Shown on the confirmation screen and in every
  -- email, so that a founder messaging WhatsApp three days later has something
  -- to say other than "I applied". Generated in the domain layer from an
  -- unambiguous alphabet (`0`/`O` and `1`/`I` dropped as pairs), which is why
  -- the pattern below
  -- excludes them: a reference read aloud over a phone has to survive the trip.
  reference   text        not null unique
                          check (reference ~ '^MZ-[2-9A-HJ-NP-Z]{6}$'),

  -- Who ------------------------------------------------------------------
  founder_name text       not null check (char_length(founder_name) between 2 and 120),
  startup_name text       not null check (char_length(startup_name) between 1 and 120),
  email        text       not null check (char_length(email) between 3 and 254),
  -- E.164, normalised by server/domain/phone.ts before it ever reaches here.
  -- That module handles Arabic-Indic digits (U+0660-0669), which is whether the
  -- Arabic half of the site works, not a nicety. A correct Saudi value is
  -- always exactly 13 characters.
  phone_e164   text       not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),

  -- What they are building -----------------------------------------------
  -- 🔴 The floor of 20 characters is the only quality gate on this whole form,
  -- and it is deliberate. This column is the thing actually being judged, and a
  -- two-word pitch cannot be judged, so it would cost the owner a WhatsApp
  -- round trip on every such application. Twenty characters is roughly four
  -- words: low enough that a real founder in a hurry clears it without noticing,
  -- high enough that "hi" and "test" do not.
  pitch        text       not null check (char_length(pitch) between 20 and 2000),

  -- `text` + check rather than a Postgres enum: adding a value to an enum
  -- inside a transaction is restricted and dropping one is impossible, whereas
  -- a check constraint is a single ALTER.
  stage        text       not null check (stage in ('idea', 'building', 'earning')),
  team_size    integer    not null check (team_size between 1 and 200),
  -- Mirrors the four products in lib/links.ts BOOKING. Duplicated across the
  -- frontend/backend boundary rather than imported across it (the boundary is
  -- what keeps server/ liftable), and test/startup-offer-sync.test.ts asserts
  -- the two never drift. Same pattern `leads` used before it was dropped.
  space        text       not null check (
                 space in ('shared_seat', 'private_office',
                           'meeting_room', 'event_hall')),

  -- Provenance -----------------------------------------------------------
  -- Which language to write back in. An Arabic applicant receiving an English
  -- rejection is a small insult that costs nothing to avoid.
  locale       text       not null default 'en' check (locale in ('en', 'ar')),
  -- Salted HMAC, never the address. A bare IP is personal data under PDPL; a
  -- hash still supports abuse investigation while identifying nobody on its own.
  ip_hash      text       check (char_length(ip_hash) <= 128),
  -- Applying IS the consent, and the form discloses it above the button. Stamped
  -- rather than defaulted-and-forgotten so the record can answer "when".
  consent_at   timestamptz not null default now(),

  -- The decision ---------------------------------------------------------
  status       text       not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected')),
  decided_at   timestamptz,
  -- The admin's email address. Not a foreign key to auth.users: an admin who
  -- leaves and is deleted must not take the record of their decisions with them.
  decided_by   text       check (char_length(decided_by) <= 254),
  -- 🔴 On a rejection this is what the FOUNDER READS, verbatim, in an email with
  -- MAZJ's name on it. It is not an internal note. The 10-character floor in the
  -- constraint below is the database refusing to let anyone reject someone with
  -- "no".
  decision_note text      check (char_length(decision_note) <= 1000),

  -- The code -------------------------------------------------------------
  code         text       unique
                          check (code ~ '^MAZJ-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$'),
  -- ⚠️ STORED, never derived at read time from `decided_at` plus a constant.
  -- A derived expiry silently re-dates every code ever issued the day somebody
  -- changes the constant, including codes already printed in someone's inbox.
  code_expires_at timestamptz,

  -- Redemption -----------------------------------------------------------
  -- Set by a human in /admin when the offer is actually honoured. Since no
  -- software anywhere can consume this code (see the header), this pair is the
  -- ONLY answer to "did any of these founders ever turn up".
  redeemed_at  timestamptz,
  redeemed_by  text       check (char_length(redeemed_by) <= 254),

  -- Delivery -------------------------------------------------------------
  -- 🔴 A decision and its email are two separate facts, and this pair is what
  -- keeps them separate. The decision is committed first and the mail attempted
  -- after, so a Resend outage, an unverified domain or a missing key can never
  -- roll back an approval that has already been made. A failed send leaves the
  -- error here and the admin row renders a resend control.
  decision_email_sent_at timestamptz,
  decision_email_error   text check (char_length(decision_email_error) <= 500),

  -- Integrity ------------------------------------------------------------
  -- Enforced here rather than only in the service so that a future admin tool,
  -- a manual SQL update or a bulk import cannot create a half-decision either.

  -- A decision without a decider is unattributable.
  constraint startup_applications_decided_has_decider check (
    status = 'pending'
    or (decided_at is not null and decided_by is not null)
  ),

  -- An approval without a code is an approval nobody can act on.
  constraint startup_applications_approved_has_code check (
    status <> 'approved'
    or (code is not null and code_expires_at is not null)
  ),

  -- 🔴 THE OWNER'S REQUIREMENT, MADE STRUCTURAL. "If we rejected them, explain
  -- why." A rejection with no reason cannot be written to this table at all, so
  -- the explanation cannot be lost to a hurried afternoon or a future code path
  -- that forgets to ask for one.
  constraint startup_applications_rejected_has_reason check (
    status <> 'rejected'
    or (decision_note is not null and char_length(decision_note) >= 10)
  ),

  -- A pending application holding a code would be a code nobody decided to give.
  constraint startup_applications_pending_has_no_code check (
    status <> 'pending' or (code is null and code_expires_at is null)
  ),

  -- Something can only be redeemed if it was issued.
  constraint startup_applications_redeemed_needs_code check (
    redeemed_at is null or (code is not null and redeemed_by is not null)
  )
);

comment on table public.startup_applications is
  'Applications for the startups & builders offer, and the codes issued. Server-only.';
comment on column public.startup_applications.reference is
  'Human handle (MZ-XXXXXX) quoted by the applicant. Unambiguous alphabet.';
comment on column public.startup_applications.code is
  'The offer code. NOT redeemable by software: Rekaz has no coupon API. A person honours it.';
comment on column public.startup_applications.decision_note is
  'On a rejection, the reason the FOUNDER reads. Never an internal note.';
comment on column public.startup_applications.decision_email_error is
  'Why the decision email failed. The decision itself still stands.';

-- The admin list is everything, newest first.
create index startup_applications_created_at_idx
  on public.startup_applications (created_at desc);

-- The working queue is always "what has nobody answered yet".
create index startup_applications_pending_idx
  on public.startup_applications (created_at desc)
  where status = 'pending';

-- 🔴 One OPEN application per address. A second submission while the first is
-- unanswered is a duplicate, not a new lead, and without this the queue fills
-- with the same founder pressing the button again because nothing told them the
-- first one landed. Partial, so a rejected applicant may genuinely re-apply
-- later with a better pitch, which is the outcome a rejection email should
-- produce.
--
-- Lowercased because addresses are case-insensitive in practice and
-- `Founder@x.com` re-applying as `founder@x.com` is the same person.
create unique index startup_applications_one_pending_per_email_idx
  on public.startup_applications (lower(email))
  where status = 'pending';

create trigger startup_applications_set_updated_at
  before update on public.startup_applications
  for each row execute function public.set_updated_at();

alter table public.startup_applications enable row level security;
revoke all on table public.startup_applications from anon, authenticated;
