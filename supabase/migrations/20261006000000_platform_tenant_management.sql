-- Platform console tenant management: grant or revoke an organization's admin, and
-- permanently delete an organization. Both are platform-admin only, authorize first,
-- and are the only write path for these actions (no direct table policy exists).

create or replace function public.platform_set_org_admin(p_org uuid, p_email text, p_grant boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(btrim(p_email));
  v_user uuid;
  v_others int;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admins only' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.organizations where id = p_org) then
    raise exception 'organization not found' using errcode = 'no_data_found';
  end if;
  if v_email = '' then
    raise exception 'enter an email address' using errcode = 'check_violation';
  end if;

  select id into v_user from public.users where lower(email) = v_email;

  if p_grant then
    insert into public.org_members (org_id, email, user_id, role)
    values (p_org, v_email, v_user, 'admin')
    on conflict (org_id, email) do update
      set role = 'admin', user_id = coalesce(excluded.user_id, public.org_members.user_id);

    perform public.write_audit_system(p_org, 'org.admin.granted', 'org', p_org,
      'org_member', v_email, null, jsonb_build_object('email', v_email));
  else
    select count(*) into v_others from public.org_members
     where org_id = p_org and role = 'admin' and email <> v_email;
    if v_others = 0 then
      raise exception 'an organization needs at least one admin -- add another before removing this one'
        using errcode = 'check_violation';
    end if;

    delete from public.org_members where org_id = p_org and email = v_email and role = 'admin';

    perform public.write_audit_system(p_org, 'org.admin.revoked', 'org', p_org,
      'org_member', v_email, null, jsonb_build_object('email', v_email));
  end if;
end
$$;
revoke all on function public.platform_set_org_admin(uuid, text, boolean) from public, anon;
grant execute on function public.platform_set_org_admin(uuid, text, boolean) to authenticated, service_role;

-- Tournaments are removed explicitly because tournaments.org_id is ON DELETE SET NULL
-- (they would survive as orphans), and several tournament children reference them
-- with NO ACTION, so they are cleared in dependency order first. Every other org-owned
-- row cascades from organizations itself.
create or replace function public.platform_delete_organization(p_org uuid, p_confirm_slug text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
begin
  if not public.is_platform_admin() then
    raise exception 'platform admins only' using errcode = 'insufficient_privilege';
  end if;

  select slug into v_slug from public.organizations where id = p_org;
  if v_slug is null then
    raise exception 'organization not found' using errcode = 'no_data_found';
  end if;
  if lower(btrim(p_confirm_slug)) <> v_slug then
    raise exception 'type the organization''s slug exactly to confirm deletion' using errcode = 'check_violation';
  end if;

  delete from public.tournament_roster where org_id = p_org or tournament_id in (select id from public.tournaments where org_id = p_org);
  delete from public.tournament_officials where tournament_id in (select id from public.tournaments where org_id = p_org);
  delete from public.matches where tournament_id in (select id from public.tournaments where org_id = p_org);
  delete from public.tournament_entries where tournament_id in (select id from public.tournaments where org_id = p_org);
  delete from public.tournament_categories where tournament_id in (select id from public.tournaments where org_id = p_org);
  delete from public.tournaments where org_id = p_org;

  delete from public.organizations where id = p_org;
end
$$;
revoke all on function public.platform_delete_organization(uuid, text) from public, anon;
grant execute on function public.platform_delete_organization(uuid, text) to authenticated, service_role;
