-- Club Manager: Row Level Security
--
-- APPLIED to the shared Dula HQ Supabase project (zytyakbgwaegvftblkcn)
-- as migration version 20260820032148. Mirror of what was actually run
-- -- see the note at the top of 20260820032053_club_manager_foundation.sql.
--
-- Follows the existing schema's identity convention exactly:
-- auth.jwt() ->> 'email' matched against public.users.email (via
-- current_dula_user_id(), defined in club_manager_foundation) -- never
-- auth.uid(). Team-level scoping reuses the EXISTING
-- current_user_team_ids() function/user_assigned_teams table rather
-- than introducing a parallel assignment mechanism, per the
-- integration strategy (Section 15).

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function is_club_staff(check_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from club_staff
    where club_id = check_club_id
      and user_id = current_dula_user_id()
  );
$$;

create or replace function is_club_admin(check_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from club_staff
    where club_id = check_club_id
      and user_id = current_dula_user_id()
      and role = 'club_admin'
  );
$$;

-- Reuses the EXISTING user_assigned_teams-backed mechanism directly,
-- rather than a new Club-Manager-only assignment table.
create or replace function is_assigned_to_team(check_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select check_team_id in (select current_user_team_ids());
$$;

create or replace function is_guardian_of(check_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from player_guardians pg
    join guardians g on g.id = pg.guardian_id
    where pg.player_id = check_player_id
      and g.user_id = current_dula_user_id()
  );
$$;

-- ---------------------------------------------------------------------
-- clubs
-- ---------------------------------------------------------------------
alter table clubs enable row level security;

create policy "clubs readable by authenticated"
  on clubs for select
  using (auth.role() = 'authenticated');

create policy "club_admin can update their club"
  on clubs for update
  using (is_club_admin(id))
  with check (is_club_admin(id));

create policy "admin can manage clubs"
  on clubs for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- club_staff
-- ---------------------------------------------------------------------
alter table club_staff enable row level security;

create policy "club_staff visible to club staff"
  on club_staff for select
  using (is_club_staff(club_id));

create policy "club_admin manages club_staff"
  on club_staff for all
  using (is_club_admin(club_id))
  with check (is_club_admin(club_id));

create policy "admin can manage club_staff"
  on club_staff for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- guardians / player_guardians
-- ---------------------------------------------------------------------
alter table guardians enable row level security;

create policy "guardians visible to self and relevant club staff"
  on guardians for select
  using (
    user_id = current_dula_user_id()
    or exists (
      select 1 from player_guardians pg
      join players p on p.id = pg.player_id
      join teams t on t.id = p.team_id
      where pg.guardian_id = guardians.id
        and t.club_id is not null
        and is_club_staff(t.club_id)
    )
  );

create policy "admin can manage guardians"
  on guardians for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

alter table player_guardians enable row level security;

create policy "player_guardians visibility"
  on player_guardians for select
  using (
    is_guardian_of(player_id)
    or exists (
      select 1 from players p
      join teams t on t.id = p.team_id
      where p.id = player_guardians.player_id
        and t.club_id is not null
        and is_club_staff(t.club_id)
    )
  );

create policy "admin can manage player_guardians"
  on player_guardians for all
  using (current_user_role() = 'admin')
  with check (current_user_role() = 'admin');

-- ---------------------------------------------------------------------
-- memberships / membership_export_requests
-- ---------------------------------------------------------------------
alter table memberships enable row level security;

create policy "memberships visibility"
  on memberships for select
  using (is_club_staff(club_id) or is_guardian_of(player_id));

create policy "club staff manage memberships"
  on memberships for all
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

alter table membership_export_requests enable row level security;

create policy "membership export requests visibility"
  on membership_export_requests for select
  using (is_club_staff(club_id) or is_guardian_of(player_id));

create policy "guardians and club staff can request exports"
  on membership_export_requests for insert
  with check (is_club_staff(club_id) or is_guardian_of(player_id));

-- ---------------------------------------------------------------------
-- training_sessions / attendance
-- Three-way scoping: club-wide staff OR assigned-team staff (via the
-- EXISTING user_assigned_teams) OR the player's own guardian.
-- ---------------------------------------------------------------------
alter table training_sessions enable row level security;

create policy "training sessions visibility"
  on training_sessions for select
  using (
    is_club_staff(club_id)
    or is_assigned_to_team(team_id)
    or exists (
      select 1 from players p
      where p.team_id = training_sessions.team_id
        and is_guardian_of(p.id)
    )
  );

create policy "assigned staff manage training sessions"
  on training_sessions for all
  using (is_club_staff(club_id) or is_assigned_to_team(team_id))
  with check (is_club_staff(club_id) or is_assigned_to_team(team_id));

alter table attendance enable row level security;

create policy "attendance visibility"
  on attendance for select
  using (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (
          is_club_staff(ts.club_id)
          or is_assigned_to_team(ts.team_id)
          or is_guardian_of(attendance.player_id)
        )
    )
  );

create policy "assigned staff record attendance"
  on attendance for insert
  with check (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (is_club_staff(ts.club_id) or is_assigned_to_team(ts.team_id))
    )
  );

create policy "assigned staff update attendance"
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
  using (is_club_staff(club_id) or is_guardian_of(player_id));

create policy "club staff manage fee charges"
  on fee_charges for all
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

alter table payments enable row level security;

create policy "payments visibility"
  on payments for select
  using (
    exists (
      select 1 from fee_charges fc
      where fc.id = payments.fee_charge_id
        and (is_club_staff(fc.club_id) or is_guardian_of(fc.player_id))
    )
  );

-- ---------------------------------------------------------------------
-- trips / trip_transportation / trip_passengers
-- ---------------------------------------------------------------------
alter table trips enable row level security;

create policy "trips visibility"
  on trips for select
  using (is_club_staff(club_id));

create policy "club staff manage trips"
  on trips for all
  using (is_club_staff(club_id))
  with check (is_club_staff(club_id));

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
  );

-- ---------------------------------------------------------------------
-- announcements / announcement_reads
-- ---------------------------------------------------------------------
alter table announcements enable row level security;

create policy "announcements visibility"
  on announcements for select
  using (
    is_club_staff(club_id)
    or (
      team_id is not null and exists (
        select 1 from players p
        where p.team_id = announcements.team_id and is_guardian_of(p.id)
      )
    )
    or (team_id is not null and is_assigned_to_team(team_id))
  );

create policy "club staff create announcements"
  on announcements for insert
  with check (is_club_staff(club_id));

alter table announcement_reads enable row level security;

create policy "users view their own reads"
  on announcement_reads for select
  using (user_id = current_dula_user_id());

create policy "users mark their own reads"
  on announcement_reads for insert
  with check (user_id = current_dula_user_id());
