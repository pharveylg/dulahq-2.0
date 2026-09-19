-- The club side adds staff by looking the email up in public.users through
-- the caller's own RLS. An Organizer who isn't an org member can't read other
-- users at all, so the lookup has to happen inside a definer function that
-- authorizes first -- never a general "find user by email" surface.
create or replace function public.add_tournament_staff(p_tournament_id uuid, p_email text, p_role text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_user public.users%rowtype;
  v_id uuid;
begin
  select org_id into v_org from public.tournaments where id = p_tournament_id;
  if v_org is null then
    raise exception 'tournament not found' using errcode = 'no_data_found';
  end if;
  if not (public.has_tournament_permission('manage_tournament_staff', p_tournament_id)
          or public.is_org_admin(v_org)) then
    raise exception 'not authorized to manage staff for this tournament' using errcode = 'insufficient_privilege';
  end if;

  select * into v_user from public.users where lower(email) = lower(btrim(p_email));
  if not found then
    raise exception 'no Dula HQ account exists for that email' using errcode = 'no_data_found';
  end if;

  -- Re-adding someone previously archived brings the same row back rather
  -- than tripping the (tournament, user, role) unique constraint.
  insert into public.tournament_staff (tournament_id, user_id, role, org_id, created_by)
  values (p_tournament_id, v_user.id, p_role, v_org, auth.uid())
  on conflict (tournament_id, user_id, role)
  do update set status = 'active' where public.tournament_staff.status = 'archived'
  returning id into v_id;

  if v_id is null then
    raise exception 'that person already has this role on the tournament' using errcode = 'unique_violation';
  end if;

  perform public.write_audit(v_org, 'tournament_staff.added', 'tournament', p_tournament_id,
    'tournament_staff', v_id::text, null,
    jsonb_build_object('user_id', v_user.id, 'email', v_user.email, 'role', p_role));
  return v_id;
end $$;

-- What the landing page needs to link someone to their console(s).
create or replace function public.my_manageable_tournaments()
returns table (tournament_id uuid, tournament_name text, tournament_slug text, org_slug text, org_name text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.slug, o.slug, o.name
  from public.tournaments t
  join public.organizations o on o.id = t.org_id
  where t.slug is not null
    and (public.is_tournament_staff(t.id) or public.is_org_admin(t.org_id))
  order by o.name, t.name;
$$;

revoke all on function public.add_tournament_staff(uuid, text, text) from public, anon;
revoke all on function public.my_manageable_tournaments() from public, anon;
grant execute on function public.add_tournament_staff(uuid, text, text) to authenticated;
grant execute on function public.my_manageable_tournaments() to authenticated;
