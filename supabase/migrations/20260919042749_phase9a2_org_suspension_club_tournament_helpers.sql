create or replace function public.is_club_staff(check_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid()
              and ra.scope_type = 'club' and ra.scope_id = check_club_id)
    or exists (select 1 from public.club_staff cs
               where cs.club_id = check_club_id and cs.user_id = auth.uid()
                 and cs.status = 'active')
  ) and public.club_org_is_active(check_club_id)
  or public.is_platform_admin();
$$;

create or replace function public.is_club_manager(check_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid()
              and ra.scope_type = 'club' and ra.scope_id = check_club_id
              and ra.role = 'club_manager')
    or exists (select 1 from public.club_staff cs
               where cs.club_id = check_club_id and cs.user_id = auth.uid()
                 and cs.role = 'club_manager' and cs.status = 'active')
  ) and public.club_org_is_active(check_club_id)
  or public.is_platform_admin();
$$;

create or replace function public.is_tournament_staff(check_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournament_staff ts
                 where ts.tournament_id = check_tournament_id and ts.user_id = auth.uid() and ts.status = 'active')
         and public.tournament_org_is_active(check_tournament_id)
      or public.is_platform_admin();
$$;

create or replace function public.is_tournament_organizer(check_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournament_staff ts
                 where ts.tournament_id = check_tournament_id and ts.user_id = auth.uid()
                   and ts.role = 'organizer' and ts.status = 'active')
         and public.tournament_org_is_active(check_tournament_id)
      or public.is_platform_admin();
$$;

create or replace function public.is_assigned_to_team(check_team_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (check_team_id in (select public.current_user_team_ids())
          and exists (select 1 from public.teams t where t.id = check_team_id and public.org_is_active(t.org_id)))
      or public.is_platform_admin();
$$;
