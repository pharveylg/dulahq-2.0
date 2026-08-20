# Tournament Manager

Sport-agnostic competition engine (`core/`) plus per-sport modules
(`sports/`). See [`../docs/architecture-overview.md`](../docs/architecture-overview.md)
for the full design.

**Current status:** the actual implementation lives in the separate
`dula-hq` repo, not here — this folder exists so the target structure is
visible ahead of migrating that code in. See the root README's Status
table for what's built vs. designed.

Sport build order: Football (primary) → Tennis → Pickleball → Volleyball
→ Futsal → Basketball. See [`../docs/sport-priority.md`](../docs/sport-priority.md).
