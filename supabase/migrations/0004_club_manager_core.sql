-- Club Manager: Phase 1 — Core tables
--
-- Continues the numbering convention from the `dula-hq` repo's migrations
-- (0001_foundation.sql, 0002_rls_policies.sql, 0003_role_permissions.sql).
-- This migration DEPENDS on those three already being applied: it reuses
-- `set_updated_at()` (defined in 0001) and assumes `tenants`, `sports`,
-- and `auth.users` already exist.
--
-- RLS is deliberately NOT enabled in this file -- see
-- 0005_club_manager_rls.sql. Splitting schema from policy the same way
-- dula-hq's 0001/0002 did, so each can be reviewed independently.

-- ---------------------------------------------------------------------
-- clubs: scoped to a tenant, same level as `organizations` in Tournament
-- Manager.
-- ---------------------------------------------------------------------
create table clubs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  branding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger clubs_set_updated_at
  before update on clubs
  for each row execute function set_updated_at();

create index idx_clubs_tenant_id on clubs(tenant_id);

-- ---------------------------------------------------------------------
-- teams: created here (club_id required), but conceptually shared with
-- Tournament Manager per the entity ownership table -- Tournament
-- Manager references teams.id for registrations, it doesn't own the row.
-- Created before club_staff/staff_team_assignments below since those
-- reference teams.id.
-- ---------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  age_group text,
  sport_id uuid references sports(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger teams_set_updated_at
  before update on teams
  for each row execute function set_updated_at();

create index idx_teams_club_id on teams(club_id);
create index idx_teams_sport_id on teams(sport_id);

-- ---------------------------------------------------------------------
-- club_staff: club-scoped roles (administrators, staff, coaches, team
-- managers). Distinct from tenant_users -- a club role is scoped to one
-- club, not the whole tenant.
-- ---------------------------------------------------------------------
create table club_staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('club_admin', 'staff', 'coach', 'team_manager')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (club_id, user_id, role)
);

create trigger club_staff_set_updated_at
  before update on club_staff
  for each row execute function set_updated_at();

create index idx_club_staff_club_id on club_staff(club_id);
create index idx_club_staff_user_id on club_staff(user_id);

-- ---------------------------------------------------------------------
-- staff_team_assignments: which teams a coach/team_manager is actually
-- assigned to. club_admin/staff don't need rows here -- they're
-- club-wide by role, checked separately in RLS.
-- ---------------------------------------------------------------------
create table staff_team_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_staff_id uuid not null references club_staff(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (club_staff_id, team_id)
);

create trigger staff_team_assignments_set_updated_at
  before update on staff_team_assignments
  for each row execute function set_updated_at();

create index idx_staff_team_assignments_team_id on staff_team_assignments(team_id);

-- ---------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid references auth.users(id), -- nullable: many players have no login
  name text not null,
  date_of_birth date,
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger players_set_updated_at
  before update on players
  for each row execute function set_updated_at();

create index idx_players_club_id on players(club_id);
create index idx_players_user_id on players(user_id);

-- ---------------------------------------------------------------------
-- guardians
-- ---------------------------------------------------------------------
create table guardians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id), -- nullable: see design doc, Resolved Decision #2
  name text not null,
  contact_info jsonb not null default '{}'::jsonb,
  account_status text not null default 'no_account'
    check (account_status in ('no_account', 'invited', 'active')),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger guardians_set_updated_at
  before update on guardians
  for each row execute function set_updated_at();

create index idx_guardians_user_id on guardians(user_id);
create index idx_guardians_tenant_id on guardians(tenant_id);

-- ---------------------------------------------------------------------
-- player_guardians
-- ---------------------------------------------------------------------
create table player_guardians (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  guardian_id uuid not null references guardians(id) on delete cascade,
  relationship text not null default 'parent'
    check (relationship in ('parent', 'legal_guardian', 'other')),
  is_primary_contact boolean not null default false,
  payment_responsible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (player_id, guardian_id)
);

create trigger player_guardians_set_updated_at
  before update on player_guardians
  for each row execute function set_updated_at();

create index idx_player_guardians_player_id on player_guardians(player_id);
create index idx_player_guardians_guardian_id on player_guardians(guardian_id);

-- ---------------------------------------------------------------------
-- team_players
-- ---------------------------------------------------------------------
create table team_players (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger team_players_set_updated_at
  before update on team_players
  for each row execute function set_updated_at();

create index idx_team_players_team_id on team_players(team_id);
create index idx_team_players_player_id on team_players(player_id);

-- ---------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------
create table memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  period_start date not null,
  period_end date,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'transferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger memberships_set_updated_at
  before update on memberships
  for each row execute function set_updated_at();

create index idx_memberships_club_id on memberships(club_id);
create index idx_memberships_player_id on memberships(player_id);

-- ---------------------------------------------------------------------
-- membership_export_requests
-- Note: export_file_id has no FK yet -- shared/files doesn't exist.
-- Left as a plain uuid column; add the FK constraint once that table
-- exists (see docs/club-manager-design.md, Definition of done).
-- ---------------------------------------------------------------------
create table membership_export_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'delivered', 'denied')),
  export_file_id uuid, -- fk -> shared/files, once it exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger membership_export_requests_set_updated_at
  before update on membership_export_requests
  for each row execute function set_updated_at();

create index idx_membership_export_requests_player_id on membership_export_requests(player_id);

-- ---------------------------------------------------------------------
-- training_sessions
-- Note: venue_id has no FK yet -- Club Manager doesn't have its own
-- venues table (Tournament Manager's `venues` may be reused later via
-- the integration layer). Left as a plain uuid column for now.
-- ---------------------------------------------------------------------
create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  coach_id uuid references auth.users(id),
  venue_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger training_sessions_set_updated_at
  before update on training_sessions
  for each row execute function set_updated_at();

create index idx_training_sessions_club_id on training_sessions(club_id);
create index idx_training_sessions_team_id on training_sessions(team_id);

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  training_session_id uuid not null references training_sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null default 'no_response'
    check (status in ('present', 'absent', 'excused', 'late', 'no_response')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (training_session_id, player_id)
);

create trigger attendance_set_updated_at
  before update on attendance
  for each row execute function set_updated_at();

create index idx_attendance_training_session_id on attendance(training_session_id);
create index idx_attendance_player_id on attendance(player_id);

-- ---------------------------------------------------------------------
-- fee_charges
-- NOTE: 'tournament' is deliberately excluded from fee_type -- see
-- Resolved Decision #1 in docs/club-manager-design.md. Tournament entry
-- fees are billed by Tournament Manager, not here.
-- ---------------------------------------------------------------------
create table fee_charges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  guardian_id uuid references guardians(id),
  fee_type text not null check (fee_type in (
    'registration', 'membership', 'training', 'uniform',
    'equipment', 'transportation', 'accommodation', 'other'
  )),
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  due_date date,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger fee_charges_set_updated_at
  before update on fee_charges
  for each row execute function set_updated_at();

create index idx_fee_charges_club_id on fee_charges(club_id);
create index idx_fee_charges_player_id on fee_charges(player_id);
create index idx_fee_charges_guardian_id on fee_charges(guardian_id);

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  fee_charge_id uuid not null references fee_charges(id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

create index idx_payments_fee_charge_id on payments(fee_charge_id);

-- ---------------------------------------------------------------------
-- trips / trip_transportation / trip_passengers
-- ---------------------------------------------------------------------
create table trips (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  purpose text not null default 'other'
    check (purpose in ('training', 'tournament', 'camp', 'match', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger trips_set_updated_at
  before update on trips
  for each row execute function set_updated_at();

create index idx_trips_club_id on trips(club_id);

create table trip_transportation (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  vehicle_info jsonb not null default '{}'::jsonb,
  driver_id uuid references auth.users(id),
  pickup_point text,
  dropoff_point text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger trip_transportation_set_updated_at
  before update on trip_transportation
  for each row execute function set_updated_at();

create index idx_trip_transportation_trip_id on trip_transportation(trip_id);

create table trip_passengers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  trip_id uuid not null references trips(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  seat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (trip_id, player_id)
);

create trigger trip_passengers_set_updated_at
  before update on trip_passengers
  for each row execute function set_updated_at();

create index idx_trip_passengers_trip_id on trip_passengers(trip_id);
create index idx_trip_passengers_player_id on trip_passengers(player_id);

-- ---------------------------------------------------------------------
-- announcements / announcement_reads
-- ---------------------------------------------------------------------
create table announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'club' check (audience in (
    'club', 'team', 'players', 'guardians', 'coaches', 'staff',
    'tournament_participants', 'trip_participants'
  )),
  team_id uuid references teams(id), -- set when audience = 'team'
  pinned boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create trigger announcements_set_updated_at
  before update on announcements
  for each row execute function set_updated_at();

create index idx_announcements_club_id on announcements(club_id);
create index idx_announcements_team_id on announcements(team_id);

create table announcement_reads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index idx_announcement_reads_announcement_id on announcement_reads(announcement_id);
