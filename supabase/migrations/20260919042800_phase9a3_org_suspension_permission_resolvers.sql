create or replace function public.has_staff_permission(p_permission_key text, p_club_id uuid, p_team_id uuid default null::uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.club_staff cs
      join public.permissions perm on perm.key = p_permission_key
      where cs.club_id = p_club_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
        and public.club_org_is_active(p_club_id)
        and (
          perm.scope = 'club'
          or cs.role = 'club_manager'
          or (p_team_id is not null and p_team_id in (select public.current_user_team_ids()))
        )
        and (
          not exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = false and (g.team_id is null or g.team_id = p_team_id)
          )
        )
        and (
          exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = true and (g.team_id is null or g.team_id = p_team_id)
          )
          or exists (
            select 1 from public.role_permission_defaults d
            where d.role = cs.role and d.permission_key = p_permission_key
          )
        )
    );
$$;

create or replace function public.has_tournament_permission(p_permission_key text, p_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1 from public.tournament_staff ts
      join public.permissions perm on perm.key = p_permission_key
      where ts.tournament_id = p_tournament_id
        and ts.user_id = auth.uid()
        and ts.status = 'active'
        and public.tournament_org_is_active(p_tournament_id)
        and (
          perm.scope = 'tournament'
          or perm.key in ('view_audit_log', 'manage_account_status', 'submit_support_request')
        )
        and not exists (
          select 1 from public.tournament_staff_permission_grants g
          where g.tournament_id = p_tournament_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
            and g.granted = false
        )
        and (
          exists (
            select 1 from public.tournament_staff_permission_grants g
            where g.tournament_id = p_tournament_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = true
          )
          or exists (
            select 1 from public.role_permission_defaults d
            where d.role = ts.role and d.permission_key = p_permission_key
          )
        )
    );
$$;
