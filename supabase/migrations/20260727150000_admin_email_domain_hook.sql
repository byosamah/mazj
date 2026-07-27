-- Gate 2 of 3: no account may exist for an address outside @mazj.org.
--
-- Gate 1 (server/services/admin-auth.ts) refuses to SEND a link to an outsider.
-- Gate 3 (app/admin/(protected)/layout.tsx) refuses to SERVE a page to one.
-- This gate refuses to let the account EXIST, which is the one that holds even
-- if the application code is bypassed entirely: a request straight to
-- Supabase's own /auth/v1/otp endpoint with the publishable key, which is public
-- by design and printed in every browser bundle, skips gates 1 and 3 completely.
-- Without this, that request creates a real auth.users row for any address on
-- earth and mails them a working link.
--
-- Runs as Supabase's "Before User Created" hook. Registered separately against
-- the project config as:
--   pg-functions://postgres/public/enforce_admin_email_domain
-- A migration alone does NOT activate it. Both halves are required.
--
-- 🔴 This function must stay behaviourally identical to `isAllowedAdminEmail`
-- in server/domain/admin-access.ts. Two gates that disagree about who is allowed
-- in are worse than one gate, because the gap between them is invisible in both
-- files. The rules, in the same order as the TypeScript:
--   1. must be a non-empty string, at most 254 characters (RFC 5321)
--   2. no whitespace and no control characters anywhere
--   3. exactly one "@" (stricter than RFC 5321, deliberately: it kills the
--      quoted-local-part trick '"x@mazj.org"@evil.com' on a second ground)
--   4. the domain, lowercased, is exactly 'mazj.org'
--
-- Subdomains are refused: mail.mazj.org can be delegated separately and is not
-- the same trust boundary as the apex.

create or replace function public.enforce_admin_email_domain(event jsonb)
returns jsonb
language plpgsql
stable
-- Required by Supabase's advisor and a genuine privilege-escalation vector
-- otherwise: without it a caller can point `public` at their own schema and
-- hijack any unqualified name this function resolves.
set search_path = ''
as $$
declare
  raw_email  text;
  at_count   int;
  at_pos     int;
  domain     text;
begin
  raw_email := btrim(event -> 'user' ->> 'email');

  -- 1. present and plausibly sized
  if raw_email is null or raw_email = '' or length(raw_email) > 254 then
    return public.admin_domain_rejection();
  end if;

  -- 2. no whitespace, no control characters. A trailing newline is how a copied
  --    address smuggles a second header into a mail send, and btrim above would
  --    have removed it while leaving an internal one intact.
  if raw_email ~ '[[:space:]]' or raw_email ~ '[[:cntrl:]]' then
    return public.admin_domain_rejection();
  end if;

  -- 3. exactly one "@", and not at either end
  at_count := length(raw_email) - length(replace(raw_email, '@', ''));
  if at_count <> 1 then
    return public.admin_domain_rejection();
  end if;

  at_pos := position('@' in raw_email);
  if at_pos <= 1 or at_pos = length(raw_email) then
    return public.admin_domain_rejection();
  end if;

  -- 4. exact domain match, case-insensitive because DNS is. Comparing against
  --    an ASCII literal also rejects homograph domains: a Cyrillic 'а' in
  --    'mаzj.org' renders identically and compares unequal.
  domain := lower(substring(raw_email from at_pos + 1));
  if domain <> 'mazj.org' then
    return public.admin_domain_rejection();
  end if;

  -- Empty object = allow. Anything else would be interpreted as a decision.
  return '{}'::jsonb;
end;
$$;

-- The rejection payload, in one place so every branch above refuses identically.
--
-- The message is deliberately vague. It surfaces to whoever attempted the
-- signup, so naming the permitted domain here would hand an outsider the exact
-- thing they were probing for.
create or replace function public.admin_domain_rejection()
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This email address cannot be used to sign in.'
    )
  );
$$;

-- Supabase's auth service runs hooks as `supabase_auth_admin`, which needs to
-- reach the schema and the functions.
grant usage on schema public to supabase_auth_admin;

grant execute on function public.enforce_admin_email_domain(jsonb)
  to supabase_auth_admin;
grant execute on function public.admin_domain_rejection()
  to supabase_auth_admin;

-- 🔴 Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- expose both over PostgREST's /rpc/ endpoint to anonymous callers. Revoking is
-- not optional: `enforce_admin_email_domain` is an oracle that answers "is this
-- address allowed into MAZJ's admin?" for anyone who can call it.
revoke execute on function public.enforce_admin_email_domain(jsonb)
  from public, anon, authenticated;
revoke execute on function public.admin_domain_rejection()
  from public, anon, authenticated;

comment on function public.enforce_admin_email_domain(jsonb) is
  'Supabase Before User Created hook. Refuses any signup outside @mazj.org. '
  'Must stay behaviourally identical to isAllowedAdminEmail() in '
  'server/domain/admin-access.ts.';
