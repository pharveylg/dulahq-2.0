-- P1-8 (gap analysis §5): staff have no notification channel at all --
-- notifyAboutPlayer() only ever resolves a guardian or a player's own
-- account, never a staff recipient. This is the resolver that makes a
-- notifyStaff() possible: "who are all the active staff at this club who
-- currently hold permission X (optionally narrowed to team Y)".
--
-- Deliberately NOT has_staff_permission with a p_user_id parameter bolted
-- on -- that function is keyed to auth.uid() throughout (six call sites
-- across phase6z alone), and overloading it would risk one of those call
-- sites silently picking up the wrong branch. A parallel, narrower
-- function mirroring the same logic is safer than reshaping a function
-- this much RLS already depends on.
--
-- Callable by any authenticated user (no permission gate of its own): it
-- doesn't grant access to anything, only names recipients for a
-- notification that create_notification() independently gates per-row via
-- is_org_member. The result is never returned to a client -- notify.ts is
-- the only intended caller.
create or replace function public.staff_holding_permission(p_club_id uuid, p_permission_key text, p_team_id uuid default null)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select cs.user_id
  from public.club_staff cs
  join public.permissions perm on perm.key = p_permission_key
  where cs.club_id = p_club_id
    and cs.status = 'active'
    and (
      perm.scope = 'club'
      or cs.role = 'club_manager'
      or (p_team_id is not null and exists (
            select 1 from public.user_assigned_teams uat
            where uat.user_id = cs.user_id and uat.team_id = p_team_id))
    )
    and not exists (
      select 1 from public.staff_permission_grants g
      where g.club_id = p_club_id and g.user_id = cs.user_id and g.permission_key = p_permission_key
        and g.granted = false and (g.team_id is null or g.team_id = p_team_id)
    )
    and (
      exists (
        select 1 from public.staff_permission_grants g
        where g.club_id = p_club_id and g.user_id = cs.user_id and g.permission_key = p_permission_key
          and g.granted = true and (g.team_id is null or g.team_id = p_team_id)
      )
      or exists (
        select 1 from public.role_permission_defaults d
        where d.role = cs.role and d.permission_key = p_permission_key
      )
    );
$$;

revoke all on function public.staff_holding_permission(uuid, text, uuid) from public;
revoke all on function public.staff_holding_permission(uuid, text, uuid) from anon;
grant execute on function public.staff_holding_permission(uuid, text, uuid) to authenticated;
grant execute on function public.staff_holding_permission(uuid, text, uuid) to service_role;
