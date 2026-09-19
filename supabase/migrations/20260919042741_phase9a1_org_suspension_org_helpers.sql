create or replace function public.is_org_admin(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select org is not null and public.org_is_active(org) and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.scope_type = 'org'
              and ra.scope_id = org and ra.role in ('org_admin','admin'))
    or exists (select 1 from public.org_members om
               where om.org_id = org and om.role = 'admin'
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  ) or public.is_platform_admin();
$$;

create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select org is not null and public.org_is_active(org) and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.org_id = org)
    or exists (select 1 from public.org_members om
               where om.org_id = org
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
    -- staff of any club in this org are members of this org -- but an
    -- archived row no longer counts; they left.
    or exists (select 1 from public.club_staff cs
               join public.clubs c on c.id = cs.club_id
               where c.org_id = org and cs.user_id = auth.uid() and cs.status = 'active')
    or exists (select 1 from public.user_assigned_teams uat
               join public.teams t on t.id = uat.team_id
               where t.org_id = org and uat.user_id = auth.uid())
    or exists (select 1 from public.guardians g
               join public.player_guardians pg on pg.guardian_id = g.id
               join public.players p on p.id = pg.player_id
               where p.org_id = org and g.user_id = auth.uid())
    or exists (select 1 from public.players p
               where p.org_id = org and p.user_id = auth.uid())
  ) or public.is_platform_admin();
$$;
