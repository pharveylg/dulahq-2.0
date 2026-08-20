# Dula HQ 2.0 — Architecture Overview

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

Note: in the `dula-hq` repo's existing Phase 1 build, **Identity** and
**Tenancy** already exist in early form (`auth.users`, `tenants`,
`tenant_users`). The rest of this list is not built yet.

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
