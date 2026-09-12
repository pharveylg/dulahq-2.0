-- The platform-tier readout, mirroring effective_access_for() but spanning
-- every club AND every tournament the target touches within this one org --
-- because a Combined-entitlement org's user could hold either bundle (or
-- both), and Platform Admin's job here is "what can this person do in this
-- org", not "what can they do at one specific club".
--
-- DIAGNOSTIC ONLY, same discipline as effective_access_for(): never call
-- this from a policy. It mirrors has_staff_permission's and
-- has_tournament_permission's own default-bundle-plus-grants-minus-revokes
-- logic inline (both are keyed to auth.uid(), not a target parameter, so
-- cannot be called directly for an arbitrary user).
create or replace function public.effective_access_for_platform(p_target_user_id uuid, p_org_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.platform_impersonation_sessions s
    where s.actor_user_id = auth.uid()
      and s.target_user_id = p_target_user_id
      and s.org_id = p_org_id
      and s.ended_at is null
      and s.expires_at > now()
  ) then
    raise exception 'no active platform view-as session for this user in this org';
  end if;

  with club_roles as (
    select cs.club_id, c.name as club_name, cs.role
    from public.club_staff cs
    join public.clubs c on c.id = cs.club_id
    where c.org_id = p_org_id and cs.user_id = p_target_user_id and cs.status = 'active'
  ),
  club_granted as (
    select g.club_id, g.permission_key, g.granted
    from public.staff_permission_grants g
    where g.user_id = p_target_user_id and g.club_id in (select club_id from club_roles)
  ),
  club_effective as (
    select cr.club_id, cr.club_name, cr.role, perm.key, perm.label
    from club_roles cr
    join public.permissions perm on perm.category = 'staff'
    where not exists (select 1 from club_granted cg where cg.club_id = cr.club_id and cg.permission_key = perm.key and cg.granted = false)
      and (
        exists (select 1 from club_granted cg where cg.club_id = cr.club_id and cg.permission_key = perm.key and cg.granted = true)
        or exists (select 1 from public.role_permission_defaults d where d.role = cr.role and d.permission_key = perm.key)
      )
  ),
  club_memberships as (
    select jsonb_agg(jsonb_build_object(
      'club_id', cr.club_id,
      'club_name', cr.club_name,
      'role', cr.role,
      'is_player', exists (select 1 from public.players p where p.user_id = p_target_user_id and p.club_id = cr.club_id),
      'is_guardian', exists (
        select 1 from public.guardians g
        join public.player_guardians pg on pg.guardian_id = g.id
        join public.players p on p.id = pg.player_id
        where g.user_id = p_target_user_id and p.club_id = cr.club_id
      ),
      'permissions', coalesce((select jsonb_agg(jsonb_build_object('key', ce.key, 'label', ce.label) order by ce.key)
                                from club_effective ce where ce.club_id = cr.club_id), '[]'::jsonb)
    ) order by cr.club_name) as v
    from club_roles cr
  ),
  tournament_roles as (
    select ts.tournament_id, t.name as tournament_name, ts.role
    from public.tournament_staff ts
    join public.tournaments t on t.id = ts.tournament_id
    where ts.org_id = p_org_id and ts.user_id = p_target_user_id and ts.status = 'active'
  ),
  tournament_granted as (
    select g.tournament_id, g.permission_key, g.granted
    from public.tournament_staff_permission_grants g
    where g.user_id = p_target_user_id and g.tournament_id in (select tournament_id from tournament_roles)
  ),
  tournament_effective as (
    select tr.tournament_id, tr.tournament_name, tr.role, perm.key, perm.label
    from tournament_roles tr
    join public.permissions perm
      on perm.scope = 'tournament' or perm.key in ('view_audit_log', 'manage_account_status', 'submit_support_request')
    where not exists (select 1 from tournament_granted tg where tg.tournament_id = tr.tournament_id and tg.permission_key = perm.key and tg.granted = false)
      and (
        exists (select 1 from tournament_granted tg where tg.tournament_id = tr.tournament_id and tg.permission_key = perm.key and tg.granted = true)
        or exists (select 1 from public.role_permission_defaults d where d.role = tr.role and d.permission_key = perm.key)
      )
  ),
  tournament_memberships as (
    select jsonb_agg(jsonb_build_object(
      'tournament_id', tr.tournament_id,
      'tournament_name', tr.tournament_name,
      'role', tr.role,
      'permissions', coalesce((select jsonb_agg(jsonb_build_object('key', te.key, 'label', te.label) order by te.key)
                                from tournament_effective te where te.tournament_id = tr.tournament_id), '[]'::jsonb)
    ) order by tr.tournament_name) as v
    from tournament_roles tr
  ),
  entry_contacts as (
    select jsonb_agg(jsonb_build_object(
      'entry_id', tec.entry_id,
      'role', tec.role,
      'account_status', tec.account_status
    )) as v
    from public.tournament_entry_contacts tec
    where tec.org_id = p_org_id and tec.user_id = p_target_user_id
  )
  select jsonb_build_object(
    'entitlements', coalesce((select jsonb_agg(oe.product order by oe.product) from public.org_entitlements oe
                               where oe.org_id = p_org_id and oe.status in ('active', 'trial')), '[]'::jsonb),
    'club_memberships', coalesce((select v from club_memberships), '[]'::jsonb),
    'tournament_memberships', coalesce((select v from tournament_memberships), '[]'::jsonb),
    'tournament_entry_contacts', coalesce((select v from entry_contacts), '[]'::jsonb),
    'has_no_known_relationship', not exists (select 1 from club_roles) and not exists (select 1 from tournament_roles)
                                 and not exists (select 1 from public.tournament_entry_contacts tec where tec.org_id = p_org_id and tec.user_id = p_target_user_id)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.effective_access_for_platform(uuid, uuid) from public, anon;
grant execute on function public.effective_access_for_platform(uuid, uuid) to authenticated;
