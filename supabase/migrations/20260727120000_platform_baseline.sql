-- Platform baseline.
--
-- The pieces every later feature leans on: a shared updated_at trigger, an
-- atomic rate limiter, and idempotency-key storage.
--
-- SECURITY POSTURE, applied to every table in this file and every table added
-- after it:
--
--   1. Row Level Security is enabled in the same statement block that creates
--      the table. A table is never reachable, not even for a moment.
--   2. No policies are created. RLS with zero policies denies everything.
--   3. Privileges are explicitly revoked from `anon` and `authenticated`.
--      This is not redundant with RLS: Supabase installs DEFAULT PRIVILEGES
--      granting those roles table access, so a future policy added in haste
--      would otherwise open the table immediately. Revoking means two separate
--      mistakes are required to expose anything.
--
-- Reachable therefore only via the secret key, which bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- `set search_path = ''` plus fully-qualified names throughout. A mutable
-- search_path on a SECURITY DEFINER function is a privilege-escalation vector
-- (a caller can point `public` at their own schema and hijack a call), and
-- Supabase's own security advisor flags it as `function_search_path_mutable`.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger function: stamps updated_at on every UPDATE.';

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------

-- Why this lives in the database rather than in process memory: the app runs on
-- serverless functions. Each concurrent instance has its own heap, so an
-- in-memory counter limits each instance separately, and the effective limit
-- becomes (configured limit x instance count) which is not a limit at all.
-- Postgres is the only thing all instances agree on.
create table public.rate_limit_counters (
  bucket        text        primary key,
  window_start  timestamptz not null,
  count         integer     not null
);

comment on table public.rate_limit_counters is
  'Fixed-window rate limit counters, one row per bucket. Server-only.';
comment on column public.rate_limit_counters.bucket is
  'Opaque key, conventionally "<scope>:<hashed client identity>".';

alter table public.rate_limit_counters enable row level security;
revoke all on table public.rate_limit_counters from anon, authenticated;

-- Records a hit and reports whether it is allowed, atomically.
--
-- The whole decision is one INSERT ... ON CONFLICT DO UPDATE. That matters: a
-- read-then-write limiter loses races under exactly the concurrent load it is
-- supposed to defend against, letting a burst straight through. Here the
-- expired-window reset and the increment happen inside a single statement, so
-- Postgres' row lock does the mutual exclusion for us.
create or replace function public.rate_limit_hit(
  p_bucket          text,
  p_limit           integer,
  p_window_seconds  integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_start  timestamptz;
  v_count  integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'rate_limit_hit: limit and window must be >= 1';
  end if;

  insert into public.rate_limit_counters as c (bucket, window_start, count)
  values (p_bucket, v_now, 1)
  on conflict (bucket) do update
    set window_start = case
          when c.window_start + make_interval(secs => p_window_seconds) <= v_now
            then v_now
          else c.window_start
        end,
        count = case
          when c.window_start + make_interval(secs => p_window_seconds) <= v_now
            then 1
          else c.count + 1
        end
  returning c.window_start, c.count into v_start, v_count;

  -- Opportunistic garbage collection, on roughly 1 call in 200. Keeps the table
  -- bounded without depending on pg_cron being enabled. Cheap because
  -- window_start is indexed by nothing but the table is tiny by construction.
  if random() < 0.005 then
    delete from public.rate_limit_counters
    where window_start < v_now - interval '1 day';
  end if;

  return query select
    (v_count <= p_limit),
    greatest(p_limit - v_count, 0),
    (v_start + make_interval(secs => p_window_seconds));
end;
$$;

comment on function public.rate_limit_hit(text, integer, integer) is
  'Atomically records a hit in a fixed window. Returns allowed/remaining/reset_at.';

-- Functions are granted EXECUTE to PUBLIC by default in Postgres, which would
-- expose this over PostgREST's /rpc/ endpoint to anonymous callers.
revoke all on function public.rate_limit_hit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Idempotency
-- ---------------------------------------------------------------------------

-- Rekaz's public API offers no idempotency keys (see docs/rekaz-api-review-ar.md
-- section 4.4), so a double-tapped booking button or an automatic retry after a
-- dropped connection can create two reservations. We own that problem, and the
-- shape below is the one Stripe uses:
--
--   * first request  -> row inserted as in_progress, work runs, response stored
--   * replay         -> stored response returned, work does not run again
--   * key reused
--     with a different body -> rejected, because silently returning the first
--                              response for a different request is worse than
--                              an error
create table public.idempotency_keys (
  id                   uuid        primary key default gen_random_uuid(),
  scope                text        not null,
  idempotency_key      text        not null,
  request_fingerprint  text        not null,
  status               text        not null default 'in_progress'
                                   check (status in ('in_progress', 'completed')),
  response_status      integer,
  response_body        jsonb,
  created_at           timestamptz not null default now(),
  completed_at         timestamptz,

  constraint idempotency_keys_unique unique (scope, idempotency_key),
  constraint idempotency_keys_completed_has_response check (
    status <> 'completed'
    or (response_status is not null and response_body is not null)
  )
);

comment on table public.idempotency_keys is
  'Stored responses keyed by (scope, idempotency_key). Server-only.';
comment on column public.idempotency_keys.request_fingerprint is
  'Hash of the request body. Detects a key reused for a different request.';

create index idempotency_keys_created_at_idx
  on public.idempotency_keys (created_at desc);

alter table public.idempotency_keys enable row level security;
revoke all on table public.idempotency_keys from anon, authenticated;
