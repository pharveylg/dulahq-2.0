# Club entitlement — gap analysis (2026-09-09)

Originally 25 numbered recommendations (P0/P1/P2/defer) checked directly
against the live schema, permission catalog, and application code. **All of
P0 (1–6) and P1 (7–13) are now resolved** — see CLAUDE.md §0j, §0k and §0l
for what was built and how each was verified live. Per the standing rule for
this file (re-verified 2026-10-12, not assumed from old status notes): it
keeps **only what's still open**, so the list below is what remains, not a
history of everything ever found. For the resolved items' own detail, read
CLAUDE.md — this file no longer reproduces it.

Two resolved-via-different-means items worth noting since they don't map
1:1 onto what was originally proposed: **#13** (IT administration being
club-scoped, unreachable for a Tournament-only org) was closed by building
`tournament_it_admin` as its own separate, tournament-scoped role (CLAUDE.md
§0l) rather than widening `club_it_admin` to be org-scoped as this document
originally suggested. **#17** (coach/staff qualifications storage) was
closed by `staff_profiles`' own `certifications` field (§0k, P1-7) rather
than the polymorphic `document_uploads.subject_type` extension this
document proposed.

---

## Still open

- **Financial action auditing is confirmed missing, not just unverified.**
  The original analysis flagged this as "unclear, verify before Tournament"
  (old P2 #20) and said it should be promoted to P0 if verification found it
  actually missing. Verified now (2026-10-12): `fees-actions.ts`'s
  `addFeeCharge`, `recordPayment`, and `updateFeeChargeStatus` contain **zero**
  `write_audit` calls. Money changes hands and the only record is the
  `fee_charges`/`payments` rows themselves — no `audit_log` entry for who
  charged or recorded what. Same fix shape as the staff-action audit gap
  this document originally flagged (now fixed, §0j P0-3/4): add
  `write_audit()` calls at the three existing call sites.

- **`team_staff` is a dead table, still not dropped.** `(id, team_id, name,
  role, role_other, phone, org_id)` — no `user_id`, so it can't represent an
  account-holding person or participate in RLS/permissions. Confirmed again
  (2026-10-12): zero rows referenced in any live migration beyond its own
  creation, and `grep -rln team_staff src/` turns up nothing except
  coincidental matches on the unrelated `assign_team_staff` permission key.
  Drop it; nothing targets it.

- **No club-wide people directory.** `club_staff_directory()` (built to fix
  the "Unknown" staff-name bug, §0j) covers staff only. There is still no
  single view combining staff, players, and guardians for a club manager —
  players are only ever browsed per-team, and there is no club-wide "search
  all players" or "list all guardians."

- **No org chart visualization.** The underlying data (role + team
  assignment + primary-coach designation, post-phase6x) is complete enough
  that this is a read-only rendering problem, not a modeling one — build it
  as a pure view over `club_staff` + `user_assigned_teams`, the same
  "derived, never a second dataset" pattern already used for roster state
  (`roster-state.ts`, CLAUDE.md §0f). Explicitly exclude players/guardians —
  this is a staff org chart, a different question from "who's enrolled."

- **`announcement_reads` schema exists, still unused.** No read-receipt
  feature was ever wired to it — confirmed again, zero application-code
  references beyond generated types. Cheap win whenever it's wanted (the
  table already exists); not blocking anything.

- **Missing report types: staff, membership status, org activity,
  role/status.** `Reports.tsx` still has exactly three sections (club-wide
  tiles, per-team attendance/development, financial summary) — confirmed by
  reading the file directly. None of these additional report types exist.
  Low urgency; nothing depends on them.

- **No club-level policy/agreement document storage.** `document_uploads`
  remains entirely player-centric (`player_id`/`player_name` are core to the
  row shape). A club-wide policy document, code of conduct, or similar
  organizational file still has nowhere to live. True defer — no real demand
  signal yet — but genuinely unaddressed if it ever comes up.
