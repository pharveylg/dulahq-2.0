# Sport Priority

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
