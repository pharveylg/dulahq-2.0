# Dula HQ 2.0 — Architecture Overview

> **⚠️ Second correction (2026-08-27), superseding the note below:** a
> direct query of the live project found `organizations`/`org_members`/
> `platform_admins` **do exist** and predate Club Manager by over a
> month (`initial_dulahq_schema`, 2026-07-12, vs Club Manager's
> migrations on 2026-08-20). The claim below — "no tenant tables at all"
> — was wrong when written, not just later invalidated.
>
> What's actually true: `dula-hq`'s live app (`index.html`) uses exactly
> that org/tenant model — every `sb.from(...)` call in it targets
> `platform_admins`, `org_members`, `organizations`, or `tournaments`,
> never `teams`/`players`/`matches`/`referees` directly. Those relational
> tables exist in the schema (and are what Club Manager was built
> against) but hold 0 rows — the live app stores all tournament data as
> one JSONB blob per row in `tournaments.data`. Club Manager's `clubs`
> table had no tenant scoping at all until a 2026-08-27 fix
> (`club_manager_tenant_fencing`) added `org_id` and fenced its RLS.
>
> The product-boundary/Platform-Services sections below are still a
> reasonable planning reference. For current, verified schema state, see
> `club-manager-design.md` and the "Second correction" note in
> `../README.md`.

## 1. Product structure

```
Dula HQ 2.0
│
├── Tournament Management
│   ├── Core
│   └── Sports
│       ├── Football
│       ├── Tennis
│       ├── Pickleball
│       ├── Volleyball
│       ├── Futsal
│       └── Basketball
│
├── Club Management
│   ├── Core
│   └── Sports
│       ├── Football
│       └── ... (added as demand requires)
│
└── Dula HQ Platform Services
    ├── Identity
    ├── Tenancy
    ├── Organizations
    ├── Subscriptions
    ├── Entitlements
    ├── Permissions
    ├── Billing
    ├── Notifications
    ├── Messaging
    ├── Media
    └── Files
```

Tournament Management and Club Management are **separate products**, not
one product with two feature areas. Each has its own `core/` (sport-agnostic
logic) and `sports/` (sport-specific modules). They share infrastructure
through Platform Services, and integrate with each other through defined
interfaces rather than direct code dependencies.

## 2. Tournament Management

**Core concern:** organizing and operating competitions.

Core capabilities: tournament creation, competition configuration,
registration, team participation, divisions/categories, scheduling,
fixtures, venues, match officials, results, standings, brackets, match
statistics, tournament announcements, tournament media, tournament
logistics.

Tournament Management should not contain club-specific business logic
(training, family billing, guardians, etc.) — that belongs to Club
Management.

### Sport modules

Each sport extends the tournament core rather than duplicating it. A sport
module owns its own rules and data — match structure, scoring, statistics
— while relying on core for tournaments, fixtures, venues, officials,
results, and standings.

Examples of what a sport module owns:

- **Football:** match duration, halves, extra time, penalties, goals,
  cards, substitutions, player positions, squad size, competition formats.
- **Basketball:** quarters, overtime, points, fouls, player statistics,
  possession rules.
- **Volleyball:** sets, points, set scoring, rotations, match format.
- **Tennis / Pickleball / Futsal:** analogous sport-specific scoring and
  format rules (see the Sport Engine design from the original Dula HQ
  spec for the interface pattern — it applies here too).

## 3. Club Management

**Core concern:** managing people, teams, activities, finances, logistics,
communication, and media over the life of a club.

Club Management should not depend on Tournament Management being installed
or active — a club can run entirely on Club Management with no
tournaments at all — but the two should be able to integrate.

### Core capabilities

- **Club** — profile, branding, administrators, staff, coaches, teams,
  facilities, venues, settings.
- **Membership** — periods, registration, status, history, documents.
- **Players** — profiles, team assignments, registration, status, history,
  documents, attendance, competition participation.
- **Guardians** — parent/guardian accounts, player relationships, contact
  info, emergency contacts, payment responsibility, communication
  preferences.
- **Teams** — profiles, age groups, rosters, coaches, managers, schedules,
  team communications.
- **Training** — sessions (date/time/venue/coach/team), attendance
  (present/absent/excused/late/no response), notes, cancellation,
  rescheduling, notifications. Training is an independent activity, not
  tied to competitions.
- **Finance** — recurring and event-specific fees (registration,
  membership, training, tournament, uniform, equipment, transportation,
  accommodation), charges, invoices, payments, receipts, outstanding
  balances, discounts, refunds, **family-level billing** (multiple players
  sharing one consolidated financial relationship), financial reports.
- **Logistics** — reusable across training, tournaments, matches, camps,
  trips: transportation, vehicles, drivers, pickup/drop-off points,
  passenger lists, seat allocation, accommodation, equipment, travel
  schedules, emergency information.
- **Announcements** — structured communication to configurable audiences
  (club/team/players/parents/coaches/staff/tournament or trip
  participants), with rich text, images, attachments, scheduling,
  pinning, expiration, read tracking, push notifications.
- **Messaging** — native to the platform, not dependent on external tools
  like Facebook Messenger. Understands platform relationships: a player
  moving from U13 to U15 updates their channel memberships automatically;
  tournament participants get added to tournament channels automatically;
  a trip spins up a temporary travel group automatically. External
  channels (WhatsApp, SMS, email) can be added later as delivery channels,
  not replacements for the native system.
- **Media** — first-class capability. Media can belong to a club, team,
  player, training session, match, tournament, trip, or event. Supports
  albums, player tagging, captions, permissions, download controls, event
  galleries.

### Multi-sport clubs

A club is not assumed to be single-sport. One club can run Football,
Basketball, and Volleyball teams simultaneously, each under its own
age-group structure. `club-manager/core` stays sport-agnostic; sport
specifics live under `club-manager/sports/<sport>`.

## 4. Dula HQ Platform Services

Shared infrastructure used by both products. Extracted only where the
concept is genuinely common — avoid growing this layer just to avoid
duplication.

| Service | Responsibility |
|---|---|
| Identity | User accounts, authentication |
| Tenancy | Tenant isolation, tenant lifecycle |
| Organizations | Org/league entities within a tenant |
| Subscriptions | Recurring plan state per tenant |
| Entitlements | What a tenant's plan actually unlocks |
| Permissions | Role-based access control |
| Billing | Payment processing, invoicing |
| Notifications | Email/SMS/push delivery |
| Messaging | Native chat/comms infrastructure |
| Media | Photo/video storage, albums, tagging |
| Files | Document storage (waivers, medical forms, etc.) |

Note: **Identity** and **Tenancy** already exist and are live — but as
two separate, non-integrated mechanisms. Tenancy is `organizations`/
`org_members`/`platform_admins` (email-matched against
`auth.jwt() ->> 'email'`), used by `dula-hq`'s multi-tenant login and by
`tournaments.org_id`. Identity for Club Manager is the older
`public.users`/`auth.users` email-matching pattern
(`current_user_role()`, `current_dula_user_id()`), which predates the org
system and has no `org_id` of its own. The two aren't unified — a
`public.users.role='admin'` row isn't scoped to any organization. Club
Manager's `clubs` table now carries `org_id` directly (see
`club-manager-design.md`) as the bridge until/unless the two identity
paths are consolidated. The rest of Platform Services
(Subscriptions/Entitlements/Billing/Notifications/Messaging/Media/Files)
is not built yet.

### Hosting & storage decision

- **Database + Auth: Supabase** (free tier), unchanged — RLS-based tenant
  isolation is the security model everything else depends on, and
  Cloudflare's native database (D1, SQLite) doesn't support Postgres-style
  row-level security. Moving off Supabase would mean rebuilding tenant
  isolation in application code — a materially riskier model, not
  attempted here.
- **Files + Media storage: Cloudflare R2** (free tier — 10GB, no egress
  fees), replacing Supabase Storage. See `shared/files/README.md` for the
  rationale and usage. This swap doesn't touch the database/RLS at all,
  since object storage is independent of Postgres.
- **Hosting: Cloudflare Pages** (free tier), replacing Vercel for the
  frontend. Next.js is supported via the `@cloudflare/next-on-pages`
  adapter.

This keeps the whole platform on free tiers across both providers while
preserving the RLS-based security model already built. The `dula-hq`
repo's hosting (currently Vercel) migrating to Cloudflare Pages is a
separate, not-yet-done follow-up — this decision applies going forward
for `dula-hq-2.0`.

## 5. Integration principles

Club Management and Tournament Management communicate through defined
interfaces, never through direct internal imports or database access
across product boundaries.

**Avoid:**
```
club-manager
    imports
tournament-manager.internal.database
```

**Prefer:**
```
Club Manager → Integration/API Layer → Tournament Manager
```

This lets either product evolve independently — Tournament Manager can
change its internal schema without breaking Club Manager, and vice versa.

**Formally adopted 2026-08-27** as the resolution to the `teams`/`players`
mismatch described in the correction note at the top of this doc: Club
Manager keeps its own relational schema rather than being pointed at
Tournament Manager's unused `teams`/`players` tables or forcing
Tournament Manager's live JSONB-blob sync engine to populate them.
Integration is a not-yet-built, explicit sync step (a club's roster
becoming a tournament registration, and results/participation flowing
back), going through this Integration/API layer — never a direct FK or
shared table between the two schemas.

## 6. Entity ownership

| Entity | Primary owner |
|---|---|
| Club | Club Manager |
| Club membership | Club Manager |
| Player | Shared / Club Manager |
| Guardian | Shared / Club Manager |
| Team | Shared platform |
| Tournament | Tournament Manager |
| Competition | Tournament Manager |
| Fixture | Tournament Manager |
| Training session | Club Manager |
| Attendance | Club Manager |
| Club fee | Club Manager |
| Tournament fee | Tournament Manager (decided — see `club-manager-design.md`, Resolved decisions) |
| Transportation | Club Manager |
| Tournament logistics | Tournament Manager / Club Manager |
| Chat | Shared platform |
| Media | Shared platform |
| Notifications | Shared platform |

Ownership is explicit specifically to prevent circular dependencies
between the two products — if it's unclear which product owns a piece of
data, that's a design gap to resolve before building it, not something to
leave implicit.

## 7. Cross-module workflow example

1. **Club creates a team** (Club Manager): `Bukidnon FC → U15 → Players / Coach / Guardians`
2. **Team registers for a tournament** — Tournament Manager receives the registration.
3. **Tournament schedule generated** — Tournament Manager creates fixtures.
4. **Club receives the schedule** — Club Manager surfaces relevant fixtures on team calendars, parent/player/coach dashboards.
5. **Club manages logistics** — transportation, accommodation, availability, fees, parent comms — all Club Manager.
6. **Tournament occurs** — Tournament Manager handles matches, results, standings, stats.
7. **Club preserves history** — Club Manager retains participation records, team history, photos, results, comms.

## 8. Recommended build sequence

1. **Shared Platform** — Identity, Tenancy, Organizations, Permissions, Notifications, Media, Messaging, Files (already partly underway in `dula-hq`).
2. **Tournament Manager core** — sport-agnostic competition engine (already underway in `dula-hq`).
3. **Tournament sports** — Football first, then Tennis, Pickleball, Volleyball, Futsal, Basketball (see `sport-priority.md`).
4. **Club Manager core** — clubs, teams, players, guardians, training, attendance, finance, logistics, announcements, media, messaging.
5. **Club sports** — Football first.
6. **Cross-module integration** — club teams ↔ tournament registrations, players ↔ rosters, fixtures ↔ club calendars, results ↔ club history, tournament media ↔ club media, tournament comms ↔ club comms.

This is a design-then-build sequence, not a mandate to build all of it now
— per current scope, steps 1–3 are active work (in `dula-hq`), and 4–6 are
architecture-only until Club Manager moves into implementation.
