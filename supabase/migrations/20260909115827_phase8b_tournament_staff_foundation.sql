-- Tournament RBAC, phase 1: the Tournament Role layer (Organizer, IT admin,
-- Team Coordinator, Secretary, Treasurer, Logistics, Communications,
-- Volunteer Coordinator, Referee Coordinator). Mirrors club_staff's proven
-- shape exactly, including the status lifecycle from day one (club_staff
-- took two migrations to get there -- no reason to repeat that here).
--
-- Retire the two things this replaces:
--   - tournament_members: a second, incompatible role vocabulary
--     (organiser/team_manager/referee/officials/volunteer), zero rows,
--     zero consumers in either app. Dead on arrival, confirmed before
--     dropping, not guessed.
--   - access_requests: a generic "request access to some scope" table from
--     the original consolidation, zero rows, zero consumers, and its own
--     WITH CHECK (`org_id is not null`) let literally anyone including
--     anon insert into it -- a live, unauthenticated write hole, not just
--     dead weight. tournament_entry_contacts (phase8d) is the purpose-built
--     replacement for what this was apparently reaching for.
drop table if exists public.tournament_members;
drop table if exists public.access_requests;

create table public.tournament_staff (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in (
    'organizer', 'tournament_it_admin', 'team_coordinator', 'secretary',
    'treasurer', 'logistics', 'communications', 'volunteer_coordinator',
    'referee_coordinator'
  )),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended', 'archived')),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (tournament_id, user_id, role)
);
alter table public.tournament_staff enable row level security;

create table public.tournament_staff_permission_grants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  permission_key text not null references public.permissions(key),
  granted boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (tournament_id, user_id, permission_key)
);
alter table public.tournament_staff_permission_grants enable row level security;

-- Mirrors is_club_staff/is_club_manager/can_read_club/can_admin_club exactly.
create function public.is_tournament_staff(check_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournament_staff ts
                 where ts.tournament_id = check_tournament_id and ts.user_id = auth.uid() and ts.status = 'active')
      or public.is_platform_admin();
$$;

create function public.is_tournament_organizer(check_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tournament_staff ts
                 where ts.tournament_id = check_tournament_id and ts.user_id = auth.uid()
                   and ts.role = 'organizer' and ts.status = 'active')
      or public.is_platform_admin();
$$;

-- Kept as two named functions even though identical today, same reasoning
-- as can_read_club/can_admin_club on the club side: same definition now,
-- room to diverge later without a rename.
create function public.can_read_tournament(p_org uuid, p_tournament uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_tournament_organizer(p_tournament) or public.is_org_admin(p_org);
$$;

create function public.can_admin_tournament(p_org uuid, p_tournament uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_tournament_organizer(p_tournament) or public.is_org_admin(p_org);
$$;

create policy tournament_staff_read on public.tournament_staff for select to authenticated
using (public.can_read_tournament(org_id, tournament_id) or user_id = auth.uid());

-- Only the Organizer (or org_admin, to bootstrap the very first Organizer --
-- same bootstrap problem club_manager had, same fix) can add/remove
-- tournament staff -- mirrors club_staff_write's can_admin_club exactly.
create policy tournament_staff_write on public.tournament_staff for all to authenticated
using (public.can_admin_tournament(org_id, tournament_id))
with check (public.can_admin_tournament(org_id, tournament_id));

create policy tspg_read on public.tournament_staff_permission_grants for select to authenticated
using (public.can_read_tournament(
  (select t.org_id from public.tournaments t where t.id = tournament_id), tournament_id
));
create policy tspg_write on public.tournament_staff_permission_grants for all to authenticated
using (public.can_admin_tournament(
  (select t.org_id from public.tournaments t where t.id = tournament_id), tournament_id
))
with check (public.can_admin_tournament(
  (select t.org_id from public.tournaments t where t.id = tournament_id), tournament_id
));

-- ============================================================================
-- Permission catalog: 12 new tournament-domain keys. view_audit_log,
-- manage_account_status, and submit_support_request are deliberately
-- REUSED, not duplicated -- they're conceptually identical regardless of
-- club vs tournament context, and permissions.scope only ever mattered for
-- has_staff_permission's team-fence bypass logic, which
-- has_tournament_permission (below) has no equivalent of.
-- ============================================================================
insert into public.permissions (key, category, scope, label, description) values
  ('manage_tournament', 'staff', 'tournament', 'Manage tournament', 'Configure tournament identity, categories, rules, deadlines, and requirements; publish, close, or archive the tournament'),
  ('manage_tournament_staff', 'staff', 'tournament', 'Manage tournament staff', 'Add or remove tournament staff'),
  ('manage_competition', 'staff', 'tournament', 'Manage competition', 'Divisions, groups, brackets, fixtures, scheduling, standings, and seeding'),
  ('decide_tournament_entry', 'staff', 'tournament', 'Decide tournament entry', 'Accept or reject a team''s tournament registration'),
  ('review_tournament_entry', 'staff', 'tournament', 'Review tournament entry', 'Verify a registration''s requirements, documents, fees, and eligibility -- does not decide it'),
  ('manage_tournament_documents', 'staff', 'tournament', 'Manage tournament documents', 'Tournament documentation, records, and official correspondence'),
  ('manage_tournament_finances', 'staff', 'tournament', 'Manage tournament finances', 'Registration fees, payments, refunds, and expenses'),
  ('view_tournament_finances', 'staff', 'tournament', 'View tournament finances', 'View tournament fee and financial records'),
  ('manage_tournament_logistics', 'staff', 'tournament', 'Manage tournament logistics', 'Venues, fields, equipment, transportation, and match-day operations'),
  ('manage_tournament_communications', 'staff', 'tournament', 'Manage tournament communications', 'Tournament-wide announcements and notices'),
  ('manage_tournament_volunteers', 'staff', 'tournament', 'Manage volunteers', 'Volunteer recruitment, assignments, shifts, and availability'),
  ('manage_officiating', 'staff', 'tournament', 'Manage officiating', 'Referee/official assignments and officiating schedules for this tournament')
on conflict (key) do nothing;

insert into public.role_permission_defaults (role, permission_key) values
  ('organizer', 'manage_tournament'),
  ('organizer', 'manage_tournament_staff'),
  ('organizer', 'manage_competition'),
  ('organizer', 'decide_tournament_entry'),
  ('organizer', 'review_tournament_entry'),
  ('organizer', 'manage_tournament_documents'),
  ('organizer', 'manage_tournament_finances'),
  ('organizer', 'view_tournament_finances'),
  ('organizer', 'manage_tournament_logistics'),
  ('organizer', 'manage_tournament_communications'),
  ('organizer', 'manage_tournament_volunteers'),
  ('organizer', 'manage_officiating'),
  ('organizer', 'view_audit_log'),
  ('organizer', 'submit_support_request'),
  ('tournament_it_admin', 'view_audit_log'),
  ('tournament_it_admin', 'manage_account_status'),
  ('tournament_it_admin', 'submit_support_request'),
  ('team_coordinator', 'review_tournament_entry'),
  ('secretary', 'manage_tournament_documents'),
  ('treasurer', 'manage_tournament_finances'),
  ('treasurer', 'view_tournament_finances'),
  ('logistics', 'manage_tournament_logistics'),
  ('communications', 'manage_tournament_communications'),
  ('volunteer_coordinator', 'manage_tournament_volunteers'),
  ('referee_coordinator', 'manage_officiating')
on conflict do nothing;

-- No team-fence branch: there's no entry-level narrowing yet (deferred --
-- every Tournament Role holder is tournament-wide, mirroring club_manager's
-- own club-wide bypass, until a real need for narrowing shows up). Since
-- there's no fence to bypass, permissions.scope plays no role here at all --
-- that's what makes reusing club-scoped keys (view_audit_log etc.) safe.
--
-- NOTE: superseded by phase8b1_fix_has_tournament_permission_scope_leak
-- immediately below in the same session -- kept here at its originally
-- applied shape for migration-history fidelity; the corrected version is
-- what actually ends up live.
create function public.has_tournament_permission(p_permission_key text, p_tournament_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.is_platform_admin()
    or exists (
      select 1 from public.tournament_staff ts
      where ts.tournament_id = p_tournament_id
        and ts.user_id = auth.uid()
        and ts.status = 'active'
        and not exists (
          select 1 from public.tournament_staff_permission_grants g
          where g.tournament_id = p_tournament_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
            and g.granted = false
        )
        and (
          exists (
            select 1 from public.tournament_staff_permission_grants g
            where g.tournament_id = p_tournament_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = true
          )
          or exists (
            select 1 from public.role_permission_defaults d
            where d.role = ts.role and d.permission_key = p_permission_key
          )
        )
    );
$$;

create function public.tournament_staff_directory(p_tournament_id uuid)
returns table (user_id uuid, name text, email text, role text, status text)
language sql stable security definer set search_path = public as $$
  select ts.user_id, u.name, u.email, ts.role, ts.status
  from public.tournament_staff ts
  join public.users u on u.id = ts.user_id
  where ts.tournament_id = p_tournament_id
    and (public.can_read_tournament(ts.org_id, p_tournament_id) or ts.user_id = auth.uid())
  order by u.name;
$$;

create function public.tournament_audit_log(p_tournament_id uuid)
returns table (id bigint, ts timestamptz, actor_email text, action text, entity_type text, entity_id text, before jsonb, after jsonb)
language sql stable security definer set search_path = public as $$
  select a.id, a.ts, a.actor_email, a.action, a.entity_type, a.entity_id, a.before, a.after
  from public.audit_log a
  where a.scope_type = 'tournament'
    and a.scope_id = p_tournament_id
    and public.has_tournament_permission('view_audit_log', p_tournament_id)
  order by a.ts desc
  limit 50;
$$;

create function public.set_tournament_staff_account_status(p_tournament_id uuid, p_target_user_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tournament public.tournaments%rowtype;
  v_current text;
begin
  if p_status not in ('active', 'suspended') then
    raise exception 'status must be active or suspended' using errcode = 'check_violation';
  end if;
  if p_target_user_id = auth.uid() then
    raise exception 'cannot change your own account status' using errcode = 'insufficient_privilege';
  end if;

  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found then
    raise exception 'tournament not found' using errcode = 'no_data_found';
  end if;

  if not public.has_tournament_permission('manage_account_status', p_tournament_id) then
    raise exception 'not authorised to change account status at this tournament'
      using errcode = 'insufficient_privilege';
  end if;

  select status into v_current from public.tournament_staff
   where tournament_id = p_tournament_id and user_id = p_target_user_id;
  if v_current is null then
    raise exception 'that person is not staff at this tournament' using errcode = 'no_data_found';
  end if;
  if v_current = 'archived' then
    raise exception 'that person has been removed from the tournament -- re-add them to restore access'
      using errcode = 'check_violation';
  end if;
  if v_current = p_status then
    raise exception 'already %', p_status using errcode = 'check_violation';
  end if;

  update public.tournament_staff set status = p_status
   where tournament_id = p_tournament_id and user_id = p_target_user_id;

  perform public.write_audit(v_tournament.org_id,
    case when p_status = 'suspended' then 'tournament_staff.suspended' else 'tournament_staff.reactivated' end,
    'tournament', p_tournament_id, 'tournament_staff', p_target_user_id::text,
    jsonb_build_object('status', v_current), jsonb_build_object('status', p_status));
end $$;

revoke all on function public.tournament_staff_directory(uuid) from public;
revoke all on function public.tournament_staff_directory(uuid) from anon;
grant execute on function public.tournament_staff_directory(uuid) to authenticated;
grant execute on function public.tournament_staff_directory(uuid) to service_role;

revoke all on function public.tournament_audit_log(uuid) from public;
revoke all on function public.tournament_audit_log(uuid) from anon;
grant execute on function public.tournament_audit_log(uuid) to authenticated;
grant execute on function public.tournament_audit_log(uuid) to service_role;

revoke all on function public.set_tournament_staff_account_status(uuid, uuid, text) from public;
revoke all on function public.set_tournament_staff_account_status(uuid, uuid, text) from anon;
grant execute on function public.set_tournament_staff_account_status(uuid, uuid, text) to authenticated;
grant execute on function public.set_tournament_staff_account_status(uuid, uuid, text) to service_role;

revoke all on function public.has_tournament_permission(text, uuid) from public;
revoke all on function public.has_tournament_permission(text, uuid) from anon;
grant execute on function public.has_tournament_permission(text, uuid) to authenticated;
grant execute on function public.has_tournament_permission(text, uuid) to service_role;

revoke all on function public.is_tournament_staff(uuid) from public;
revoke all on function public.is_tournament_staff(uuid) from anon;
grant execute on function public.is_tournament_staff(uuid) to authenticated;
grant execute on function public.is_tournament_staff(uuid) to service_role;

revoke all on function public.is_tournament_organizer(uuid) from public;
revoke all on function public.is_tournament_organizer(uuid) from anon;
grant execute on function public.is_tournament_organizer(uuid) to authenticated;
grant execute on function public.is_tournament_organizer(uuid) to service_role;

revoke all on function public.can_read_tournament(uuid, uuid) from public;
revoke all on function public.can_read_tournament(uuid, uuid) from anon;
grant execute on function public.can_read_tournament(uuid, uuid) to authenticated;
grant execute on function public.can_read_tournament(uuid, uuid) to service_role;

revoke all on function public.can_admin_tournament(uuid, uuid) from public;
revoke all on function public.can_admin_tournament(uuid, uuid) from anon;
grant execute on function public.can_admin_tournament(uuid, uuid) to authenticated;
grant execute on function public.can_admin_tournament(uuid, uuid) to service_role;
