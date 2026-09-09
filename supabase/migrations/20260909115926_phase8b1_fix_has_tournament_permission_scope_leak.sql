-- Found immediately after landing has_tournament_permission, by re-checking
-- its own logic rather than waiting for a live test to catch it: it had NO
-- scope gate at all, unlike has_staff_permission (which gates on
-- perm.scope='club' or role='club_manager' or team-assignment before ever
-- consulting role_permission_defaults). role_permission_defaults is one flat
-- (role, key) table with no table/scope awareness of its own -- and
-- 'treasurer'/'secretary' are deliberately shared role STRINGS between
-- club_staff and tournament_staff (same real-world role, different table,
-- confirmed no (role,key) pair actually collides). Without a scope gate,
-- has_tournament_permission('view_player', tournament_id) for a tournament
-- treasurer would have returned true -- true not because anything granted
-- it, but because 'treasurer' happens to hold that row for an entirely
-- different table's meaning. Confirmed live before fixing, not assumed:
-- select exists(select 1 from role_permission_defaults where role='treasurer'
-- and permission_key='view_player') -> true.
--
-- Fix: gate on perm.scope='tournament', with an explicit allow-list for the
-- three keys deliberately reused across club and tournament
-- (view_audit_log/manage_account_status/submit_support_request all still
-- carry scope='club' on their own catalog row, since they were never
-- duplicated under 'tournament' -- that's the whole point of reusing them).
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
