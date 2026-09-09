-- P1-11 (docs/club-entitlement-gap-analysis.md): "IT admin cannot
-- deactivate/reactivate a user." Consumes club_staff.status (phase6z)
-- directly, per the recommended split: the Club Manager's "Remove" already
-- makes the permanent, business-owned departure call (active -> archived,
-- phase6z). This is the separate, IT-owned, reversible action: a security
-- lockout (active <-> suspended) that doesn't require deciding someone has
-- actually left. Both already collapse to the same "not active" outcome in
-- has_staff_permission and everywhere else that checks it (phase6z's
-- status='active' filters) -- suspended already behaves like archived for
-- authorization purposes, with no further changes needed there.
insert into public.permissions (key, category, scope, label, description)
values ('manage_account_status', 'staff', 'club', 'Suspend/reactivate account',
        'Temporarily suspend or reactivate a staff member''s access without removing them from the club')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key)
values ('club_it_admin', 'manage_account_status')
on conflict do nothing;

drop function if exists public.it_club_directory(uuid);

-- Widens to include suspended staff (not just active) -- otherwise there
-- would be no way to find someone to reactivate. Archived stays excluded:
-- that's the club_manager's terminal call, not IT's to reverse from here
-- (phase6z's own comment: "no reactivation flow yet").
create function public.it_club_directory(p_club_id uuid)
returns table (user_id uuid, name text, email text, role text, status text, is_platform_admin boolean)
language sql stable security definer set search_path = public as $$
  select
    cs.user_id,
    u.name,
    u.email,
    cs.role,
    cs.status,
    (exists (
       select 1 from public.role_assignments ra
       where ra.user_id = cs.user_id and ra.scope_type = 'platform' and ra.role = 'platform_admin')
     or exists (
       select 1 from public.platform_admins pa
       join auth.users au on lower(au.email) = lower(pa.email)
       where au.id = cs.user_id)) as is_platform_admin
  from public.club_staff cs
  join public.users u on u.id = cs.user_id
  where cs.club_id = p_club_id
    and cs.status in ('active', 'suspended')
    and (
      public.has_staff_permission('impersonate_user', p_club_id)
      or public.has_staff_permission('view_audit_log', p_club_id)
      or public.has_staff_permission('manage_account_status', p_club_id)
    )
  order by u.name;
$$;

revoke all on function public.it_club_directory(uuid) from public;
revoke all on function public.it_club_directory(uuid) from anon;
grant execute on function public.it_club_directory(uuid) to authenticated;
grant execute on function public.it_club_directory(uuid) to service_role;

create or replace function public.set_staff_account_status(p_club_id uuid, p_target_user_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_club public.clubs%rowtype;
  v_current text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'status must be active or suspended' using errcode = 'check_violation';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot change your own account status' using errcode = 'insufficient_privilege';
  end if;

  select * into v_club from public.clubs where id = p_club_id;
  if not found then
    raise exception 'club not found' using errcode = 'no_data_found';
  end if;

  if not public.has_staff_permission('manage_account_status', p_club_id) then
    raise exception 'not authorised to change account status at this club'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_current from public.club_staff
   where club_id = p_club_id and user_id = p_target_user_id;
  if v_current is null then
    raise exception 'that person is not staff at this club' using errcode = 'no_data_found';
  end if;
  -- archived is the club_manager's terminal call (phase6z) -- this action
  -- reverses only between active and suspended, never touches archived.
  if v_current = 'archived' then
    raise exception 'that person has been removed from the club -- re-add them to restore access'
      using errcode = 'check_violation';
  end if;
  if v_current = p_status then
    raise exception 'already %', p_status using errcode = 'check_violation';
  end if;

  update public.club_staff set status = p_status
   where club_id = p_club_id and user_id = p_target_user_id;

  perform public.write_audit(v_club.org_id,
    case when p_status = 'suspended' then 'staff.suspended' else 'staff.reactivated' end,
    'club', p_club_id, 'club_staff', p_target_user_id::text,
    jsonb_build_object('status', v_current), jsonb_build_object('status', p_status));
end $$;

revoke all on function public.set_staff_account_status(uuid, uuid, text) from public;
revoke all on function public.set_staff_account_status(uuid, uuid, text) from anon;
grant execute on function public.set_staff_account_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_staff_account_status(uuid, uuid, text) to service_role;
