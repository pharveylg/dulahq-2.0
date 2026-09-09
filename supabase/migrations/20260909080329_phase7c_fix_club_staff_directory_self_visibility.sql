-- Found live while verifying P1-7: a coach's own Staff row now showed
-- "Unknown" for THEMSELVES -- worse than before club_staff_directory()
-- existed. club_staff_read (the base table policy) has always been
-- `can_read_club(...) OR user_id = auth.uid()`, so a coach could at least
-- see their own name via the old (broken-for-others) embedded join, since
-- that embed hits their own users row, which passes users' self-read
-- policy fine. Routing every lookup through club_staff_directory(), gated
-- on can_read_club() alone with no self-branch, silently dropped that case.
create or replace function public.club_staff_directory(p_club_id uuid)
returns table (user_id uuid, name text, email text, role text, status text)
language sql stable security definer set search_path = public as $$
  select cs.user_id, u.name, u.email, cs.role, cs.status
  from public.club_staff cs
  join public.users u on u.id = cs.user_id
  join public.clubs c on c.id = cs.club_id
  where cs.club_id = p_club_id
    and (public.can_read_club(c.org_id, p_club_id) or cs.user_id = auth.uid())
  order by u.name;
$$;
