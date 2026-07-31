-- Seat counts for a batch of events, in one round trip.
--
-- 🔴 THE POINT IS NOT PERFORMANCE, IT IS HAVING ONE DEFINITION.
--
-- "A seat is taken by a confirmed registration, or by a hold that has not yet
-- lapsed" is a rule, and `event_claim_seat` already enforces it when SELLING a
-- seat. Counting them for DISPLAY in TypeScript would restate the same rule in
-- a second language, and the two would drift the first time anybody added a
-- status. The failure would be silent and it would be the worst kind: a page
-- advertising seats that the claim function refuses to sell, or refusing to
-- sell seats the page says are free.
--
-- So the rule lives here, once, and both the writer and the reader call it.
--
-- Takes an array so the /events list resolves every upcoming event's count in a
-- single query rather than one per card.

create or replace function public.event_seats_taken(p_event_ids uuid[])
returns table (event_id uuid, taken integer)
language sql
security definer
stable
set search_path = ''
as $$
  select e.id, count(r.id)::integer
  from unnest(p_event_ids) as e(id)
  left join public.event_registrations r
    on r.event_id = e.id
   and (r.status = 'confirmed'
        or (r.status = 'pending_payment' and r.hold_expires_at > now()))
  group by e.id;
$$;

comment on function public.event_seats_taken(uuid[]) is
  'Seats taken per event. The ONE definition of "taken"; event_claim_seat enforces the same rule.';

-- Postgres grants EXECUTE to PUBLIC by default, which would expose this over
-- PostgREST's /rpc/ endpoint. It leaks only counts, but an endpoint nobody
-- meant to publish is an endpoint nobody is watching.
revoke all on function public.event_seats_taken(uuid[])
  from public, anon, authenticated;
grant execute on function public.event_seats_taken(uuid[]) to service_role;
