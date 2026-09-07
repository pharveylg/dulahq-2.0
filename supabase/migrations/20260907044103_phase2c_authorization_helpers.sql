-- Phase 2c: authorization helpers, tenant-first and uid-based.
-- Each one also honours the legacy table it replaces, so nothing breaks mid-transition.
-- Every function pins search_path (clears the mutable-search_path advisories).

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = auth.uid()
      and ra.scope_type = 'platform'
      and ra.role = 'platform_admin'
  )
  or exists (
    select 1 from public.platform_admins pa
    where lower(pa.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.has_role(
  p_scope_type text, p_scope_id uuid, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = auth.uid()
      and ra.scope_type = p_scope_type
      and ra.scope_id is not distinct from p_scope_id
      and (p_roles is null or ra.role = any(p_roles))
  ) or public.is_platform_admin();
$$;

create or replace function public.current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select distinct ra.org_id from public.role_assignments ra
  where ra.user_id = auth.uid() and ra.org_id is not null
  union
  select distinct om.org_id from public.org_members om
  where om.user_id = auth.uid()
     or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select org is not null and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.org_id = org)
    or exists (select 1 from public.org_members om
               where om.org_id = org
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  ) or public.is_platform_admin();
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select org is not null and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.scope_type = 'org'
              and ra.scope_id = org and ra.role in ('org_admin','admin'))
    or exists (select 1 from public.org_members om
               where om.org_id = org and om.role = 'admin'
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
  ) or public.is_platform_admin();
$$;

-- Entitlement: what the resource's org is allowed to run. Separate from permission.
create or replace function public.org_has_product(org uuid, p_product text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_entitlements e
    where e.org_id = org
      and e.product = p_product
      and e.status in ('active','trial')
      and (e.valid_until is null or e.valid_until >= current_date)
  );
$$;

create or replace function public.is_club_staff(check_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_assignments ra
                 where ra.user_id = auth.uid()
                   and ra.scope_type = 'club' and ra.scope_id = check_club_id)
      or exists (select 1 from public.club_staff cs
                 where cs.club_id = check_club_id and cs.user_id = auth.uid())
      or public.is_platform_admin();
$$;

create or replace function public.is_club_admin(check_club_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_assignments ra
                 where ra.user_id = auth.uid()
                   and ra.scope_type = 'club' and ra.scope_id = check_club_id
                   and ra.role = 'club_admin')
      or exists (select 1 from public.club_staff cs
                 where cs.club_id = check_club_id and cs.user_id = auth.uid()
                   and cs.role = 'club_admin')
      or public.is_platform_admin();
$$;

create or replace function public.current_user_team_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select ra.scope_id from public.role_assignments ra
  where ra.user_id = auth.uid() and ra.scope_type = 'team' and ra.scope_id is not null
  union
  select uat.team_id from public.user_assigned_teams uat where uat.user_id = auth.uid();
$$;

create or replace function public.is_assigned_to_team(check_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select check_team_id in (select public.current_user_team_ids())
      or public.is_platform_admin();
$$;

create or replace function public.is_guardian_of(check_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.player_guardians pg
    join public.guardians g on g.id = pg.guardian_id
    where pg.player_id = check_player_id and g.user_id = auth.uid()
  );
$$;

create or replace function public.is_player_self(check_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.players p
    where p.id = check_player_id and p.user_id = auth.uid()
  );
$$;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.users where id = auth.uid() limit 1;
$$;

create or replace function public.backfill_member_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.org_members
  set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

-- These are called from policies, never directly by a browser.
revoke execute on function public.has_role(text,uuid,text[]) from anon;
revoke execute on function public.current_user_org_ids() from anon;
revoke execute on function public.org_has_product(uuid,text) from anon;
revoke execute on function public.backfill_member_user() from public, anon, authenticated;;