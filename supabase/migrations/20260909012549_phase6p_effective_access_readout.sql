-- The actual "view as" payload: what can this user do here, and why.
--
-- DIAGNOSTIC ONLY. This function never gates access -- it renders a readout
-- for a human troubleshooting "why can't X see Y". It mirrors
-- has_staff_permission()'s club_staff branch (defaults for the role, plus
-- explicit grants, minus explicit revokes) but deliberately does NOT
-- reimplement the platform-admin bypass, because platform admins cannot be
-- viewed as at all (start_impersonation refuses them). If this ever drifts
-- from has_staff_permission the consequence is a wrong readout, not a
-- security hole -- keep it that way: never call this from a policy.
create or replace function public.effective_access_for(p_target_user_id uuid, p_club_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_result jsonb;
begin
  -- Only readable inside a live, logged session for exactly this pair.
  if not exists (
    select 1 from public.impersonation_sessions s
    where s.actor_user_id = auth.uid()
      and s.target_user_id = p_target_user_id
      and s.club_id = p_club_id
      and s.ended_at is null
      and s.expires_at > now()
  ) then
    raise exception 'no active view-as session for this user';
  end if;

  select cs.role into v_role
  from public.club_staff cs
  where cs.club_id = p_club_id and cs.user_id = p_target_user_id;

  with assigned as (
    select t.id, t.name
    from public.user_assigned_teams uat
    join public.teams t on t.id = uat.team_id
    where uat.user_id = p_target_user_id and t.club_id = p_club_id
  ),
  granted as (
    select g.permission_key, g.granted
    from public.staff_permission_grants g
    where g.club_id = p_club_id and g.user_id = p_target_user_id
  ),
  effective as (
    select perm.key, perm.scope, perm.label
    from public.permissions perm
    where perm.category = 'staff'
      and v_role is not null
      -- an explicit revoke always wins
      and not exists (select 1 from granted gr where gr.permission_key = perm.key and gr.granted = false)
      and (
        exists (select 1 from granted gr where gr.permission_key = perm.key and gr.granted = true)
        or exists (
          select 1 from public.role_permission_defaults d
          where d.role = v_role and d.permission_key = perm.key
        )
      )
  )
  select jsonb_build_object(
    'role', v_role,
    'is_player', exists (select 1 from public.players p where p.user_id = p_target_user_id and p.club_id = p_club_id),
    'is_guardian', exists (
      select 1 from public.guardians g
      join public.player_guardians pg on pg.guardian_id = g.id
      join public.players p on p.id = pg.player_id
      where g.user_id = p_target_user_id and p.club_id = p_club_id
    ),
    'club_wide', v_role = 'club_manager',
    'teams', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by name) from assigned), '[]'::jsonb),
    'club_permissions', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label) order by key)
                                  from effective where scope = 'club'), '[]'::jsonb),
    'team_permissions', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'label', label) order by key)
                                  from effective where scope = 'team'), '[]'::jsonb),
    'missing_permissions', coalesce((select jsonb_agg(jsonb_build_object('key', perm.key, 'label', perm.label) order by perm.key)
                                     from public.permissions perm
                                     where perm.category = 'staff'
                                       and not exists (select 1 from effective e where e.key = perm.key)), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.effective_access_for(uuid, uuid) from public, anon;
grant execute on function public.effective_access_for(uuid, uuid) to authenticated;
