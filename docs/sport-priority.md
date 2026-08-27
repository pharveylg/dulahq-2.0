# Sport Priority

> **Note:** this document's priority ordering is unaffected by the
> tenant-model correction (see `club-manager-design.md`) — it's still the
> plan for which sport gets built first. **There is no `sports` table in
> the live Dula HQ schema** — verified directly via
> `information_schema.tables` on 2026-08-27 (zero tables match `%sport%`).
> Sport identity currently lives implicitly inside `tournaments.data`
> JSON, not as a lookup table. The paragraph further below claiming the
> `sports` table "currently has exactly what `dula-hq` originally
> created: Tennis, Pickleball, Basketball, Football" is **wrong** and
> contradicts this note — disregard it; it's a leftover from an earlier,
> unverified draft. This doc remains the planning reference for build
> order; it just isn't backed by any live `sports` table.

## Priority order

1. **Football** — primary. First sport module built for both Tournament
   Manager and Club Manager.
2. **Tennis**
3. **Pickleball**
4. **Volleyball**
5. **Futsal**
6. **Basketball** — lowest priority, built last.

This supersedes the earlier priority order (Tennis ⭐⭐⭐⭐⭐ / Pickleball
⭐⭐⭐⭐⭐ / Basketball ⭐⭐⭐⭐) from the original Dula HQ spec. Nothing is
dropped — Tennis and Pickleball remain in scope — but Football now leads,
and Basketball moves from mid-priority to last.

**This is a planning priority, not a schema change.** There is no
`sports` table in the shared Supabase project at all (see correction note
at the top of this doc) — sport identity isn't tracked as a lookup table
today for any sport, including Football. Volleyball and Futsal (or any
other sport) get their own schema representation added when work on them
actually starts, not speculatively ahead of that.

## What this changes in practice

The `dula-hq` repo's existing Sport Engine spike (see the design doc from
that project) was scaffolded Tennis-first, since Tennis was originally the
top priority. With Football now primary, that spike's assumptions should
be re-validated against Football specifically before real Football
implementation work starts — the same "don't commit to sport-specific code
before validating the interface" principle applies, just pointed at a
different first sport now.

Football introduces scoring/state shapes not present in Tennis or
Pickleball (continuous match clock, no discrete "point" as the base unit,
extra time, penalty shootouts) — closer to Basketball's clock-driven model
than to Tennis's point-cascade model. This is worth treating as a second,
short validation spike rather than assuming the original Tennis-based
sketch transfers cleanly.

## Club Manager sports

Per the platform's development strategy, Club Manager sport modules start
with **Football** as well (Layer 5), independent of Tournament Manager's
own sport build-out — a club running Football teams doesn't need to wait
for Tournament Manager's Football module to be finished, since Club
Manager "should not depend on the Tournament Manager being installed or
active" (see `architecture-overview.md`, Section 5).
