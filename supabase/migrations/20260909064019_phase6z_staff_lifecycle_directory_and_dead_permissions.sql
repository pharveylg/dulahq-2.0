-- Club entitlement P0 batch (docs/club-entitlement-gap-analysis.md).
-- Three of the six P0 items land here; the other three (audit call sites,
-- the audit view, club settings/branding) are app-side or additive-only and
-- don't need a migration of their own.

-- ============================================================================
-- P0-5: club_staff gets a real lifecycle. Removing someone was a hard DELETE
-- with no history and no way to distinguish "never worked here" from "worked
-- here until last month" -- exactly the gap the analysis flagged against
-- guardians' own account_status, which already has this.
-- ============================================================================
alter table public.club_staff
  add column if not exists status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'archived'));

comment on column public.club_staff.status is
  'active/archived are live today (add = active, remove = archived, never deleted). invited/suspended are reserved for the staff-invitation and deactivation work the gap analysis scoped as P1/P2 -- the column exists now so that work is additive, not another migration.';

-- Every authorization path that reads club_staff.role has to also honour
-- status, or archiving someone is cosmetic: they'd keep every permission
-- their role bundle grants. Six functions actually gate on club_staff; all
-- six are touched below, nothing else does (checked via pg_proc.prosrc).

create or replace function public.is_org_member(org uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select org is not null and (
    exists (select 1 from public.role_assignments ra
            where ra.user_id = auth.uid() and ra.org_id = org)
    or exists (select 1 from public.org_members om
               where om.org_id = org
                 and (om.user_id = auth.uid()
                      or lower(om.email) = lower(coalesce(auth.jwt() ->> 'email', ''))))
    -- staff of any club in this org are members of this org -- but an
    -- archived row no longer counts; they left.
    or exists (select 1 from public.club_staff cs
               join public.clubs c on c.id = cs.club_id
               where c.org_id = org and cs.user_id = auth.uid() and cs.status = 'active')
    or exists (select 1 from public.user_assigned_teams uat
               join public.teams t on t.id = uat.team_id
               where t.org_id = org and uat.user_id = auth.uid())
    or exists (select 1 from public.guardians g
               join public.player_guardians pg on pg.guardian_id = g.id
               join public.players p on p.id = pg.player_id
               where p.org_id = org and g.user_id = auth.uid())
    or exists (select 1 from public.players p
               where p.org_id = org and p.user_id = auth.uid())
  ) or public.is_platform_admin();
$$;

create or replace function public.is_club_staff(check_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_assignments ra
                 where ra.user_id = auth.uid()
                   and ra.scope_type = 'club' and ra.scope_id = check_club_id)
      or exists (select 1 from public.club_staff cs
                 where cs.club_id = check_club_id and cs.user_id = auth.uid()
                   and cs.status = 'active')
      or public.is_platform_admin();
$$;

create or replace function public.is_club_manager(check_club_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.role_assignments ra
                 where ra.user_id = auth.uid()
                   and ra.scope_type = 'club' and ra.scope_id = check_club_id
                   and ra.role = 'club_manager')
      or exists (select 1 from public.club_staff cs
                 where cs.club_id = check_club_id and cs.user_id = auth.uid()
                   and cs.role = 'club_manager' and cs.status = 'active')
      or public.is_platform_admin();
$$;

create or replace function public.has_staff_permission(p_permission_key text, p_club_id uuid, p_team_id uuid default null::uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.club_staff cs
      join public.permissions perm on perm.key = p_permission_key
      where cs.club_id = p_club_id
        and cs.user_id = auth.uid()
        and cs.status = 'active'
        and (
          perm.scope = 'club'
          or cs.role = 'club_manager'
          or (p_team_id is not null and p_team_id in (select public.current_user_team_ids()))
        )
        and (
          not exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = false and (g.team_id is null or g.team_id = p_team_id)
          )
        )
        and (
          exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = true and (g.team_id is null or g.team_id = p_team_id)
          )
          or exists (
            select 1 from public.role_permission_defaults d
            where d.role = cs.role and d.permission_key = p_permission_key
          )
        )
    );
$$;

-- it_club_directory: an archived person has nothing left to troubleshoot --
-- excluded rather than shown, matching start_impersonation below.
create or replace function public.it_club_directory(p_club_id uuid)
returns table (user_id uuid, name text, email text, role text, is_platform_admin boolean)
language sql stable security definer set search_path = public as $$
  select
    cs.user_id,
    u.name,
    u.email,
    cs.role,
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
    and cs.status = 'active'
    and (
      public.has_staff_permission('impersonate_user', p_club_id)
      or public.has_staff_permission('view_audit_log', p_club_id)
    )
  order by u.name;
$$;

-- effective_access_for: an archived target should read out as holding
-- nothing, not their old bundle -- v_role stays null, which the existing
-- `v_role is not null` guard in the `effective` CTE already turns into an
-- empty permission set.
create or replace function public.effective_access_for(p_target_user_id uuid, p_club_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_role text;
  v_result jsonb;
begin
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
  where cs.club_id = p_club_id and cs.user_id = p_target_user_id and cs.status = 'active';

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

-- start_impersonation: an archived person is nobody's business to view as --
-- excluded from the "is this person a club member" check, same reasoning as
-- it_club_directory.
create or replace function public.start_impersonation(p_target_user_id uuid, p_club_id uuid, p_reason text, p_minutes integer default 30)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_id uuid;
  v_minutes int := least(greatest(coalesce(p_minutes, 30), 1), 120);
begin
  if not public.has_staff_permission('impersonate_user', p_club_id) then
    raise exception 'not authorized to view as another user in this club';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'a reason is required';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot view as yourself';
  end if;

  select org_id into v_org_id from public.clubs where id = p_club_id;
  if v_org_id is null then
    raise exception 'club not found';
  end if;

  if exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_target_user_id
      and ra.scope_type = 'platform' and ra.role = 'platform_admin'
  ) or exists (
    select 1 from public.platform_admins pa
    join auth.users u on lower(u.email) = lower(pa.email)
    where u.id = p_target_user_id
  ) then
    raise exception 'platform admins cannot be viewed as';
  end if;

  if not exists (
    select 1 from public.club_staff cs where cs.club_id = p_club_id and cs.user_id = p_target_user_id and cs.status = 'active'
  ) and not exists (
    select 1 from public.players p where p.club_id = p_club_id and p.user_id = p_target_user_id
  ) and not exists (
    select 1 from public.guardians g
    join public.player_guardians pg on pg.guardian_id = g.id
    join public.players p on p.id = pg.player_id
    where g.user_id = p_target_user_id and p.club_id = p_club_id
  ) then
    raise exception 'that user is not a member of this club';
  end if;

  update public.impersonation_sessions
     set ended_at = now()
   where actor_user_id = auth.uid() and ended_at is null;

  insert into public.impersonation_sessions
    (org_id, club_id, actor_user_id, target_user_id, reason, expires_at)
  values
    (v_org_id, p_club_id, auth.uid(), p_target_user_id, btrim(p_reason),
     now() + make_interval(mins => v_minutes))
  returning id into v_id;

  perform public.write_audit(v_org_id, 'security.impersonation.started',
    'club', p_club_id, 'user', p_target_user_id::text, null,
    jsonb_build_object('reason', btrim(p_reason), 'session_id', v_id, 'expires_in_minutes', v_minutes));

  return v_id;
end;
$$;

-- set_team_primary_coach: can't hand the lead to someone archived.
create or replace function public.set_team_primary_coach(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team public.teams%rowtype;
  v_role text;
  v_prev uuid;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception 'team % not found', p_team_id using errcode = 'no_data_found';
  end if;
  if v_team.club_id is null then
    raise exception 'team % belongs to no club, so it has no staff to lead it', p_team_id
      using errcode = 'check_violation';
  end if;

  if not public.has_staff_permission('manage_staff', v_team.club_id, p_team_id) then
    raise exception 'not authorised to designate this team''s primary coach'
      using errcode = 'insufficient_privilege';
  end if;

  select user_id into v_prev from public.user_assigned_teams
   where team_id = p_team_id and is_primary;

  update public.user_assigned_teams set is_primary = false
   where team_id = p_team_id and is_primary;

  if p_user_id is not null then
    select cs.role into v_role from public.club_staff cs
     where cs.user_id = p_user_id and cs.club_id = v_team.club_id and cs.status = 'active';

    if v_role is null then
      raise exception 'that person is not an active staff member at this club' using errcode = 'no_data_found';
    end if;
    if v_role <> 'coach' then
      raise exception 'the primary coach must hold the coach role, not %', v_role
        using errcode = 'check_violation';
    end if;

    update public.user_assigned_teams set is_primary = true
     where team_id = p_team_id and user_id = p_user_id;
    if not found then
      raise exception 'that coach is not assigned to this team yet' using errcode = 'no_data_found';
    end if;
  end if;

  perform public.write_audit(v_team.org_id, 'team.primary_coach.changed',
    'club', v_team.club_id, 'team', p_team_id::text,
    jsonb_build_object('user_id', v_prev),
    jsonb_build_object('user_id', p_user_id));
end $$;

-- Existing rows are all real, current staff -- default 'active' above already
-- backfilled them correctly, nothing further to update.

-- ============================================================================
-- P0-1: the club staff directory. StaffRow.tsx's embedded
-- `users!user_id(name, email)` join is emptied by public.users' own
-- self-row-only SELECT policy for everyone but the caller -- confirmed live:
-- the club manager, who legitimately holds club_staff_read via
-- can_read_club(), still saw "Unknown" for six of their own seven staff.
--
-- Gated identically to club_staff_read's own can_read_club() override --
-- this fixes the broken lookup for whoever could already see the full
-- roster, it does not widen who that is.
-- ============================================================================
create or replace function public.club_staff_directory(p_club_id uuid)
returns table (user_id uuid, name text, email text, role text, status text)
language sql stable security definer set search_path = public as $$
  select cs.user_id, u.name, u.email, cs.role, cs.status
  from public.club_staff cs
  join public.users u on u.id = cs.user_id
  join public.clubs c on c.id = cs.club_id
  where cs.club_id = p_club_id
    and public.can_read_club(c.org_id, p_club_id)
  order by u.name;
$$;

revoke all on function public.club_staff_directory(uuid) from public;
revoke all on function public.club_staff_directory(uuid) from anon;
grant execute on function public.club_staff_directory(uuid) to authenticated;
grant execute on function public.club_staff_directory(uuid) to service_role;

-- ============================================================================
-- P0-2: three guardian permissions were granted to every guardian by
-- default and implemented nothing -- not referenced by any string literal
-- anywhere in either application codebase. A club admin managing a
-- guardian's permission grid could "revoke" a capability that was never
-- real in either direction. Confirmed zero rows in guardian_permission_grants
-- reference them, so nothing is lost by removing the catalog entries
-- outright rather than leaving a currently-false permission standing.
-- ============================================================================
delete from public.guardian_permission_defaults
 where permission_key in ('communicate_with_club', 'manage_availability', 'manage_forms');

delete from public.permissions
 where key in ('communicate_with_club', 'manage_availability', 'manage_forms');
