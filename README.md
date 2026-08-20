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

The **Tournament Manager is already built** — that work lives in the
separate `dula-hq` repo (Next.js + Supabase, Phase 1 foundation: RLS,
multi-tenancy, auth, dashboard shell). This repo does **not** duplicate
that code.

This repo (`dula-hq-2.0`) exists to:

1. Hold the **architecture and design docs** for the full platform,
   including Club Management, which is being designed now but not built yet.
2. Establish the **target folder structure** (`tournament-manager/`,
   `club-manager/`, `shared/`) that the platform grows into over time.
3. House sport modules — Tournament Manager's and Club Manager's — as they
   get built, starting with Football.

As Club Management moves from design into implementation, and as the
existing `dula-hq` Tournament Manager code gets restructured to match this
layout, the two repos are expected to converge. That migration is a
separate, deliberate step — not done automatically by creating this repo.

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
  detailed Club Management design: entities, schema sketch, roles. This
  is a **design document, not yet implemented**.

## Status

| Component | Status |
|---|---|
| Tournament Manager (core + multi-tenant foundation) | Built — see `dula-hq` repo |
| Tournament Manager — Football module | Not started (currently Tennis-first in `dula-hq`; see sport-priority.md for the re-prioritization) |
| Club Manager | Architecture designed, not built |
| Shared Platform Services | Identity/Tenancy exist in `dula-hq` (as `tenants`/`tenant_users`); the rest are not built |
