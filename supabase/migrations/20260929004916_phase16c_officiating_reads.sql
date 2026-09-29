-- Officials tab, slice 5 of docs/proposals/tournament-roles-and-entrant-portal.md.
-- manage_officiating's WRITE side has worked since phase8c (toff_write already checks
-- has_tournament_permission) -- the READ side never did: officials_read and toff_read
-- are both is_org_member-only, and a Referee Coordinator is tournament_staff, not an org
-- member. Same bug class phase10a fixed for tournament_entries/categories. Confirmed
-- live before writing this (a referee coordinator read zero rows from both tables)
-- rather than assumed.
--
-- org_officials stays org_admin-write-only on purpose (§0l: it's the org's whole pool
-- across every tournament, so routing a WRITE through one arbitrary tournament's
-- permission has no principled answer) -- only the READ side widens, so a coordinator
-- can see who's in the pool to assign, never add or edit one.

create or replace function public.can_view_org_officials(p_org_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_member(p_org_id)
      or exists (
        select 1 from public.tournaments t
         where t.org_id = p_org_id
           and public.has_tournament_permission('manage_officiating', t.id)
      );
$$;

drop policy if exists officials_read on public.org_officials;
create policy officials_read on public.org_officials for select to authenticated
using (public.can_view_org_officials(org_id) or user_id = auth.uid());

drop policy if exists toff_read on public.tournament_officials;
create policy toff_read on public.tournament_officials for select to authenticated
using (
  public.is_org_member(org_id)
  or public.has_tournament_permission('manage_officiating', tournament_id)
  or exists (select 1 from public.org_officials o where o.id = tournament_officials.official_id and o.user_id = auth.uid())
);

revoke all on function public.can_view_org_officials(uuid) from public, anon;
grant execute on function public.can_view_org_officials(uuid) to authenticated, service_role;
