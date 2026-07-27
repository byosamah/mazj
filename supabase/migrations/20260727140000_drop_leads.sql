-- Drops `leads`, and decouples the health check from business tables.
--
-- WHY: `leads` was the proving slice for the backend foundation. It did its job
-- (it demonstrated the whole path end to end: validation, rate limiting,
-- idempotency, Arabic-Indic phone normalisation, RLS, error mapping) and no part
-- of the site ever called it. The owner has not yet specified what the product
-- needs, so keeping a speculative table in production is the wrong default.
--
-- It is recoverable: the table definition, the domain rules and the tests are in
-- git at commit 64abee4. Re-adding it is one `git show` away if a form, waitlist
-- or founding-member signup turns out to need it. What is NOT recoverable is any
-- data, and there was none: the table held 0 rows when it was dropped.
--
-- 🔴 `/api/health` used to prove liveness by querying `leads`, which coupled a
-- health check to a business table. That was a latent design flaw, exposed the
-- moment the table went away. A health check should depend on nothing but the
-- database being reachable, so it now calls the function below.

-- ---------------------------------------------------------------------------
-- Liveness probe
-- ---------------------------------------------------------------------------

-- Deliberately trivial and side-effect free. Its only job is to prove the whole
-- chain works: environment parsing, client construction, network, credentials,
-- PostgREST, and Postgres answering. It must never gain a dependency on an
-- application table, or an unrelated migration can take the health check down.
create or replace function public.health_ping()
returns timestamptz
language sql
security definer
set search_path = ''
stable
as $$
  select now();
$$;

comment on function public.health_ping() is
  'Liveness probe. Returns now(). Must never depend on an application table.';

-- Functions are granted EXECUTE to PUBLIC by default, which would expose this
-- over PostgREST's /rpc/ endpoint to anonymous callers.
revoke all on function public.health_ping() from public, anon, authenticated;
grant execute on function public.health_ping() to service_role;

-- ---------------------------------------------------------------------------
-- Drop
-- ---------------------------------------------------------------------------

-- The trigger, both indexes and every check constraint belong to the table and
-- go with it. `set_updated_at()` is shared infrastructure and stays.
drop table if exists public.leads;
