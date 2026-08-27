-- Club Manager: Phase 2 — Row Level Security
--
-- Depends on 0004_club_manager_core.sql. Implements the three-way scoping
-- from docs/club-manager-design.md: club-wide staff OR assigned-team
-- staff OR own-player guardian/player.

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

-- A user has SOME role at this specific club (any of the 4 club_staff roles).
create or replace function is_club_staff(check_club_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from club_staff
    where club_id = check_club_id and user_id = auth.uid()
  );
$$;

-- Narrower: is this user a coach/team_manager specifically assigned to
-- this team? (club_admin/staff bypass this via is_club_staff() instead,
-- since they're club-wide, not team-specific.)
create or replace function is_assigned_to_team(check_team_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from staff_team_assignments sta
    join club_staff cs on cs.id = sta.club_staff_id
    where sta.team_id = check_team_id and cs.user_id = auth.uid()
  );
$$;

-- A guardian's own linked players.
create or replace function is_guardian_of(check_player_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from player_guardians pg
    join guardians g on g.id = pg.guardian_id
    where pg.player_id = check_player_id and g.user_id = auth.uid()
  );
$$;

-- A player viewing their own record.
create or replace function is_own_player_record(check_player_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from players
    where id = check_player_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------
alter table clubs enable row level security;

create policy "tenant members can view clubs"
  on clubs for select
  using (is_tenant_member(tenant_id));

create policy "club staff can update their club"
  on clubs for update
  using (is_club_staff(id))
  with check (is_club_staff(id));

create policy "tenant members can create clubs"
  on clubs for insert
  with check (is_tenant_member(tenant_id));

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
alter table teams enable row level security;

create policy "tenant members can view teams"
  on teams for select
  using (is_tenant_member(tenant_id));

create policy "club staff can manage teams"
  on teams for insert
  with check (is_club_staff(club_id));

create policy "club staff can update teams"
  on teams for update
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

-- ---------------------------------------------------------------------
-- club_staff / staff_team_assignments
-- ---------------------------------------------------------------------
alter table club_staff enable row level security;

create policy "club staff can view their own club's staff"
  on club_staff for select
  using (is_club_staff(club_id));

create policy "club_admin can manage staff"
  on club_staff for insert
  with check (
    exists (
      select 1 from club_staff cs
      where cs.club_id = club_staff.club_id
        and cs.user_id = auth.uid()
        and cs.role = 'club_admin'
    )
  );

alter table staff_team_assignments enable row level security;

create policy "club staff can view team assignments"
  on staff_team_assignments for select
  using (
    exists (
      select 1 from club_staff cs
      where cs.id = staff_team_assignments.club_staff_id
        and is_club_staff(cs.club_id)
    )
  );

-- ---------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------
alter table players enable row level security;

create policy "club manager players visibility"
  on players for select
  using (
    is_club_staff(club_id)
    or is_guardian_of(id)
    or is_own_player_record(id)
  );

create policy "club staff can manage players"
  on players for insert
  with check (is_club_staff(club_id));

create policy "club staff can update players"
  on players for update
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

-- ---------------------------------------------------------------------
-- guardians / player_guardians
-- ---------------------------------------------------------------------
alter table guardians enable row level security;

create policy "guardians visible to their own club staff and themselves"
  on guardians for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from player_guardians pg
      join players p on p.id = pg.player_id
      where pg.guardian_id = guardians.id
        and is_club_staff(p.club_id)
    )
  );

alter table player_guardians enable row level security;

create policy "player_guardians visibility"
  on player_guardians for select
  using (
    is_guardian_of(player_id)
    or is_own_player_record(player_id)
    or exists (
      select 1 from players p
      where p.id = player_guardians.player_id
        and is_club_staff(p.club_id)
    )
  );

-- ---------------------------------------------------------------------
-- team_players / memberships
-- ---------------------------------------------------------------------
alter table team_players enable row level security;

create policy "team_players visibility"
  on team_players for select
  using (
    exists (
      select 1 from teams t
      where t.id = team_players.team_id
        and (is_club_staff(t.club_id) or is_assigned_to_team(t.id))
    )
    or is_guardian_of(player_id)
    or is_own_player_record(player_id)
  );

alter table memberships enable row level security;

create policy "memberships visibility"
  on memberships for select
  using (
    is_club_staff(club_id)
    or is_guardian_of(player_id)
    or is_own_player_record(player_id)
  );

alter table membership_export_requests enable row level security;

create policy "membership export requests visibility"
  on membership_export_requests for select
  using (
    is_club_staff(club_id)
    or is_guardian_of(player_id)
  );

create policy "guardians and club staff can request exports"
  on membership_export_requests for insert
  with check (
    is_club_staff(club_id)
    or is_guardian_of(player_id)
  );

-- ---------------------------------------------------------------------
-- training_sessions / attendance
-- ---------------------------------------------------------------------
alter table training_sessions enable row level security;

create policy "training sessions visibility"
  on training_sessions for select
  using (
    is_club_staff(club_id)
    or is_assigned_to_team(team_id)
    or exists (
      select 1 from team_players tp
      where tp.team_id = training_sessions.team_id
        and (is_guardian_of(tp.player_id) or is_own_player_record(tp.player_id))
    )
  );

create policy "assigned staff can manage training sessions"
  on training_sessions for insert
  with check (is_club_staff(club_id) or is_assigned_to_team(team_id));

create policy "assigned staff can update training sessions"
  on training_sessions for update
  using (is_club_staff(club_id) or is_assigned_to_team(team_id))
  with check (is_club_staff(club_id) or is_assigned_to_team(team_id));

alter table attendance enable row level security;

-- This is the exact three-way policy from the design doc.
create policy "club manager attendance visibility"
  on attendance for select
  using (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (
          is_club_staff(ts.club_id)
          or is_assigned_to_team(ts.team_id)
          or is_guardian_of(attendance.player_id)
          or is_own_player_record(attendance.player_id)
        )
    )
  );

create policy "assigned staff can record attendance"
  on attendance for insert
  with check (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (is_club_staff(ts.club_id) or is_assigned_to_team(ts.team_id))
    )
  );

create policy "assigned staff can update attendance"
  on attendance for update
  using (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (is_club_staff(ts.club_id) or is_assigned_to_team(ts.team_id))
    )
  );

-- ---------------------------------------------------------------------
-- fee_charges / payments
-- ---------------------------------------------------------------------
alter table fee_charges enable row level security;

create policy "fee charges visibility"
  on fee_charges for select
  using (
    is_club_staff(club_id)
    or is_guardian_of(player_id)
    or is_own_player_record(player_id)
  );

create policy "club admin/staff can manage fee charges"
  on fee_charges for insert
  with check (is_club_staff(club_id));

create policy "club admin/staff can update fee charges"
  on fee_charges for update
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

alter table payments enable row level security;

create policy "payments visibility"
  on payments for select
  using (
    exists (
      select 1 from fee_charges fc
      where fc.id = payments.fee_charge_id
        and (
          is_club_staff(fc.club_id)
          or is_guardian_of(fc.player_id)
          or is_own_player_record(fc.player_id)
        )
    )
  );

-- ---------------------------------------------------------------------
-- trips / trip_transportation / trip_passengers
-- ---------------------------------------------------------------------
alter table trips enable row level security;

create policy "trips visibility"
  on trips for select
  using (is_club_staff(club_id));

alter table trip_transportation enable row level security;

create policy "trip transportation visibility"
  on trip_transportation for select
  using (
    exists (
      select 1 from trips t
      where t.id = trip_transportation.trip_id and is_club_staff(t.club_id)
    )
  );

alter table trip_passengers enable row level security;

create policy "trip passengers visibility"
  on trip_passengers for select
  using (
    exists (
      select 1 from trips t
      where t.id = trip_passengers.trip_id
        and (is_club_staff(t.club_id) or is_guardian_of(trip_passengers.player_id))
    )
    or is_own_player_record(player_id)
  );

-- ---------------------------------------------------------------------
-- announcements / announcement_reads
-- ---------------------------------------------------------------------
alter table announcements enable row level security;

create policy "announcements visibility"
  on announcements for select
  using (
    is_club_staff(club_id)
    or exists (
      select 1 from team_players tp
      where tp.team_id = announcements.team_id
        and (is_guardian_of(tp.player_id) or is_own_player_record(tp.player_id))
    )
    or team_id is null -- club-wide announcements: any tenant member linked to the club can see them via broader app logic
  );

create policy "club staff can create announcements"
  on announcements for insert
  with check (is_club_staff(club_id));

alter table announcement_reads enable row level security;

create policy "users can view and record their own reads"
  on announcement_reads for select
  using (user_id = auth.uid());

create policy "users can mark their own reads"
  on announcement_reads for insert
  with check (user_id = auth.uid());
