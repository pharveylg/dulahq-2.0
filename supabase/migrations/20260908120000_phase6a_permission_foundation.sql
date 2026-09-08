-- Phase 6a: granular permission foundation.
--
-- Additive only -- creates the permission catalog, role/guardian default
-- bundles, and per-person override tables, plus has_staff_permission() /
-- has_guardian_permission() to query them. Nothing existing is rewired to
-- use these yet: no RLS policy on clubs/players/development_goals/etc
-- changes in this migration. The default bundles are seeded to reproduce
-- today's actual behavior (club_staff.role + is_assigned_to_team() +
-- guardians seeing everything about their linked player) exactly, so this
-- migration is behavior-neutral -- it just makes that behavior queryable
-- and overridable per person, ready for later phases to switch individual
-- tables' policies over to it one at a time instead of one large cutover.
--
-- club_admin does not get a hardcoded bypass in has_staff_permission(): per
-- the Player Profile spec's "do not simply make every administrator a
-- superuser", club_admin instead gets a role default bundle containing
-- every staff permission. Same permission-check code path as everyone
-- else; the breadth is data (role_permission_defaults rows), not a special
-- case in the function, so a future club could in principle narrow it.

-- ============================================================
-- Catalog (reference data, like sports/development_skills)
-- ============================================================

create table public.permissions (
  key text primary key,
  category text not null check (category in ('staff', 'guardian')),
  scope text not null check (scope in ('club', 'team', 'player')),
  label text not null,
  description text
);
comment on table public.permissions is 'Catalog of grantable permission keys. Reference data -- no org_id, seeded by migration only.';
comment on column public.permissions.scope is 'club: granted club-wide once role/override applies. team: additionally requires the acting team to be in the staff member''s assigned teams (user_assigned_teams), unless they are club_admin. player: guardian-side permissions, inherently scoped to one player_guardians relationship.';

alter table public.permissions enable row level security;
create policy "permissions readable by any authenticated user"
  on public.permissions for select to authenticated using (true);

insert into public.permissions (key, category, scope, label, description) values
  ('view_team', 'staff', 'team', 'View team', 'View an assigned team''s roster and schedule'),
  ('view_player', 'staff', 'team', 'View player', 'View players on an assigned team'),
  ('edit_player_football_profile', 'staff', 'team', 'Edit player football profile', 'Edit position, preferred foot, and other football-profile fields'),
  ('view_attendance', 'staff', 'team', 'View attendance', 'View training attendance records'),
  ('manage_attendance', 'staff', 'team', 'Manage attendance', 'Take and edit training attendance'),
  ('view_development', 'staff', 'team', 'View development', 'View development goals, evaluations, and progress'),
  ('manage_development', 'staff', 'team', 'Manage development', 'Create and edit development goals'),
  ('add_evaluation', 'staff', 'team', 'Add evaluation', 'Record a player evaluation and skill ratings'),
  ('add_player_feedback', 'staff', 'team', 'Add player feedback', 'Add player-visible coach feedback'),
  ('add_private_coach_note', 'staff', 'team', 'Add private coach note', 'Add a private note not visible to player/guardian'),
  ('manage_training', 'staff', 'team', 'Manage training', 'Create and schedule training sessions and session plans'),
  ('manage_match', 'staff', 'team', 'Manage match', 'Record match events, minutes, and statistics'),
  ('manage_lineup', 'staff', 'team', 'Manage lineup', 'Select match lineup and substitutes'),
  ('view_tournament', 'staff', 'team', 'View tournament', 'View tournaments an assigned team is entered in'),
  ('fill_tournament_roster', 'staff', 'team', 'Fill tournament roster', 'Select players from the team roster onto a proposed tournament roster'),
  ('request_guardian_acknowledgement', 'staff', 'team', 'Request guardian acknowledgement', 'Submit a proposed tournament roster for guardian acknowledgement'),
  ('finalize_tournament_roster', 'staff', 'team', 'Finalize tournament roster', 'Finalize a tournament roster once eligible players are acknowledged'),
  ('export_tournament_roster', 'staff', 'team', 'Export tournament roster', 'Generate a TXT/PDF of a finalized tournament roster'),
  ('view_finances', 'staff', 'club', 'View finances', 'View club-wide fee ledger and expenses'),
  ('manage_finances', 'staff', 'club', 'Manage finances', 'Create/edit fee charges, record payments, manage expenses'),
  ('manage_membership', 'staff', 'club', 'Manage membership', 'Manage player registration/membership status and records'),
  ('manage_documents', 'staff', 'club', 'Manage documents', 'Review and manage uploaded forms/waivers/documents'),
  ('view_medical', 'staff', 'team', 'View medical/safety info', 'View medical alerts and safety information for assigned players'),
  ('manage_staff', 'staff', 'club', 'Manage staff', 'Add/remove club staff and assign teams'),
  ('manage_club', 'staff', 'club', 'Manage club', 'Rename the club and change club-wide settings'),
  ('manage_communications', 'staff', 'club', 'Manage communications', 'Send team/club announcements and reminders'),
  ('view_schedule', 'guardian', 'player', 'View schedule', 'View training, match, and tournament schedule'),
  ('manage_availability', 'guardian', 'player', 'Manage availability', 'Set the player''s availability for training/matches'),
  ('view_attendance_guardian', 'guardian', 'player', 'View attendance', 'View the player''s attendance history'),
  ('view_development_guardian', 'guardian', 'player', 'View development', 'View the player''s development goals and progress'),
  ('view_evaluations', 'guardian', 'player', 'View evaluations', 'View the player''s evaluations'),
  ('view_feedback', 'guardian', 'player', 'View feedback', 'View player-visible coach feedback'),
  ('view_matches', 'guardian', 'player', 'View matches', 'View match participation and statistics'),
  ('view_statistics', 'guardian', 'player', 'View statistics', 'View match/competitive statistics'),
  ('receive_notifications', 'guardian', 'player', 'Receive notifications', 'Receive notifications about the player'),
  ('communicate_with_club', 'guardian', 'player', 'Communicate with club', 'Message the club/coach about the player'),
  ('manage_forms', 'guardian', 'player', 'Manage forms', 'Complete and sign required forms/waivers'),
  ('manage_fees', 'guardian', 'player', 'Manage fees', 'View and pay the player''s fees'),
  ('acknowledge_tournament', 'guardian', 'player', 'Acknowledge tournament', 'Confirm or decline the player''s tournament participation'),
  ('view_documents', 'guardian', 'player', 'View documents', 'View the player''s completed documents');

-- ============================================================
-- Default bundles
-- ============================================================

create table public.role_permission_defaults (
  role text not null check (role in ('club_admin', 'staff', 'coach', 'team_manager')),
  permission_key text not null references public.permissions(key),
  primary key (role, permission_key)
);
comment on table public.role_permission_defaults is 'Default permission bundle per club_staff.role. Reference data, seeded to match current app behavior.';

alter table public.role_permission_defaults enable row level security;
create policy "role_permission_defaults readable by any authenticated user"
  on public.role_permission_defaults for select to authenticated using (true);

-- club_admin: every staff permission (broad default, not a hardcoded bypass -- see file header).
insert into public.role_permission_defaults (role, permission_key)
  select 'club_admin', key from public.permissions where category = 'staff';

-- coach / team_manager: today's canManage-gated team operations, identical
-- for both roles (the app doesn't currently distinguish them -- see
-- getClubAccess()'s single canManage check covering both).
insert into public.role_permission_defaults (role, permission_key)
  select r, key from (values ('coach'), ('team_manager')) as roles(r)
  cross join (values
    ('view_team'), ('view_player'), ('edit_player_football_profile'),
    ('view_attendance'), ('manage_attendance'),
    ('view_development'), ('manage_development'), ('add_evaluation'), ('add_player_feedback'), ('add_private_coach_note'),
    ('manage_training'), ('manage_match'), ('manage_lineup'),
    ('view_tournament'), ('fill_tournament_roster'), ('request_guardian_acknowledgement'),
    ('finalize_tournament_roster'), ('export_tournament_roster'),
    ('view_medical')
  ) as perms(key);

-- staff: today's exception is fee management without team assignment
-- (canManageFees = canManage || role === 'staff'), plus the club-wide
-- admin-adjacent duties a "staff" club_staff row plausibly covers already
-- (documents, membership, communications) -- none of this is team- or
-- development-scoped, matching that "staff" today has no coaching UI.
insert into public.role_permission_defaults (role, permission_key) values
  ('staff', 'view_team'), ('staff', 'view_player'),
  ('staff', 'view_finances'), ('staff', 'manage_finances'),
  ('staff', 'manage_membership'), ('staff', 'manage_documents'), ('staff', 'manage_communications'),
  ('staff', 'view_tournament');

create table public.guardian_permission_defaults (
  permission_key text primary key references public.permissions(key)
);
comment on table public.guardian_permission_defaults is 'Default permission bundle applied to every new player_guardians relationship. Seeded to match current behavior: a linked guardian sees everything about that player today, with no per-permission restriction.';

alter table public.guardian_permission_defaults enable row level security;
create policy "guardian_permission_defaults readable by any authenticated user"
  on public.guardian_permission_defaults for select to authenticated using (true);

insert into public.guardian_permission_defaults (permission_key)
  select key from public.permissions where category = 'guardian';

-- ============================================================
-- Per-person overrides
-- ============================================================

create table public.staff_permission_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null,
  permission_key text not null references public.permissions(key),
  team_id uuid references public.teams(id) on delete cascade,
  granted boolean not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  unique (club_id, user_id, permission_key, team_id)
);
comment on table public.staff_permission_grants is 'Per-person override of a role default: granted=true adds a permission beyond the role bundle, granted=false revokes one the role bundle would otherwise give. team_id null = club-wide override; non-null = scoped to that one team only.';
comment on column public.permissions.category is 'staff: club_staff-side permission, checked via has_staff_permission(). guardian: guardian-side, checked via has_guardian_permission().';

alter table public.staff_permission_grants enable row level security;

create policy "staff_permission_grants read: self or club admin"
  on public.staff_permission_grants for select to authenticated
  using (user_id = auth.uid() or public.is_club_admin(club_id) or public.is_platform_admin());

-- Writes are gated on is_club_admin()/is_platform_admin() directly, not on
-- a 'manage_staff' permission check -- a permission system that could grant
-- away its own configuration is a footgun; club_admin owning grants is a
-- fixed rule, not itself configurable, in this first version.
create policy "staff_permission_grants write: club admin only"
  on public.staff_permission_grants for all to authenticated
  using (public.is_club_admin(club_id) or public.is_platform_admin())
  with check (public.is_club_admin(club_id) or public.is_platform_admin());

create table public.guardian_permission_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  player_guardian_id uuid not null references public.player_guardians(id) on delete cascade,
  permission_key text not null references public.permissions(key),
  granted boolean not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  unique (player_guardian_id, permission_key)
);
comment on table public.guardian_permission_grants is 'Per-relationship override of the guardian default bundle, keyed on one specific player_guardians row (so the same guardian can have different permissions for different children).';

alter table public.guardian_permission_grants enable row level security;

create policy "guardian_permission_grants read: the guardian or club admin"
  on public.guardian_permission_grants for select to authenticated
  using (
    exists (
      select 1 from public.player_guardians pg
      join public.guardians g on g.id = pg.guardian_id
      where pg.id = player_guardian_id and g.user_id = auth.uid()
    )
    or exists (
      select 1 from public.player_guardians pg
      join public.players p on p.id = pg.player_id
      where pg.id = player_guardian_id
      and (public.is_club_admin(p.club_id) or public.is_platform_admin())
    )
  );

create policy "guardian_permission_grants write: club admin only"
  on public.guardian_permission_grants for all to authenticated
  using (
    exists (
      select 1 from public.player_guardians pg
      join public.players p on p.id = pg.player_id
      where pg.id = player_guardian_id
      and (public.is_club_admin(p.club_id) or public.is_platform_admin())
    )
  )
  with check (
    exists (
      select 1 from public.player_guardians pg
      join public.players p on p.id = pg.player_id
      where pg.id = player_guardian_id
      and (public.is_club_admin(p.club_id) or public.is_platform_admin())
    )
  );

-- ============================================================
-- Effective-permission functions
-- ============================================================

create or replace function public.has_staff_permission(p_permission_key text, p_club_id uuid, p_team_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.club_staff cs
      join public.permissions perm on perm.key = p_permission_key
      where cs.club_id = p_club_id
        and cs.user_id = auth.uid()
        -- team-scoped permissions additionally require the acting team to
        -- be one this person is assigned to, unless they're club_admin
        -- (club-wide by role) -- mirrors today's canManage logic exactly.
        and (
          perm.scope = 'club'
          or cs.role = 'club_admin'
          or (p_team_id is not null and p_team_id in (select public.current_user_team_ids()))
        )
        and (
          -- explicit revoke always wins
          not exists (
            select 1 from public.staff_permission_grants g
            where g.club_id = p_club_id and g.user_id = auth.uid() and g.permission_key = p_permission_key
              and g.granted = false and (g.team_id is null or g.team_id = p_team_id)
          )
        )
        and (
          -- explicit grant, or the role's default bundle includes it
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
comment on function public.has_staff_permission is 'Effective club_staff-side permission check: role default bundle, overridden per-person by staff_permission_grants, gated by team assignment for team-scoped permissions. Platform admin always passes.';

create or replace function public.has_guardian_permission(p_permission_key text, p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin()
    or exists (
      select 1
      from public.player_guardians pg
      join public.guardians g on g.id = pg.guardian_id
      where pg.player_id = p_player_id
        and g.user_id = auth.uid()
        and not exists (
          select 1 from public.guardian_permission_grants gr
          where gr.player_guardian_id = pg.id and gr.permission_key = p_permission_key and gr.granted = false
        )
        and (
          exists (
            select 1 from public.guardian_permission_grants gr
            where gr.player_guardian_id = pg.id and gr.permission_key = p_permission_key and gr.granted = true
          )
          or exists (
            select 1 from public.guardian_permission_defaults d where d.permission_key = p_permission_key
          )
        )
    );
$$;
comment on function public.has_guardian_permission is 'Effective guardian-side permission check for one player: default bundle, overridden per player_guardians relationship by guardian_permission_grants. Platform admin always passes.';

-- Convenience set-returning functions for the UI to ask "what can I do
-- here" once, instead of one round trip per permission key. Still backed
-- by the same has_*_permission() logic (called per row), not a shortcut
-- around it -- these exist for UI affordances, not authorization.
create or replace function public.my_staff_permissions(p_club_id uuid, p_team_id uuid default null)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select perm.key
  from public.permissions perm
  where perm.category = 'staff'
    and public.has_staff_permission(perm.key, p_club_id, p_team_id);
$$;

create or replace function public.my_guardian_permissions(p_player_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select perm.key
  from public.permissions perm
  where perm.category = 'guardian'
    and public.has_guardian_permission(perm.key, p_player_id);
$$;

-- anon has no business calling any of this directly; authenticated only.
revoke all on function public.has_staff_permission(text, uuid, uuid) from public, anon;
revoke all on function public.has_guardian_permission(text, uuid) from public, anon;
revoke all on function public.my_staff_permissions(uuid, uuid) from public, anon;
revoke all on function public.my_guardian_permissions(uuid) from public, anon;
grant execute on function public.has_staff_permission(text, uuid, uuid) to authenticated;
grant execute on function public.has_guardian_permission(text, uuid) to authenticated;
grant execute on function public.my_staff_permissions(uuid, uuid) to authenticated;
grant execute on function public.my_guardian_permissions(uuid) to authenticated;
