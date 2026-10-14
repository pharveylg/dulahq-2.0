# Known gaps

The single place for gaps that have been identified and are still open.
Replaces two separate gap-analysis documents (`club-entitlement-gap-analysis.md`,
written 2026-09-09, and `platform-club-tournament-gap-analysis.md`, written
2026-09-11) — both are gone as of 2026-10-13. Nearly everything either ever
found was resolved; see `CLAUDE.md` §0j, §0k, §0l, §0m, §0n, §0o and §0q for
what was built and how each was verified live. The platform/club/tournament
document had nothing left open by the time it was retired and is not
represented here at all. The handful of items below are what survived from
the club-entitlement document, re-verified 2026-10-12/13 rather than assumed.
If either original document's full text is ever needed, it's in git history
before this file replaced them.

**Rule for this file going forward: it holds only unaddressed gaps.** When
something below gets built, remove it rather than marking it done — the
"how it was fixed" record belongs in `CLAUDE.md`, not here. New gaps found
elsewhere in the app (platform, tournament, or otherwise) belong in this one
file too, not a new per-area document.

---

- **Financial action auditing is confirmed missing, not just unverified.**
  `fees-actions.ts`'s `addFeeCharge`, `recordPayment`, and
  `updateFeeChargeStatus` contain **zero** `write_audit` calls. Money changes
  hands and the only record is the `fee_charges`/`payments` rows themselves —
  no `audit_log` entry for who charged or recorded what. Same fix shape as
  the staff-action audit gap already fixed (CLAUDE.md §0j, P0-3/4): add
  `write_audit()` calls at the three existing call sites.

- **`team_staff` is a dead table, still not dropped.** `(id, team_id, name,
  role, role_other, phone, org_id)` — no `user_id`, so it can't represent an
  account-holding person or participate in RLS/permissions. Zero rows
  referenced in any live migration beyond its own creation, and
  `grep -rln team_staff src/` turns up nothing except coincidental matches on
  the unrelated `assign_team_staff` permission key. Drop it; nothing targets
  it.

- **No club-wide people directory.** `club_staff_directory()` (built to fix
  the "Unknown" staff-name bug, CLAUDE.md §0j) covers staff only. There is
  still no single view combining staff, players, and guardians for a club
  manager — players are only ever browsed per-team, and there is no
  club-wide "search all players" or "list all guardians."

- **No org chart visualization.** The underlying data (role + team
  assignment + primary-coach designation, post-phase6x) is complete enough
  that this is a read-only rendering problem, not a modeling one — build it
  as a pure view over `club_staff` + `user_assigned_teams`, the same
  "derived, never a second dataset" pattern already used for roster state
  (`roster-state.ts`, CLAUDE.md §0f). Explicitly exclude players/guardians —
  this is a staff org chart, a different question from "who's enrolled."

- **`announcement_reads` schema exists, still unused.** No read-receipt
  feature was ever wired to it — zero application-code references beyond
  generated types. Cheap win whenever it's wanted (the table already
  exists); not blocking anything.

- **Missing report types: staff, membership status, org activity,
  role/status.** `Reports.tsx` has exactly three sections (club-wide tiles,
  per-team attendance/development, financial summary). None of these
  additional report types exist. Low urgency; nothing depends on them.

- **No club-level policy/agreement document storage.** `document_uploads`
  remains entirely player-centric (`player_id`/`player_name` are core to the
  row shape). A club-wide policy document, code of conduct, or similar
  organizational file still has nowhere to live. True defer — no real demand
  signal yet — but genuinely unaddressed if it ever comes up.
