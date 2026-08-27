-- Club Manager: Core entities
--
-- APPLIED to the shared Dula HQ Supabase project (zytyakbgwaegvftblkcn)
-- as migration version 20260820032120. Mirror of what was actually run
-- -- see the note at the top of 20260820032053_club_manager_foundation.sql.
--
-- All player references point at the EXISTING public.players table.
-- A player's club is always resolved via players -> teams -> club_id,
-- never a separate players.club_id column (avoids contradictory states
-- per the integration strategy doc, Section 11).

-- ---------------------------------------------------------------------
-- guardians: user_id nullable + references public.users(id), following
-- the same identity convention as club_staff (email-matched, not
-- auth.uid()-matched). Nullable because a guardian may have no account
-- yet -- see account_status below.
-- ---------------------------------------------------------------------
create table if not exists public.guardians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  name text not null,
  contact_info jsonb not null default '{}'::jsonb,
  account_status text not null default 'no_account'
    check (account_status in ('no_account', 'invited', 'active')),
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_guardians_user_id on public.guardians(user_id);

create table if not exists public.player_guardians (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  relationship text not null default 'parent'
    check (relationship in ('parent', 'legal_guardian', 'other')),
  is_primary_contact boolean not null default false,
  payment_responsible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  unique (player_id, guardian_id)
);

create index if not exists idx_player_guardians_player_id on public.player_guardians(player_id);
create index if not exists idx_player_guardians_guardian_id on public.player_guardians(guardian_id);

-- ---------------------------------------------------------------------
-- memberships: club <-> player, referencing the existing players table.
-- ---------------------------------------------------------------------
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  period_start date not null,
  period_end date,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'transferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_memberships_club_id on public.memberships(club_id);
create index if not exists idx_memberships_player_id on public.memberships(player_id);

create table if not exists public.membership_export_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  requested_by uuid not null references public.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'delivered', 'denied')),
  export_file_id uuid, -- fk -> R2-backed files record, once that exists
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_membership_export_requests_player_id on public.membership_export_requests(player_id);

-- ---------------------------------------------------------------------
-- training_sessions: team_id references the EXISTING public.teams.
-- club_id kept as a denormalized field purely for authorization/query
-- convenience (per integration doc Section 17) -- the canonical
-- relationship is training_sessions.team_id -> teams.id.
-- ---------------------------------------------------------------------
create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_id uuid references public.users(id),
  venue_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_training_sessions_club_id on public.training_sessions(club_id);
create index if not exists idx_training_sessions_team_id on public.training_sessions(team_id);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  training_session_id uuid not null references public.training_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'no_response'
    check (status in ('present', 'absent', 'excused', 'late', 'no_response')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  unique (training_session_id, player_id)
);

create index if not exists idx_attendance_training_session_id on public.attendance(training_session_id);
create index if not exists idx_attendance_player_id on public.attendance(player_id);

-- ---------------------------------------------------------------------
-- fee_charges / payments. 'tournament' excluded from fee_type --
-- tournament fees stay a Tournament Manager concern, not Club Manager.
-- ---------------------------------------------------------------------
create table if not exists public.fee_charges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  guardian_id uuid references public.guardians(id),
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
  created_by uuid references public.users(id)
);

create index if not exists idx_fee_charges_club_id on public.fee_charges(club_id);
create index if not exists idx_fee_charges_player_id on public.fee_charges(player_id);
create index if not exists idx_fee_charges_guardian_id on public.fee_charges(guardian_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  fee_charge_id uuid not null references public.fee_charges(id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  method text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_payments_fee_charge_id on public.payments(fee_charge_id);

-- ---------------------------------------------------------------------
-- trips / trip_transportation / trip_passengers
-- ---------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  purpose text not null default 'other'
    check (purpose in ('training', 'tournament', 'camp', 'match', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_trips_club_id on public.trips(club_id);

create table if not exists public.trip_transportation (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  vehicle_info jsonb not null default '{}'::jsonb,
  driver_id uuid references public.users(id),
  pickup_point text,
  dropoff_point text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_trip_transportation_trip_id on public.trip_transportation(trip_id);

create table if not exists public.trip_passengers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  seat text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id),
  unique (trip_id, player_id)
);

create index if not exists idx_trip_passengers_trip_id on public.trip_passengers(trip_id);
create index if not exists idx_trip_passengers_player_id on public.trip_passengers(player_id);

-- ---------------------------------------------------------------------
-- announcements / announcement_reads. team_id references EXISTING teams.
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'club' check (audience in (
    'club', 'team', 'players', 'guardians', 'coaches', 'staff',
    'tournament_participants', 'trip_participants'
  )),
  team_id uuid references public.teams(id),
  pinned boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.users(id)
);

create index if not exists idx_announcements_club_id on public.announcements(club_id);
create index if not exists idx_announcements_team_id on public.announcements(team_id);

create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references public.users(id),
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists idx_announcement_reads_announcement_id on public.announcement_reads(announcement_id);
