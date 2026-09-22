-- The club IT admin holds technical authority and no business authority (§0e), so the
-- club manager -- the business owner -- should not be the one who decides who gets
-- it. Product decision (2026-09-21): the organization's admin appoints it. Platform
-- admin passes too, because is_org_admin() includes them.
--
-- The check comes AFTER the general can_admin_club check and BEFORE the email lookup,
-- so a refused caller learns nothing about which emails have accounts. Only the
-- add path is restricted: a club manager can still remove one (club_staff_write is
-- can_admin_club), since taking access away is safe for the business owner to do.
create or replace function public.add_club_staff(p_club_id uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org  uuid;
  v_user public.users%rowtype;
  v_id   uuid;
begin
  select org_id into v_org from public.clubs where id = p_club_id;
  if v_org is null then raise exception 'club not found' using errcode = 'no_data_found'; end if;
  if not public.can_admin_club(v_org, p_club_id) then
    raise exception 'not authorized to manage staff for this club' using errcode = 'insufficient_privilege';
  end if;
  if p_role = 'club_it_admin' and not public.is_org_admin(v_org) then
    raise exception 'only an organization admin can appoint a club IT admin' using errcode = 'insufficient_privilege';
  end if;

  select * into v_user from public.users where lower(email) = lower(btrim(p_email));
  if not found then
    raise exception 'no Dula HQ account exists for that email' using errcode = 'no_data_found';
  end if;

  insert into public.club_staff (club_id, user_id, role, created_by)
  values (p_club_id, v_user.id, p_role, auth.uid())
  on conflict (club_id, user_id, role) do update set status = 'active'
    where public.club_staff.status = 'archived'
  returning id into v_id;
  if v_id is null then
    raise exception 'that person already has this role at this club' using errcode = 'unique_violation';
  end if;

  perform public.write_audit_system(
    v_org, 'staff.added', 'club', p_club_id, 'club_staff', v_id::text, null,
    jsonb_build_object('user_id', v_user.id, 'name', v_user.name, 'email', v_user.email, 'role', p_role));
  return v_id;
end $$;

revoke all on function public.add_club_staff(uuid, text, text) from public, anon;
grant execute on function public.add_club_staff(uuid, text, text) to authenticated, service_role;
