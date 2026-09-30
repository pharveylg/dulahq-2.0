-- A linked official (org_officials.user_id) already has RLS letting them read
-- their own org_officials row and tournament_officials assignments directly
-- (phase16c's self-branches) -- but nothing lets them read the *tournament's*
-- own name, since tournaments_member_read/tournaments_staff_read only cover
-- org members and tournament_staff, and a private tournament isn't in
-- public_tournaments either. A plain embedded select would silently return
-- tournaments: null for exactly the rows this page needs to show. Same shape
-- as entrant_entry_portal() needing a definer function for the same reason.
--
-- Self-scoped only (auth.uid(), no parameter) -- there is nothing to
-- authorize beyond "this is your own row".
create or replace function public.my_officiating_assignments()
returns table (
  official_id uuid,
  org_id uuid,
  org_name text,
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  org_slug text,
  role text,
  event_date date,
  venue text
)
language sql stable security definer set search_path = public as $$
  select o.id, o.org_id, org.name, t.id, t.name, t.slug, org.slug, tof.role, t.event_date, t.venue
  from public.org_officials o
  join public.organizations org on org.id = o.org_id
  join public.tournament_officials tof on tof.official_id = o.id
  join public.tournaments t on t.id = tof.tournament_id
  where o.user_id = auth.uid()
  order by t.event_date desc nulls last, t.name;
$$;

revoke all on function public.my_officiating_assignments() from public, anon;
grant execute on function public.my_officiating_assignments() to authenticated;
