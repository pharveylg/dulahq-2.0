# Club Manager — Design Document

**Status: design only. Nothing in this document is implemented yet.**

This describes what Club Manager's data model and module boundaries
should look like when it moves into implementation. It follows the same
conventions established in the `dula-hq` Tournament Manager build
(tenant-scoped tables, RLS via `is_tenant_member()`, Supabase Auth) so the
two integrate cleanly later.

## Design principles carried over from Tournament Manager

- Every table gets `id`, `tenant_id`, `created_at`, `updated_at`, `created_by`.
- RLS enabled on every table, gated through the same `is_tenant_member(tenant_id)`
  pattern already in `dula-hq`'s migrations — no new isolation mechanism.
- Roles stored as data (`role_permissions`-style), not hardcoded branches.
- Club Manager's `core/` stays sport-agnostic. Sport-specific fields (e.g.
  football player positions) live in sport module tables that extend core
  entities, not as columns bolted onto the core tables.

## Core entities (schema sketch)

```sql
-- A club is scoped to a tenant, same as an organization in Tournament Manager.
clubs
  id, tenant_id, name, branding (jsonb), settings (jsonb),
  created_at, updated_at, created_by

-- Club-level roles: administrators, staff, coaches — reuses tenant_users'
-- role concept but scoped to a specific club within the tenant.
club_staff
  id, tenant_id, club_id, user_id, role
    ('club_admin' | 'staff' | 'coach' | 'team_manager'),
  created_at, updated_at, created_by

-- Coaches and Team Managers only see "assigned teams" per the role table
-- below -- club_admin/staff are club-wide and don't need rows here.
-- Absence of a row for a coach/team_manager means "assigned to nothing
-- yet," not "assigned to everything."
staff_team_assignments
  id, tenant_id, club_staff_id, team_id,
  created_at, updated_at, created_by

-- Player is a core identity, shared conceptually with Tournament Manager's
-- roster concept, but OWNED here per the entity ownership table.
-- user_id is nullable: young players may have no login at all (managed
-- entirely by guardians/coaches); older players who want their own
-- account (see Player role below) get one linked here.
players
  id, tenant_id, club_id, user_id (nullable), name, date_of_birth, status
    ('active' | 'inactive' | 'suspended'),
  created_at, updated_at, created_by

-- Guardians are separate people, linked to one or more players.
-- account_status tracks guardians who don't have a login yet, so the
-- product can nudge them toward signing up over time (see "Resolved
-- decisions" below) without requiring an account up front.
guardians
  id, tenant_id, user_id (nullable -- guardian may not have a login),
  name, contact_info (jsonb),
  account_status ('no_account' | 'invited' | 'active'),
  invited_at (nullable),
  created_at, updated_at, created_by

player_guardians
  id, tenant_id, player_id, guardian_id,
  relationship ('parent' | 'legal_guardian' | 'other'),
  is_primary_contact boolean,
  payment_responsible boolean,
  created_at, updated_at, created_by

-- Teams live at the shared-platform level per the ownership table, but
-- club-manager creates and manages them.
teams
  id, tenant_id, club_id, name, age_group, sport_id (fk -> sports),
  created_at, updated_at, created_by

team_players
  id, tenant_id, team_id, player_id, joined_at, left_at (nullable),
  created_at, updated_at, created_by

-- Membership periods are distinct from team assignment -- a player can
-- have an active club membership while between teams.
--
-- On transfer to another club: the player's history (attendance, stats,
-- media, past memberships) stays owned by THIS club_id -- it does not
-- move with the player (see "Resolved decisions" below). A closed
-- membership row (period_end set) is the permanent record of that
-- history's ownership.
memberships
  id, tenant_id, club_id, player_id,
  period_start, period_end, status ('active' | 'expired' | 'pending' | 'transferred'),
  created_at, updated_at, created_by

-- Lets a guardian/departing club request a portable copy of a player's
-- history without transferring ownership of the underlying records.
-- The export itself (a generated file) is a Files/Media platform-service
-- concern, not stored here -- this table just tracks the request/grant.
membership_export_requests
  id, tenant_id, club_id, player_id, requested_by (guardian or club_staff user_id),
  status ('pending' | 'ready' | 'delivered' | 'denied'),
  export_file_id (nullable, fk -> shared/files),
  created_at, updated_at, created_by

-- Training is independent of competitions.
training_sessions
  id, tenant_id, club_id, team_id, coach_id,
  venue_id, starts_at, ends_at, notes,
  status ('scheduled' | 'cancelled' | 'completed'),
  created_at, updated_at, created_by

attendance
  id, tenant_id, training_session_id, player_id,
  status ('present' | 'absent' | 'excused' | 'late' | 'no_response'),
  created_at, updated_at, created_by

-- Finance: family-level billing means a charge can be attached to a
-- guardian (who may pay for multiple players) rather than only a player.
-- NOTE: 'tournament' is deliberately NOT a fee_type here -- tournament
-- entry fees are billed by Tournament Manager, not Club Manager (see
-- "Resolved decisions" below). Club Manager's fee_charges only ever
-- covers club-side charges.
fee_charges
  id, tenant_id, club_id, player_id, guardian_id (nullable),
  fee_type ('registration' | 'membership' | 'training'
            | 'uniform' | 'equipment' | 'transportation'
            | 'accommodation' | 'other'),
  amount, currency, due_date, status ('pending' | 'paid' | 'overdue' | 'refunded'),
  created_at, updated_at, created_by

payments
  id, tenant_id, fee_charge_id, amount, method, paid_at,
  created_at, updated_at, created_by

-- Logistics reused across training, tournaments, matches, camps, trips --
-- deliberately not owned by any single event type.
trips
  id, tenant_id, club_id, name, purpose
    ('training' | 'tournament' | 'camp' | 'match' | 'other'),
  starts_at, ends_at, created_at, updated_at, created_by

trip_transportation
  id, tenant_id, trip_id, vehicle_info (jsonb), driver_id,
  pickup_point, dropoff_point, created_at, updated_at, created_by

trip_passengers
  id, tenant_id, trip_id, player_id, seat, created_at, updated_at, created_by

-- Announcements
announcements
  id, tenant_id, club_id, title, body, audience
    ('club' | 'team' | 'players' | 'guardians' | 'coaches' | 'staff'
     | 'tournament_participants' | 'trip_participants'),
  team_id (nullable, when audience = 'team'),
  pinned boolean, expires_at (nullable),
  created_at, updated_at, created_by

announcement_reads
  id, tenant_id, announcement_id, user_id, read_at
```

## Row-Level Security design

Club Manager introduces a scoping level `dula-hq`'s Tournament Manager
didn't need yet: access isn't just "is this your tenant," it's "is this
your club" and, for Coach/Team Manager, "is this your assigned team."
Three helper functions, layered on top of the existing
`is_tenant_member()`:

```sql
-- A user has SOME role at this specific club (any of the 4 club_staff roles).
create or replace function is_club_staff(check_club_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from club_staff
    where club_id = check_club_id and user_id = auth.uid()
  );
$$;

-- Narrower: is this user a coach/team_manager specifically assigned to
-- this team? (club_admin/staff bypass this check entirely via a separate
-- OR clause in the policy, since they're club-wide.)
create or replace function is_assigned_to_team(check_team_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from staff_team_assignments sta
    join club_staff cs on cs.id = sta.club_staff_id
    where sta.team_id = check_team_id and cs.user_id = auth.uid()
  );
$$;

-- A guardian's own linked players (used by nearly every guardian-facing
-- policy: attendance, fee_charges, announcements, etc.)
create or replace function is_guardian_of(check_player_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from player_guardians pg
    join guardians g on g.id = pg.guardian_id
    where pg.player_id = check_player_id and g.user_id = auth.uid()
  );
$$;
```

Example policy shape for `attendance` (illustrates how the roles compose —
club_admin/staff see everything at the club, coach/team_manager see only
their assigned team's sessions, guardians see only their own player's
rows, this is not exhaustive SQL, just the pattern):

```sql
create policy "club manager attendance visibility"
  on attendance for select
  using (
    exists (
      select 1 from training_sessions ts
      where ts.id = attendance.training_session_id
        and (
          is_club_staff(ts.club_id)                    -- admin/staff: club-wide
          or is_assigned_to_team(ts.team_id)            -- coach/team_manager: assigned only
          or is_guardian_of(attendance.player_id)       -- guardian: own player only
        )
    )
  );
```

Every other guardian/player/coach-facing table (`fee_charges`,
`announcements`, `trip_passengers`, `memberships`) follows this same
three-way composition — club-wide staff OR assigned-team staff OR
own-player guardian/player. Worth writing this as a reusable policy
template once implementation starts, rather than hand-rolling it per
table.

## Role permission seed rows

Mirrors the pattern already used in `dula-hq`'s `0003_role_permissions.sql`
— these get inserted as data once Club Manager ships, not hardcoded:

```sql
insert into role_permissions (role, resource, action) values
  ('club_admin', 'club', 'update'),
  ('club_admin', 'finance', 'view'),
  ('club_admin', 'finance', 'update'),
  ('club_admin', 'logistics', 'update'),
  ('club_admin', 'announcements', 'create'),
  ('team_manager', 'training_sessions', 'create'),
  ('team_manager', 'attendance', 'update'),
  ('team_manager', 'logistics', 'update'),
  ('coach', 'training_sessions', 'update'),
  ('coach', 'attendance', 'update'),
  ('coach', 'players', 'view'),
  ('guardian', 'fee_charges', 'view'),
  ('guardian', 'attendance', 'view'),
  ('player', 'players', 'view');
```

`has_permission()` (already defined in `dula-hq`) works unchanged for
these — Club Manager doesn't need its own permission-check function, only
its own rows in the same table.

## Messaging & Media integration (consumption contract)

The actual `messages`/`channels`/`albums` tables belong to Platform
Services (`shared/messaging`, `shared/media`) and shouldn't be designed
in isolation here — but Club Manager's *consumption contract* with them
can be, since that shapes what Platform Services needs to expose:

- **Teams** get a default channel automatically on creation (`teams.id` →
  a channel scoped to that team's roster + assigned coaches).
- **Training sessions / trips** can spin up a *temporary* channel scoped
  to that event's participants — expires or archives when the event ends.
- **Announcements** are not the same thing as channel messages — an
  announcement is one-way broadcast with read tracking
  (`announcement_reads`), a channel is two-way conversation. Don't merge
  these into one concept even though they'll likely share the
  Notifications delivery pipeline.
- **Media albums** attach to a club, team, training session, or trip via
  a polymorphic-ish reference (`owner_type` + `owner_id`) rather than a
  separate join table per entity type — this is a Platform Services
  design decision, flagged here because Club Manager is the first real
  consumer and its variety of album owners (club/team/session/trip) is
  what determines whether `shared/media` needs that flexible reference
  from day one or can start narrower.

This section is a contract Club Manager needs Platform Services to honor
— it is not a substitute for designing `shared/messaging` and
`shared/media` themselves when that work starts.

## Sport module extension pattern (example: Football)

Sport-specific tables live under `club-manager/sports/<sport>/` and
reference core tables by id — they never get columns added to core:

```sql
-- club-manager/sports/football
football_player_profiles
  id, tenant_id, player_id (fk -> players),
  preferred_position ('GK' | 'DF' | 'MF' | 'FW'),
  jersey_number,
  created_at, updated_at, created_by
```

Basketball, Volleyball, etc. each get their own equivalent table under
their own `sports/<sport>/` folder when built — none of them touch
`players` directly. This is the same core/sport separation principle as
Tournament Manager's Sport Engine, applied to Club Manager's simpler
(non-live-scoring) needs.

## Lifecycle states

- **`memberships.status`**: `pending` → `active` → (`expired` on natural
  end date, or `transferred` when the player moves to another club — see
  Resolved Decision #3). `transferred` is terminal for that row; a new
  `pending`/`active` row is created at the destination club.
- **`fee_charges.status`**: `pending` → `paid` (via a `payments` row) or
  `overdue` (due_date passed with no payment) → `refunded` (exceptional
  path, reverses a `paid` charge). A charge never moves backward from
  `paid`/`refunded`.
- **`guardians.account_status`**: `no_account` → `invited` (nudge sent) →
  `active` (they've logged in at least once). Can stay at `no_account`
  or `invited` indefinitely — neither blocks any guardian functionality
  per Resolved Decision #2.

## Role-based access (Club Manager side)

| Role | Access |
|---|---|
| Club Administrator | Club, teams, players, finance, logistics, comms, media, tournament registrations |
| Team Manager | Assigned teams, players, training, attendance, events, logistics, comms |
| Coach | Assigned teams, training, attendance, player info, fixtures, team comms |
| Parent/Guardian | Linked players only, training, matches, tournaments, fees, transportation, announcements, photos, team chat |
| Player | Own profile, team schedule, training, matches, announcements, media, permitted comms |

This maps onto the same `role_permissions` pattern already used in
`dula-hq` — these five roles get added as additional rows once Club
Manager is implemented, rather than requiring a new permissions mechanism.
The RLS design and seed rows above are the concrete implementation of
this table.

## Multi-sport clubs

`teams.sport_id` ties a team to a sport, but `players`, `guardians`,
`memberships`, `training_sessions`, and `attendance` are all sport-agnostic
by design — a player on a Football team and a player on a Basketball team
at the same club use the identical core tables. Sport-specific data (e.g.
football positions) belongs in `club-manager/sports/football/` tables that
reference `players.id`, not in the core `players` table itself.

## Integration points with Tournament Manager (future work)

Per the architecture overview's integration principle, none of these are
direct table joins across products — they're API-layer contracts to
design when both sides exist:

- A club team registering for a tournament (`teams` → Tournament Manager's
  registration flow)
- Tournament fixtures surfacing on a club's team calendar
- Tournament results feeding into a club's player/team history
- Tournament media becoming part of a club's media library

## Resolved decisions

1. **Tournament fee billing model — Tournament Manager, separate from
   Club Manager.** Tournament entry fees are billed and collected by
   Tournament Manager directly, independent of a team's club affiliation.
   This means:
   - `fee_charges.fee_type` excludes `'tournament'` entirely — Club
     Manager never carries a tournament line item.
   - A standalone (non-club) team registering for a tournament works
     identically to a club team, since Tournament Manager's billing
     doesn't depend on Club Manager existing at all.
   - Trade-off accepted: parents may receive bills from two separate
     systems (club fees vs. tournament fees). Consider a future
     Platform Services-level "combined invoice view" if this becomes a
     UX complaint, but don't build it speculatively now.

2. **Guardians without logins — allowed short-term, with a prompt to
   sign up later.** `guardians.account_status` tracks this
   (`no_account` → `invited` → `active`). A guardian can be added with
   just contact info (e.g. by a coach entering an emergency contact),
   and the product should periodically nudge `no_account` /
   `invited` guardians toward creating a login — the exact nudge
   mechanism (email cadence, in-app prompt to the primary contact) is an
   implementation detail for later, not a schema concern.

3. **Cross-club player movement — history stays with the old club,
   exportable on request.** When a player transfers, their attendance,
   stats, and media remain owned by the club that generated them (the
   `club_id` on those records doesn't change retroactively). The player
   gets a fresh `memberships` row at the new club. A departing
   guardian/club can request a portable export via
   `membership_export_requests` rather than the data moving or being
   duplicated live. This keeps entity ownership unambiguous (no record
   ever needs to answer to two clubs) at the cost of the new club
   starting the player's record with no history — acceptable since the
   export path covers the legitimate need for continuity.

## Definition of done (before implementation starts)

This design is complete enough to build from once:

- [x] Core entities and relationships sketched
- [x] RLS pattern extended beyond tenant-only to club/team/guardian scoping
- [x] Role permissions defined for all 5 Club Manager roles
- [x] Finance, logistics, training, announcements all covered
- [x] Cross-club transfer, guardian accounts, tournament billing resolved
- [x] Sport-module extension pattern established (Football example)
- [x] Messaging/Media consumption contract specified (pending Platform
      Services build)
- [ ] Actual Supabase migrations written (translate this doc to SQL files,
      following `dula-hq`'s numbering convention)
- [ ] RLS isolation test suite extended to cover club/team/guardian
      scoping, not just tenant scoping (extend the pattern from
      `tests/rls/tenant-isolation.test.ts`)
- [ ] `shared/files` and `shared/media` exist enough to back
      `membership_export_requests` and album attachments for real

The first two unchecked items are the actual next step when Club Manager
moves from design into implementation.
