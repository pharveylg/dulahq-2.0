# Club Manager — Design & Implementation

**Status: LIVE.** As of migrations `20260820032053`–`20260820032148`,
this is implemented and applied to the real shared Supabase project
("Dula HQ", `zytyakbgwaegvftblkcn`) — not a design sketch.

## This document supersedes an earlier version — and was itself corrected 2026-08-27

An earlier version of this doc assumed a `tenant → club → team → player`
hierarchy with `tenants`/`tenant_users` tables and `auth.uid()`-based RLS,
and was rewritten around a claim that **none of that exists in the real
database**. That claim was wrong. A direct query of the live project on
2026-08-27 found:

- `organizations`, `org_members`, and `platform_admins` **do exist**, live
  since `initial_dulahq_schema` (2026-07-12) — a full month before Club
  Manager's own migrations (2026-08-20). The tenant model wasn't absent;
  it just wasn't checked for correctly before this doc's first rewrite.
- No `sports` or `tenants`/`tenant_users` tables — that part of the
  original claim holds.
- `teams` and `players` exist but hold **0 rows**. `dula-hq`'s live app
  (`index.html`) never writes to them — confirmed by grepping every
  `sb.from(...)` call in that file, which only ever targets
  `platform_admins`, `org_members`, `organizations`, and `tournaments`.
  Real tournament data (categories/teams/players/matches) lives as one
  JSONB blob per row in `tournaments.data`. So while `teams`/`players`
  are real, populated-schema tables in principle, they are not where the
  live product's data actually is.
- `public.users.id` still has no relationship to `auth.users.id` —
  identity for Club Manager is resolved by matching
  `auth.jwt() ->> 'email'` against `public.users.email`, via
  `current_user_role()` and `current_user_team_ids()`. This is a
  **second, separate identity/role mechanism from `org_members`** (which
  matches email against `organizations` membership instead) — the two
  don't share a role or scope concept. `public.users.role='admin'` is
  global, not org-scoped.
- `user_assigned_teams` is the existing, authoritative user↔team
  assignment mechanism (unaffected by any of the above).

**Consequence:** Club Manager's tables reference real, populated
`public.users`, but reference `teams`/`players` tables the live product
doesn't use — and, until 2026-08-27, had no link at all to the
`organizations` tenant model that Tournament Manager actually runs on.
See "Tenant fencing fix" below and `architecture-overview.md`'s
"Integration decision" for how this is being resolved.

## Architectural principle

**Club Manager extends the existing Dula HQ schema. It does not
introduce a parallel one.** Concretely:

- No new `teams` or `players` tables — Club Manager tables reference the
  existing ones directly (though see the caveat above: those tables are
  schema-real but currently unused by the live product).
- **Club Manager now carries its own tenant link** (`clubs.org_id`, added
  2026-08-27) rather than a new organization concept — see "Tenant
  fencing fix" below.
- No new user-identity mechanism for Club Manager's own concerns — every
  Club Manager identity check goes through the same email-matching
  pattern the existing app already uses (`current_dula_user_id()`,
  `current_user_role()`).
- No new team-assignment mechanism — coach/team_manager scoping reuses
  `user_assigned_teams` via the existing `current_user_team_ids()`.

## Tenant fencing fix (2026-08-27)

Club Manager's `clubs` table was applied on 2026-08-20 with **no**
`org_id` and RLS that let any authenticated user read every club
platform-wide (`clubs readable by authenticated` using
`auth.role() = 'authenticated'`) — a real tenant-isolation gap once
`organizations` is the actual tenant boundary for the rest of the
product. Fixed directly on the live project via migration
`club_manager_tenant_fencing`:

```sql
alter table public.clubs add column org_id uuid
  references public.organizations(id) on delete cascade;
alter table public.clubs alter column org_id set not null;
create index if not exists clubs_org_idx on public.clubs(org_id);

create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.org_members m
    where m.org_id = org
      and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  ) or public.is_platform_admin();
$$;
```

RLS on `clubs` is now: platform admin (`is_platform_admin()`) can do
anything; an org admin (`is_org_admin(org_id)`) can insert a club for
their own org; reads are scoped to org members (`is_org_member(org_id)`)
or existing club staff (`is_club_staff(id)`). The `club_staff`/
`guardians`/`player_guardians` write-bypass policies, which previously
checked the global `current_user_role() = 'admin'` column (not org-aware
— any future `public.users` row with `role='admin'` would have bypassed
every tenant's club data), were switched to `is_platform_admin()` for
consistency. Zero data risk: all four tables had 0 rows at the time.

This was scoped deliberately narrow — it does not touch `teams`,
`players`, `tournaments`, `organizations`, `org_members`, or
`platform_admins`, and doesn't change how Tournament Manager
(`index.html`) reads or writes anything.

## Schema (as applied)

```sql
-- New identity helper, reused by every Club Manager RLS function below.
-- Mirrors the EXISTING current_user_role()/current_user_team_ids()
-- pattern exactly -- resolves via email, not auth.uid().
current_dula_user_id() returns uuid
  -- select id from public.users where email = auth.jwt() ->> 'email'

-- clubs: org_id added 2026-08-27 (see "Tenant fencing fix" above) --
-- organizations is the real tenant system this scopes to.
clubs
  id, name, branding (jsonb), settings (jsonb),
  org_id (-> organizations.id, not null),
  created_at, updated_at, created_by

-- club_staff: club-scoped roles. user_id -> public.users(id), matching
-- the existing identity convention (these are existing Dula HQ people).
club_staff
  id, club_id, user_id, role ('club_admin'|'staff'|'coach'|'team_manager'),
  created_at, updated_at, created_by

-- teams.club_id: ADDITIVE column on the EXISTING teams table.
-- Nullable, ON DELETE SET NULL -- a team with no club stays fully valid
-- for Tournament Manager. This is the ONLY schema change to an existing
-- table.
alter table teams add column club_id uuid references clubs(id) on delete set null;

-- guardians: user_id nullable, -> public.users(id) (same convention).
-- Nullable because a guardian may not have an account yet.
guardians
  id, user_id, name, contact_info (jsonb),
  account_status ('no_account'|'invited'|'active'), invited_at,
  created_at, updated_at, created_by

-- player_guardians: links to the EXISTING players table.
player_guardians
  id, player_id (-> existing players.id), guardian_id,
  relationship, is_primary_contact, payment_responsible,
  created_at, updated_at, created_by

-- memberships / membership_export_requests: player_id -> existing players.
memberships
  id, club_id, player_id, period_start, period_end,
  status ('pending'|'active'|'expired'|'transferred'),
  created_at, updated_at, created_by

membership_export_requests
  id, club_id, player_id, requested_by, status,
  export_file_id (-> R2, once shared/files is wired to a real table),
  created_at, updated_at, created_by

-- training_sessions: team_id -> EXISTING teams.id (canonical relationship).
-- club_id is kept as a denormalized field for authorization convenience
-- only -- never the source of truth for which team a session belongs to.
training_sessions
  id, club_id, team_id, coach_id, venue_id, starts_at, ends_at, notes,
  status ('scheduled'|'cancelled'|'completed'),
  created_at, updated_at, created_by

attendance
  id, training_session_id, player_id (-> existing players.id),
  status ('present'|'absent'|'excused'|'late'|'no_response'),
  created_at, updated_at, created_by
  unique(training_session_id, player_id)

-- fee_charges / payments: 'tournament' excluded from fee_type --
-- tournament fees stay a Tournament Manager concern.
fee_charges
  id, club_id, player_id, guardian_id,
  fee_type ('registration'|'membership'|'training'|'uniform'|'equipment'
            |'transportation'|'accommodation'|'other'),
  amount, currency, due_date, status ('pending'|'paid'|'overdue'|'refunded'),
  created_at, updated_at, created_by

payments
  id, fee_charge_id, amount, method, paid_at,
  created_at, updated_at, created_by

-- trips / trip_transportation / trip_passengers
trips
  id, club_id, name, purpose ('training'|'tournament'|'camp'|'match'|'other'),
  starts_at, ends_at, created_at, updated_at, created_by

trip_transportation
  id, trip_id, vehicle_info (jsonb), driver_id, pickup_point, dropoff_point,
  created_at, updated_at, created_by

trip_passengers
  id, trip_id, player_id (-> existing players.id), seat,
  created_at, updated_at, created_by
  unique(trip_id, player_id)

-- announcements / announcement_reads: team_id -> EXISTING teams.id
announcements
  id, club_id, title, body,
  audience ('club'|'team'|'players'|'guardians'|'coaches'|'staff'
            |'tournament_participants'|'trip_participants'),
  team_id, pinned, expires_at, created_at, updated_at, created_by

announcement_reads
  id, announcement_id, user_id, read_at
  unique(announcement_id, user_id)
```

Full SQL: `supabase/migrations/20260820032053_club_manager_foundation.sql`,
`20260820032120_club_manager_core.sql`, `20260820032148_club_manager_rls.sql`
— these are mirrors of exactly what was applied to the live project via
the Supabase MCP `apply_migration` tool, not aspirational files waiting
to be pushed.

## Row-Level Security (as applied)

Four helper functions, all following the existing email-matching
convention:

```sql
current_dula_user_id()          -- public.users.id for the current session, via email
is_club_staff(club_id)          -- any club_staff role at this club
is_club_admin(club_id)          -- specifically club_admin at this club
is_assigned_to_team(team_id)    -- REUSES existing current_user_team_ids()
is_guardian_of(player_id)       -- via player_guardians + guardians.user_id
```

`is_assigned_to_team()` deliberately does not introduce a new assignment
table — it's a one-line wrapper around the existing
`current_user_team_ids()`, which itself queries the existing
`user_assigned_teams`. Coach/team_manager scoping is enforced entirely
through infrastructure that already existed before Club Manager.

Every table gets RLS enabled with policies following this general shape,
composing the same three levels used throughout:

```sql
using (
  is_club_staff(club_id)              -- club-wide staff
  or is_assigned_to_team(team_id)     -- team-scoped staff, via existing table
  or is_guardian_of(player_id)        -- guardian of the specific player
)
```

Plus an `admin`-role bypass on management tables (`clubs`, `club_staff`,
`guardians`, `player_guardians`), consistent with the existing app's
`current_user_role() = 'admin'` pattern used throughout the pre-existing
policies on `teams`, `players`, `matches`, etc.

## Verification performed

Direct RLS verification was run against the live project inside a
transaction that was rolled back afterward (no data persisted), using
`SET LOCAL ROLE authenticated` + `SET LOCAL request.jwt.claims` to
simulate real user sessions. Results:

| Check | Result |
|---|---|
| Coach assigned (via existing `user_assigned_teams`) to Team A1 can see Team A1's training session | ✅ pass |
| Same coach cannot see Team A2's session, same club | ✅ pass |
| Club B admin cannot see Club A's training sessions | ✅ pass |
| Club B admin cannot update Club A's `clubs` row | ✅ pass |
| Guardian sees their own linked player's fee charge | ✅ pass |
| Guardian cannot see a different player's fee charge, same club | ✅ pass |

One additional check (guardian can still read the pre-existing `teams`
table) returned a false negative purely because the manual JWT simulation
didn't set a `role` claim that `auth.role()` checks for — real
Supabase-issued tokens always include it automatically via `supabase-js`
sign-in. Confirmed by inspecting `auth.role()`'s definition directly; not
a policy defect.

## Testing strategy going forward

`npm run test:rls` (via `tests/rls/club-manager-isolation.test.ts`)
exercises the same checks through the real `supabase-js` client rather
than manual SQL simulation, and additionally verifies:

- Every test user needs BOTH an `auth.users` row (`admin.createUser`)
  AND a matching `public.users` row (manual insert) — there's no sync
  trigger between them in this schema.
- Existing Tournament Manager functionality (`teams`, `players` still
  readable by any authenticated user) isn't broken by the new policies.

**Docker Desktop was found to be non-functional in this environment**,
so a local `supabase start` instance isn't currently viable for running
this suite. Two alternatives:

1. **Supabase branching** — `supabase branches create` (or the MCP
   `create_branch` tool) spins up an isolated copy of the real schema
   with all migrations applied, safe to test destructively against.
   **This has a small hourly cost** (~$0.0134/hr at time of writing) —
   confirm pricing before creating one, given the free-tier-only
   constraint established earlier for this project.
2. **Direct manual SQL verification** (what was actually done above) —
   free, but requires hand-simulating JWT claims and doesn't exercise
   the real `supabase-js` auth flow. Good for spot-checks, not a
   substitute for the real test suite.

## Open items

- `membership_export_requests.export_file_id` has no FK constraint yet —
  `shared/files` (R2) doesn't have a corresponding metadata table in
  Postgres to reference. Add one when Files moves from "helper script"
  to "actual feature."
- No RLS test currently exercises `team_manager` specifically (only
  `coach` was tested) — same policy logic applies to both roles via
  `is_assigned_to_team()`, but worth an explicit test case before
  relying on it.
- Player-owns-account access (a player logging in and seeing their own
  profile) was deliberately deferred — the existing `players` table has
  no `user_id` column, and altering it wasn't justified by the current
  required RLS test cases. Add this as its own migration when actually
  needed, not speculatively.
