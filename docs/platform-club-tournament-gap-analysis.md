# Platform / Club / Tournament gap analysis (2026-09-11)

**Fully resolved — nothing from this analysis remains open.** All five P0
items and all six P1 items are built and verified; see CLAUDE.md §0m, §0n,
§0o and §0q for what was built and how. Per the standing rule for this
file, re-verified 2026-10-12 rather than taken on an old status note's
word — specifically: the entitlement-lifecycle item (old P1-#6, trial/grace
period) was still marked "open, deliberately" as of the last status update
in this file, but is now built (`phase18c`/`phase18e` migrations,
`TrialStatusBanner.tsx`, `/organizations/new`); the tournament organizer
console's finance queue (old P1-#10) landed the same day as this file's own
last status note, just after it was written (CLAUDE.md §0q); and officiating
(old §3.5, "schema and RLS only") got a real Officials tab eleven days later
(§0y) — none of which the file's own history had caught up to.

One flagged cross-cutting risk was re-checked and did **not** materialize:
`billing_invoices.payer_type` reuses role-ish strings (`'club'`, `'team'`,
`'entrant'`, etc.) across contexts, the same shape that caused the real
`has_tournament_permission` scope-leak bug (§0l) — but grepping every
migration and call site confirms `payer_type` is stored and displayed only
(an invoice's payer label, never a function or policy's branching
condition). Nothing authorizes on it, so the bug class that risk was named
after doesn't apply here. Not treated as a gap.

This document is kept only because CLAUDE.md cites it by section number as
the historical origin of real work (§0m, §0n, §0o). The original analysis —
findings, evidence, and the full priority tables — is preserved in git
history (this repo, prior to the 2026-10-12 docs cleanup) if it's ever
needed; this file no longer reproduces it since there is nothing left for
it to track.
