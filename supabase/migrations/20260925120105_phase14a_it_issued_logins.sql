-- Logins an IT admin creates, with a random temporary password. Email is parked, so this
-- replaces "invite by email" for setup: the club IT admin, tournament IT admin or a
-- platform admin creates the login; the person must change the password on first sign-in;
-- it stops working after 72 hours if they never do.
--
-- The app creates the auth user with the service role (one small server-only module).
-- These functions decide WHO may, and keep the record that lets an admin reissue a login
-- they issued -- and only those. Reissuing an account someone else owns would be an
-- account takeover across tenants (a person can be a guardian at one club and staff at
-- another), so reissue is limited to logins this same scope issued; only a platform admin
-- can reissue any ordinary account, and never another platform admin's.

insert into public.permissions (key, category, scope, label, description) values
  ('manage_club_logins', 'staff', 'club', 'Create logins',
   'Create a login for a person and issue a temporary password'),
  ('manage_tournament_logins', 'staff', 'tournament', 'Create logins',
   'Create a login for a person and issue a temporary password')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key) values
  ('club_it_admin', 'manage_club_logins'),
  ('tournament_it_admin', 'manage_tournament_logins')
on conflict do nothing;

-- owner_org_id, not org_id: this is a record about accounts, and an org_id column would
-- pull the table into the org-suspension fence (a suspended org's IT admin is already
-- refused by the helpers below).
create table if not exists public.provisioned_logins (
  user_id        uuid primary key references public.users(id) on delete cascade,
  scope_type     text not null check (scope_type in ('club', 'tournament', 'platform')),
  scope_id       uuid,
  owner_org_id   uuid references public.organizations(id) on delete set null,
  email          text not null,
  name           text,
  created_by     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  last_issued_at timestamptz not null default now(),
  temp_expires_at timestamptz not null,
  activated_at   timestamptz,
  expired_at     timestamptz,
  check ((scope_type = 'platform') = (scope_id is null))
);
alter table public.provisioned_logins enable row level security;
revoke insert, update, delete, truncate on public.provisioned_logins from anon, authenticated;
revoke all on public.provisioned_logins from anon;

-- Only the people who issue logins see them; every write goes through the functions below.
create policy provisioned_logins_read on public.provisioned_logins for select to authenticated
using (
  public.is_platform_admin()
  or (scope_type = 'club' and public.has_staff_permission('manage_club_logins', scope_id))
  or (scope_type = 'tournament' and public.has_tournament_permission('manage_tournament_logins', scope_id))
);

create or replace function public.can_provision_login(p_scope_type text, p_scope_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_scope_type = 'platform' then public.is_platform_admin() and p_scope_id is null
    when p_scope_type = 'club' then p_scope_id is not null and public.has_staff_permission('manage_club_logins', p_scope_id)
    when p_scope_type = 'tournament' then p_scope_id is not null and public.has_tournament_permission('manage_tournament_logins', p_scope_id)
    else false
  end;
$$;

create or replace function public.login_scope_org(p_scope_type text, p_scope_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select case p_scope_type
    when 'club' then (select org_id from public.clubs where id = p_scope_id)
    when 'tournament' then (select org_id from public.tournaments where id = p_scope_id)
    else null
  end;
$$;

create or replace function public.is_platform_admin_user(p_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins pa
    join auth.users u on lower(u.email) = lower(pa.email)
    where u.id = p_user
  );
$$;

create or replace function public.can_reissue_login(p_target uuid, p_scope_type text, p_scope_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_provision_login(p_scope_type, p_scope_id)
     and not public.is_platform_admin_user(p_target)
     and (
       exists (select 1 from public.provisioned_logins pl
               where pl.user_id = p_target and pl.scope_type = p_scope_type and pl.scope_id is not distinct from p_scope_id)
       or (p_scope_type = 'platform' and public.is_platform_admin())
     );
$$;

create or replace function public.record_provisioned_login(
  p_user_id uuid, p_email text, p_name text, p_scope_type text, p_scope_id uuid, p_hours int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if p_hours < 1 or p_hours > 168 then
    raise exception 'a temporary password must last between 1 hour and 7 days' using errcode = 'invalid_parameter_value';
  end if;
  if not public.can_provision_login(p_scope_type, p_scope_id) then
    raise exception 'you do not have permission to create logins here' using errcode = 'insufficient_privilege';
  end if;
  v_org := public.login_scope_org(p_scope_type, p_scope_id);
  if p_scope_type <> 'platform' and v_org is null then
    raise exception '% not found', p_scope_type using errcode = 'no_data_found';
  end if;
  begin
    insert into public.provisioned_logins (user_id, scope_type, scope_id, owner_org_id, email, name, created_by, temp_expires_at)
    values (p_user_id, p_scope_type, p_scope_id, v_org, p_email, p_name, auth.uid(), now() + make_interval(hours => p_hours));
  exception when unique_violation then
    raise exception 'a login was already issued for that account' using errcode = 'unique_violation';
  end;
  perform public.write_audit_system(v_org, 'login.provisioned', p_scope_type, p_scope_id, 'user', p_user_id::text,
    null, jsonb_build_object('email', p_email, 'name', p_name, 'valid_hours', p_hours));
end $$;

create or replace function public.mark_login_reissued(p_target uuid, p_scope_type text, p_scope_id uuid, p_hours int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text; v_name text;
begin
  if p_hours < 1 or p_hours > 168 then
    raise exception 'a temporary password must last between 1 hour and 7 days' using errcode = 'invalid_parameter_value';
  end if;
  if not public.can_reissue_login(p_target, p_scope_type, p_scope_id) then
    raise exception 'you cannot reissue this login' using errcode = 'insufficient_privilege';
  end if;
  v_org := public.login_scope_org(p_scope_type, p_scope_id);
  select u.email, pu.name into v_email, v_name from auth.users u left join public.users pu on pu.id = u.id where u.id = p_target;
  insert into public.provisioned_logins (user_id, scope_type, scope_id, owner_org_id, email, name, created_by, temp_expires_at)
  values (p_target, p_scope_type, p_scope_id, v_org, v_email, v_name, auth.uid(), now() + make_interval(hours => p_hours))
  on conflict (user_id) do update
    set last_issued_at = now(), temp_expires_at = now() + make_interval(hours => p_hours),
        activated_at = null, expired_at = null;
  perform public.write_audit_system(v_org, 'login.reissued', p_scope_type, p_scope_id, 'user', p_target::text,
    null, jsonb_build_object('email', v_email, 'valid_hours', p_hours));
end $$;

-- Called by the app with the service role after the person has chosen their own password.
create or replace function public.mark_login_activated(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.provisioned_logins;
begin
  update public.provisioned_logins set activated_at = now()
   where user_id = p_user_id and activated_at is null returning * into r;
  if found then
    perform public.write_audit_system(r.owner_org_id, 'login.activated', r.scope_type, r.scope_id, 'user', p_user_id::text,
      null, jsonb_build_object('email', r.email));
  end if;
end $$;

-- Hourly sweep. A temporary password nobody used within its window is disabled at the
-- AUTH layer (banned_until), not just in our UI: someone holding it could call the auth
-- API directly, and none of our data checks would notice. Reissue lifts the ban.
create or replace function public.expire_temp_logins()
returns integer
language plpgsql security definer set search_path = public as $$
declare r public.provisioned_logins; n integer := 0;
begin
  for r in select * from public.provisioned_logins
            where activated_at is null and expired_at is null and temp_expires_at < now()
              for update loop
    update auth.users set banned_until = now() + interval '100 years' where id = r.user_id;
    update public.provisioned_logins set expired_at = now() where user_id = r.user_id;
    perform public.write_audit_system(r.owner_org_id, 'login.expired', r.scope_type, r.scope_id, 'user', r.user_id::text,
      null, jsonb_build_object('email', r.email));
    n := n + 1;
  end loop;
  return n;
end $$;

-- EXECUTE defaults to PUBLIC (§0g). The client-callable ones re-check authority inside;
-- the two service-role-only ones must not be callable by a signed-in user at all.
revoke all on function public.can_provision_login(text, uuid) from public, anon;
revoke all on function public.login_scope_org(text, uuid) from public, anon;
revoke all on function public.is_platform_admin_user(uuid) from public, anon;
revoke all on function public.can_reissue_login(uuid, text, uuid) from public, anon;
revoke all on function public.record_provisioned_login(uuid, text, text, text, uuid, int) from public, anon;
revoke all on function public.mark_login_reissued(uuid, text, uuid, int) from public, anon;
revoke all on function public.mark_login_activated(uuid) from public, anon, authenticated;
revoke all on function public.expire_temp_logins() from public, anon, authenticated;
grant execute on function public.can_provision_login(text, uuid) to authenticated, service_role;
grant execute on function public.login_scope_org(text, uuid) to authenticated, service_role;
grant execute on function public.is_platform_admin_user(uuid) to authenticated, service_role;
grant execute on function public.can_reissue_login(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.record_provisioned_login(uuid, text, text, text, uuid, int) to authenticated, service_role;
grant execute on function public.mark_login_reissued(uuid, text, uuid, int) to authenticated, service_role;
grant execute on function public.mark_login_activated(uuid) to service_role;
grant execute on function public.expire_temp_logins() to service_role;

select cron.schedule('expire-temp-logins', '17 * * * *', $$select public.expire_temp_logins();$$);
