-- Reconstructed from the live project (applied 2026-09-07, not captured in
-- the original migration batch). Matches supabase migration history version
-- 20260907083044 exactly by content, not necessarily by original diff form.
--
-- Phase 2e wrote almost every policy as `is_org_member(org_id) and (...)`.
-- But is_org_member only consulted role_assignments and org_members -- so
-- anyone whose access comes from club_staff, an assigned team, or a
-- guardian/player link, with no org_members row, was fenced out of THEIR
-- OWN club's teams, players, sessions and fees. Fixed at the source rather
-- than by patching every policy that gates on is_org_member: it now also
-- returns true for club staff, assigned coaches, guardians of a player in
-- the org, and the player themselves.
--
-- Re-verified after this change that the cross-tenant fence still holds --
-- a club_admin of Club A sees Club A and nothing of Org B. See
-- tests/rls/club-manager-isolation.test.ts, "org-level fencing" block.
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select org is not null and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.org_id = org)
    or exists (select 1 from public.org_members om
               where om.org_id = org
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
    -- staff of any club in this org are members of this org
    or exists (select 1 from public.club_staff cs
               join public.clubs c on c.id = cs.club_id
               where c.org_id = org and cs.user_id = auth.uid())
    -- so are coaches assigned to a team belonging to this org
    or exists (select 1 from public.user_assigned_teams uat
               join public.teams t on t.id = uat.team_id
               where t.org_id = org and uat.user_id = auth.uid())
    -- and guardians of a player in this org
    or exists (select 1 from public.guardians g
               join public.player_guardians pg on pg.guardian_id = g.id
               join public.players p on p.id = pg.player_id
               where p.org_id = org and g.user_id = auth.uid())
    -- and the player themselves
    or exists (select 1 from public.players p
               where p.org_id = org and p.user_id = auth.uid())
  ) or public.is_platform_admin();
$function$;
