# Dula HQ 2.0

Dula HQ 2.0 is the platform-level umbrella spanning two products that share
common infrastructure:

```
Dula HQ 2.0
│
├── Tournament Management     — running competitions
├── Club Management           — running clubs day-to-day
└── Dula HQ Platform Services — shared infrastructure both products use
```

## How this repo relates to the existing `dula-hq` repo

**Second correction (2026-08-27), superseding the "single-tenant" claim
below:** a direct query of the live Supabase project
(`zytyakbgwaegvftblkcn`) found `organizations`/`org_members`/
`platform_admins` **do exist** and predate Club Manager — they were part
of the `initial_dulahq_schema` migration (2026-07-12), a month before
Club Manager's migrations (2026-08-20). The "no tenant tables at all"
claim below was wrong when it was written, not just later invalidated.

The real, verified picture as of 2026-08-27:
- `organizations` / `org_members` / `platform_admins` are live and are
  what the `dula-hq` repo's `index.html` actually uses for multi-tenancy
  — confirmed by grepping every `sb.from(...)` call in that file: it only
  ever touches `platform_admins`, `org_members`, `organizations`, and
  `tournaments`.
- **`teams`, `players`, `matches`, `referees` exist in the schema but hold
  0 rows.** The live app doesn't write to them — every tournament's
  categories/teams/players/matches live as one JSONB blob per row in
  `tournaments.data`. Club Manager was built against tables the product
  doesn't actually populate.
- Club Manager's `clubs` table had no tenant scoping at all (no `org_id`,
  and RLS let any authenticated user read every club platform-wide) —
  this has been fixed directly on the live project
  (migration `club_manager_tenant_fencing`, 2026-08-27): `clubs.org_id`
  is now `NOT NULL` with a FK to `organizations`, and read/write policies
  are fenced to org membership.
- **Integration decision:** rather than pointing Club Manager at the
  empty `teams`/`players` tables or rewriting the live JSONB-blob sync
  engine to populate them, Club Manager keeps its own relational schema
  and integrates with Tournament Manager through an explicit sync step
  (club roster → tournament registration, built later, not yet
  implemented) — matching the "integrate through interfaces, not shared
  tables" principle already stated in `docs/architecture-overview.md`.

**What this means concretely:**
- Whatever serves that live database in production is not necessarily
  the `dula-hq` GitHub repo built earlier — that relationship is unverified.
- Club Manager's migrations are **already applied to the live project**
  (see "Status" below) — this isn't a pending-deploy design anymore, but
  its data model was drifting from what Tournament Manager actually uses
  until the 2026-08-27 tenant-fencing fix above.

## Repository structure

```
dula-hq-2.0/
├── docs/                          — architecture & design docs (read these first)
├── tournament-manager/
│   ├── core/                      — sport-agnostic competition engine
│   └── sports/
│       ├── football/              — primary
│       ├── tennis/
│       ├── pickleball/
│       ├── volleyball/
│       ├── futsal/
│       └── basketball/            — lowest priority
├── club-manager/
│   ├── core/                      — clubs, players, guardians, training, finance, etc.
│   └── sports/
│       └── football/              — first club sport module (per dev strategy, Layer 5)
└── shared/                        — Dula HQ Platform Services
    ├── identity/
    ├── tenancy/
    ├── organizations/
    ├── subscriptions/
    ├── entitlements/
    ├── permissions/
    ├── billing/
    ├── notifications/
    ├── messaging/
    ├── media/
    └── files/
```

## Where to start reading

- [`docs/architecture-overview.md`](docs/architecture-overview.md) —
  the full platform architecture: product boundaries, integration
  principles, entity ownership.
- [`docs/sport-priority.md`](docs/sport-priority.md) — which sports get
  built in which order, and why.
- [`docs/club-manager-design.md`](docs/club-manager-design.md) — the
  detailed Club Management design: entities, schema, roles, RLS —
  **now implemented as real migrations, see below.**

## Migration status: already applied

Club Manager's migrations (`club_manager_foundation`, `club_manager_core`,
`club_manager_rls`) are **live on the real, shared Supabase project**
("Dula HQ", ref `zytyakbgwaegvftblkcn`) — applied directly via the
Supabase MCP `apply_migration` tool, not `supabase db push` from this
repo. The files in `supabase/migrations/` are named with the exact
version timestamps the live project recorded
(`20260820032053_club_manager_foundation.sql`, etc.) so they mirror
production history for reference and future `supabase db push` calls
from this repo, rather than being pending work waiting to be deployed.

**What was verified before and after applying:**
- `teams`/`players`/`users`/`matches`/`tournaments`/`referees` schemas
  and data were inspected first — nothing was recreated or altered
  destructively. The only change to an existing table is the additive,
  nullable `teams.club_id` column.
- Identity resolution (`public.users.email` matched to `auth.jwt()`, not
  `auth.uid()`) was confirmed against the live `current_user_role()`/
  `current_user_team_ids()` functions before any RLS was written.
- RLS was verified directly against production inside a rolled-back
  transaction (no data persisted) — see `docs/club-manager-design.md`'s
  "Verification performed" section for the full results.

## Running the app

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# from the Supabase dashboard for project zytyakbgwaegvftblkcn ("Dula HQ")
npm run dev
```

This build was verified with `npx next build` (production build, full
type-check) before being handed over — it compiles cleanly. Sign in with
an existing Dula HQ account (this app doesn't create new ones — see
`docs/club-manager-design.md` for why).

**What's built so far (as of 2026-08-27): club setup, staff management,
player/guardian registration.**
- `/clubs` — list clubs (org-scoped via `clubs.org_id`, added 2026-08-27
  — see "Tenant fencing fix" in `docs/club-manager-design.md`); an org
  admin or platform admin sees a "New club" button; platform admins also
  see demo-data load/wipe controls
- `/clubs/new` — create a club, picking which organization it belongs to
- `/clubs/[clubId]` — rename the club, link existing (unclaimed) teams to
  it, add/remove staff by email lookup, and for coach/team_manager roles,
  assign/unassign them to specific linked teams (via the existing
  `user_assigned_teams` table)
- `/clubs/[clubId]/teams/[teamId]` — a linked team's roster: add/remove
  players, add/remove guardians per player (any `club_staff` role, not
  just `club_admin` — required a follow-up RLS migration,
  `club_manager_player_guardian_write_access`, since the original
  players/guardians/player_guardians policies only allowed the platform
  admin or Tournament Manager's own separate team-role mechanism to
  write)

**Not built yet:** training/attendance, fees, trips, announcements,
media, messaging. Unlike players/guardians, `training_sessions`/
`fee_charges`/`trips`/`announcements` already have club-staff-scoped
write RLS from the original Club Manager migration — no schema
prerequisite blocks building their UI next.

## Running the RLS test suite

**Docker Desktop was found to be non-functional in this environment**,
so a local `supabase start` instance isn't currently a viable way to run
`tests/rls/club-manager-isolation.test.ts`. Two options:

1. **Supabase branching** (recommended for real test runs) — creates an
   isolated copy of the live schema safe to test destructively against.
   Has a small hourly cost (~$0.0134/hr at time of writing) — given the
   free-tier-only constraint established for this project, confirm
   pricing (`get_cost` via the Supabase MCP tools, or the dashboard)
   before creating one rather than assuming it's free.
2. **Manual SQL verification against production** — free, and what was
   actually done to verify this build (see `club-manager-design.md`).
   Wrap test data in `BEGIN ... ROLLBACK` and simulate users via
   `SET LOCAL ROLE authenticated` + `SET LOCAL request.jwt.claims`. Good
   for spot-checks; doesn't exercise the real `supabase-js` auth flow the
   way the actual test suite does.

```bash
npm install
# then either point .env.local at a branch, or adapt the manual-SQL
# approach above for a quick check
npm run test:rls
```

## Status

| Component | Status |
|---|---|
| Tournament Manager (`dula-hq` `index.html`) — real usage is `platform_admins`/`org_members`/`organizations`/`tournaments`, with per-tournament data as JSONB in `tournaments.data` | Live in production — pre-existing, not built by this repo. `teams`/`players`/`matches`/`referees` tables exist but are unused (0 rows). |
| Club Manager — schema, RLS | **Live in production** — `supabase/migrations/20260820032053-20260820032148`, tenant-fenced by `club_manager_tenant_fencing` (2026-08-27) |
| Club Manager — application code (UI, API routes) | Club setup, staff management, player/guardian registration built. Training/attendance, fees, trips, announcements, media, messaging not started. |
| Shared Platform Services — Tenancy | **Exists**: `organizations`/`org_members`/`platform_admins`, live since 2026-07-12, used by `dula-hq`'s multi-tenant login/provisioning. Identity is the existing `public.users`/`auth.users` email-matching pattern (a second, separate identity path from org membership — see `docs/club-manager-design.md`). The rest of Platform Services (Subscriptions/Entitlements/Billing/Notifications/Messaging/Media/Files) is not built. |
| Club Manager ↔ Tournament Manager integration | Not built. Deliberately deferred — see "Integration decision" above. |
| Cloudflare R2 (Files) | Helper code (`shared/files/lib/r2.ts`) written; no metadata table in Postgres yet, no bucket confirmed created |
