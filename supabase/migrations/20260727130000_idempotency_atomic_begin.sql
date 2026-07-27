-- Makes claiming an idempotency key atomic, and reclaimable.
--
-- Replaces a client-side insert-then-read-then-decide sequence, which had two
-- defects found by review:
--
-- 1. 🔴 AN `in_progress` ROW WAS NEVER RECLAIMED. If a request inserted the row
--    and then died before completing it, the key wedged at 409 "already being
--    processed" FOREVER. There was no TTL, no expiry predicate and no sweeper.
--    The client behaviour that triggers it is the correct one: retrying with
--    the same key. And the paths that strand a row are exactly the ones
--    idempotency exists to survive, including a serverless instance being
--    killed mid-request, and a transient database fault that fails the insert
--    AND the best-effort cleanup delete that follows it, since both hit the
--    same struggling dependency milliseconds apart.
--
-- 2. The read after a conflicting insert was a separate statement, so two
--    concurrent requests could interleave between them.
--
-- Both go away by doing the whole decision in one function. The staleness
-- window is what turns a wedged key into a self-healing one.

create or replace function public.idempotency_begin(
  p_scope               text,
  p_key                 text,
  p_fingerprint         text,
  p_stale_after_seconds integer default 90,
  p_retain_hours        integer default 24
)
returns table (outcome text, response_status integer, response_body jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_row public.idempotency_keys%rowtype;
begin
  -- Opportunistic garbage collection, roughly 1 call in 200, mirroring
  -- rate_limit_hit. Without it this table only ever grows. 24 hours is the
  -- conventional retention for idempotency keys; a replay after that window
  -- executes again, which is the standard trade-off and is why the window is
  -- far longer than any client retry loop.
  if random() < 0.005 then
    delete from public.idempotency_keys
    where created_at < v_now - make_interval(hours => p_retain_hours);
  end if;

  -- Fast path: nobody has used this key.
  insert into public.idempotency_keys (scope, idempotency_key, request_fingerprint, status)
  values (p_scope, p_key, p_fingerprint, 'in_progress')
  on conflict (scope, idempotency_key) do nothing;

  if found then
    return query select 'proceed'::text, null::integer, null::jsonb;
    return;
  end if;

  -- Reclaim a stale in-flight row. The predicate is part of the UPDATE, so
  -- exactly one concurrent caller can win it; the losers fall through and see
  -- the refreshed row as genuinely in flight.
  update public.idempotency_keys
     set request_fingerprint = p_fingerprint,
         created_at          = v_now,
         response_status     = null,
         response_body       = null
   where scope           = p_scope
     and idempotency_key = p_key
     and status          = 'in_progress'
     and created_at      < v_now - make_interval(secs => p_stale_after_seconds);

  if found then
    return query select 'proceed'::text, null::integer, null::jsonb;
    return;
  end if;

  select * into v_row
    from public.idempotency_keys
   where scope = p_scope and idempotency_key = p_key;

  -- Raced against a cleanup delete. Retrying is safe and will take the fast
  -- path; claiming it here would race the other caller's own retry.
  if not found then
    return query select 'retry'::text, null::integer, null::jsonb;
    return;
  end if;

  if v_row.request_fingerprint is distinct from p_fingerprint then
    return query select 'fingerprint_mismatch'::text, null::integer, null::jsonb;
    return;
  end if;

  if v_row.status = 'in_progress' then
    return query select 'in_flight'::text, null::integer, null::jsonb;
    return;
  end if;

  return query select 'replay'::text, v_row.response_status, v_row.response_body;
end;
$$;

comment on function public.idempotency_begin(text, text, text, integer, integer) is
  'Atomically claims an idempotency key. Returns proceed | replay | in_flight | fingerprint_mismatch | retry. Reclaims rows stranded by a crashed request.';

-- Postgres grants EXECUTE to PUBLIC by default, which would expose this over
-- PostgREST's /rpc/ endpoint to anonymous callers.
revoke all on function public.idempotency_begin(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.idempotency_begin(text, text, text, integer, integer)
  to service_role;

-- Supports both the staleness predicate and the retention sweep.
create index if not exists idempotency_keys_status_created_at_idx
  on public.idempotency_keys (status, created_at);
