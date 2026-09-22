-- "Add staff" looked the person up with a plain select on public.users. That table
-- lets you read your own row, a platform admin sees all, and otherwise only rows
-- with a role_assignments entry in your org -- and role_assignments is empty. So
-- for everyone except a platform admin the lookup found nothing and reported "No
-- existing Dula HQ account" about people who had one (confirmed as the real club
-- manager). Same fix as add_tournament_staff: authorize FIRST, then look the email
-- up inside a definer function. Checking authority before the lookup is the point:
-- otherwise this would be a way to ask which emails have accounts.
--
-- Authority is can_admin_club (club manager OR org admin), exactly what
-- club_staff_write already requires, so this widens nobody. Re-adding someone who
-- was archived restores their row (the (club, user, role) unique constraint would
-- otherwise refuse it as "already has that role"), as the tournament side does.
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
