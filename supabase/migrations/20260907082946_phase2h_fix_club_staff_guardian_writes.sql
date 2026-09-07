-- Reconstructed from the live project (applied 2026-09-07, not captured in
-- the original migration batch). Matches supabase migration history version
-- 20260907082946 exactly by content, not necessarily by original diff form.
--
-- Phase 2e wrote guardians_staff_write and player_guardians' pg_write with
-- `using (is_org_admin(org_id))` -- so a club_admin whose access comes from
-- club_staff, with no org_members row, could not create or link guardians
-- for their own club's players. guardians_read also lacked a path for
-- plain club_staff (any role) or org_admin to read a club's guardians.
--
-- is_staff_in_org is introduced here as the name these policies use; it is
-- a thin wrapper over is_org_member (widened next, in phase2i).
create or replace function public.is_staff_in_org(p_org uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.is_org_member(p_org);
$function$;

drop policy if exists guardians_staff_write on public.guardians;
create policy guardians_staff_write on public.guardians for all to authenticated
  using (public.is_staff_in_org(org_id))
  with check (public.is_staff_in_org(org_id));

drop policy if exists guardians_read on public.guardians;
create policy guardians_read on public.guardians for select to authenticated
  using (
    public.is_staff_in_org(org_id) and (
      user_id = auth.uid()
      or exists (select 1 from public.player_guardians pg
                 join public.players p on p.id = pg.player_id
                 join public.teams t on t.id = p.team_id
                 where pg.guardian_id = guardians.id
                   and public.can_read_club(guardians.org_id, t.club_id))
      or public.is_org_admin(org_id)
      or exists (select 1 from public.club_staff cs
                 join public.clubs c on c.id = cs.club_id
                 where c.org_id = guardians.org_id
                   and cs.user_id = auth.uid())
    ));

drop policy if exists pg_write on public.player_guardians;
create policy pg_write on public.player_guardians for all to authenticated
  using (
    public.is_staff_in_org(org_id)
    and exists (select 1 from public.players p
                join public.teams t on t.id = p.team_id
                where p.id = player_guardians.player_id
                  and (public.can_admin_club(player_guardians.org_id, t.club_id)
                       or public.is_club_staff(t.club_id))))
  with check (public.is_staff_in_org(org_id));
