# Dula HQ — project context

Consolidating two live deployments under one brand ("Dula HQ"), on one origin,
with one login. Ground truth below was verified directly against the live
Vercel and Supabase projects on **2026-09-07**. Re-verify anything load-bearing
before acting on it — this file goes stale.

---

## 0. What changed on 2026-09-07 — read this first

**The database consolidation (phases 1–5) is applied and verified.** Nineteen
migrations — the original thirteen plus six same-day follow-up fixes (`phase2h`
through `phase2m`) — are live in `zytyakbgwaegvftblkcn` and committed under
`supabase/migrations/`; see §0a for what each one does. Most of §3's security list
is closed. §2's row counts are gone. Do not re-plan this work — extend it.

**All demo data was deliberately wiped.** Both orgs, both clubs, all teams,
players, guardians, evaluations, fees, trips and tournaments. The four `test-*`
accounts are deleted. A JSON backup of everything removed exists outside the repo.

What remains: the owner's profile, the 27-row `development_skills` framework, and
1.0's `backups` table (17 rows, untouched — it is still 1.0's live store).

**The tournament decision stands: proxy, do not port.** Phase 5 created the
tournament *schema* (roster, members, officials, the port functions) so it is
ready when wanted. It did **not** require rewriting the tournament UI, and §8's
rule still holds. The new tables become the tournament app's backend if and when
it is updated — not before.

---

## 0a. Migration file reference (2026-09-07)

**What §0a doesn't cover: the 10 migrations that predate it.** The
application-flow audit (§0-onward's own housekeeping, 2026-09-29) found that
`supabase/migrations/` starts with 10 files not narrated anywhere in this
document, despite being the live schema's actual foundation — everything
§0a onward builds on top of:

| File | What it does |
|---|---|
| `0001_foundation.sql` | Base schema copied from the sibling `dula-hq` repo: `tenants`, `organizations`, `sports`, `audit_logs`, shared `set_updated_at()` trigger. Predates the identity rework below entirely. |
| `0002_rls_policies.sql` | `is_tenant_member()` + first-generation RLS policies for the phase-1.0 schema above. |
| `0003_role_permissions.sql` | `role_permissions` table (role/resource/action rows) + `has_permission()` — the pre-catalog, coarse permission model later fully superseded by phase6a's catalog. |
| `0004_club_manager_core.sql` | Club Manager's original core tables (`clubs`, teams/players linkage); RLS deferred to the next file. |
| `0005_club_manager_rls.sql` | Three-way RLS scoping (club-wide staff OR assigned-team staff OR own-player guardian) — `is_club_staff()` and friends, the direct ancestor of every later `is_club_*` helper. |
| `0006_club_manager_role_permissions.sql` | Seed rows for Club Manager's 5 original roles. |
| `20260820032053_club_manager_foundation.sql` | Mirror of what was actually run live against `zytyakbgwaegvftblkcn` (identity via `auth.jwt()->>'email'`, not `auth.uid()` — predates phase1's identity rework by ~2.5 weeks). Committed after the fact so migration tooling treats it as already-applied history. |
| `20260820032120_club_manager_core.sql` | Mirror of the live core-entities migration; players resolved only via `players → teams → club_id` (no direct `players.club_id` column yet — that arrives in phase3). |
| `20260820032148_club_manager_rls.sql` | Mirror of the live RLS migration; team-level scoping via the pre-existing `current_user_team_ids()`. |
| `20260820034751_club_manager_team_linking_policy.sql` | Live bug-fix: lets `club_admin` link an *unclaimed* existing team to their club; refuses re-linking one that already belongs elsewhere. |

The schema these create is live and correct — this is a documentation gap,
not dead code. See `docs/LEGACY_CANDIDATES.md` for the full audit this came
from, including its screen/route inventory and orphaned-code findings (two
of which — `updateClubName`, `deleteSession` — were removed, and a third,
`approval_is_granted()`, was dropped in `phase16d` after confirming it was
superseded by `src/lib/roster-state.ts` the same day it was locked down in
`phase6s`).

All seventeen of today's migrations are committed under `supabase/migrations/`,
filenames matching the live project's migration history by version timestamp.
`phase2h` and `phase2i` were reconstructed from the live schema state when these
files were added to the repo (the batch of thirteen didn't originally include
them) — verified to match what's live, not necessarily byte-identical to whatever
was first run.

| File | What it does |
|---|---|
| `…002707_enable_rls_on_backups` | Closes the anon read/write hole on `backups` |
| `…043830_phase1_identity_on_auth_uid` | `public.users.id` **is** `auth.users.id`; signup + email-sync triggers; `current_dula_user_id()` returns `auth.uid()` |
| `…043919_phase2a_tenant_primitives` | `sports`, `org_entitlements`, `role_assignments`, a real append-only `audit_log`, `write_audit()` |
| `…044033_phase2b_org_id_on_owned_tables` | `org_id NOT NULL` on 37 tables + derivation triggers so existing inserts keep working |
| `…044103_phase2c_authorization_helpers` | Helpers rewritten uid-based and tenant-first, each honouring the legacy table it replaces |
| `…044134_phase2d_public_surface_and_new_table_rls` | `publicly_listed` on clubs, `sport_id` everywhere, `public_tournaments` / `public_clubs` views, RLS on the new primitives |
| `…044309_phase2e_policies_tenant_first` | Every policy rebuilt with the org fence carried **inside** it |
| `…044353_phase3_free_the_player` | `players.club_id`, `team_memberships`, `tournament_categories`, `tournament_entries`, `venues`, cascade downgrades, `requires_guardian_consent()` |
| `…044432_phase4_approvals_and_notifications` | `approval_requests`, `notifications`, derived fee status, expiry sweep |
| `…044509_phase5a_tournament_identity_and_officials` | `tournament_roster`, `tournament_members`, `org_officials`, `tournament_officials`, `match_events.player_id`, `player_tournament_results` |
| `…044558_phase5b_the_port_and_tournament_rls` | `port_squad_to_tournament()`, `port_match_results_home()`, tournament-side RLS |
| `…044730_phase2f_restore_public_directory_policies` | Bug fix — phase2e's drop-all rebuild had silently removed phase2d's anon directory policies |
| `…044810_phase2g_lock_down_helper_execution` | Revokes `EXECUTE` on every SECURITY DEFINER helper from `anon` — **regressed** since: as of the 2026-09-07 test-fix session, `get_advisors` shows 57 SECURITY DEFINER functions anon-executable again (0 ERROR-level advisories, only WARN — §2's "0 errors" still holds). Cause not identified; predates and is unrelated to `phase2j`/`phase2k` below |
| `…082946_phase2h_fix_club_staff_guardian_writes` | club_staff (any role, no `org_members` row) can create/read/link guardians for their own club — see §0b |
| `…083044_phase2i_club_staff_are_org_members` | `is_org_member` widened to include club staff, assigned coaches, guardians, and players themselves — see §0b |
| `…090000_phase2j_fix_can_read_club_org_collapse` | Bug fix — `can_read_club`'s `OR is_org_member(p_org)` fallback collapsed to org-wide read on every table using it, once combined with the outer `is_org_member(org_id) AND (...)` gate nearly every policy already has — see §0b |
| `…090100_phase2k_can_read_club_requires_club_admin` | Bug fix — `can_read_club`'s club-wide grant was on `is_club_staff` (any role, including coach/team_manager/staff); narrowed to `is_club_admin`, matching `getClubAccess()` in `src/lib/supabase/server.ts` — see §0b |
| `…100000_phase2l_public_views_select_only` | Revoked dormant INSERT/UPDATE/DELETE/TRUNCATE grants on `public_clubs`/`public_tournaments` from anon/authenticated — found while building §6.C, not exploitable (both are join views, Postgres already refuses direct writes) but tightened anyway |
| `…140000_phase2m_tournaments_id_text_to_uuid` | §6.G — `tournaments.id` and its 7 dependent `tournament_id` columns changed from `text` to `uuid`; see §6.G for the full verification |
| `…150000_phase2n_default_currency_php` | `fee_charges`/`expenses` default `currency` to `'PHP'` |
| `…20260908120000_phase6a_permission_foundation` | §0c — granular permission catalog (`permissions`, `role_permission_defaults`, `guardian_permission_defaults`, `staff_permission_grants`, `guardian_permission_grants`) and `has_staff_permission()`/`has_guardian_permission()`. Additive only — no existing RLS policy rewired yet; defaults seeded to reproduce current behavior exactly, verified live against real seeded users |

**Verified**, run as `anon` and as an org admin inside `BEGIN … ROLLBACK`, for the
first eleven migrations (phase1 through phase2g):

- An org admin with two orgs in the database sees only their own club, team and player.
- `is_org_admin()` is false for the other org, true for their own.
- `anon` sees the published tournament and not the unpublished draft.
- `anon` sees a listed club and not a private one.
- `anon` sees zero players, zero role assignments, zero audit rows, and is refused outright on `backups`.
- `port_squad_to_tournament()` with no consent recorded returned `consent_missing` for a 14-year-old and `ported` for an adult, from the same call.

**Verified** for phase2j/phase2k, via `tests/rls/club-manager-isolation.test.ts`
(21/21 passing) against the live project: a coach assigned to one team cannot read
another team's sessions in the same club; a guardian cannot read another player's
fee charge in the same club; the org-level cross-tenant fence below still holds.

---

## 0b. RLS test suite — resolved 2026-09-07

`npm run test:rls` is green: 21/21 passing. This was the only thing in flight;
everything else in this file was already settled.

The suite is `tests/rls/club-manager-isolation.test.ts` (now 18,412 bytes), run
with `npm run test:rls`. It points at the LIVE project (Supabase branching is
unavailable on free tier — see §1). Fixtures are prefixed `rls-test-` and cleaned
up in `afterAll`; a crash mid-run leaves them behind — four leftover orgs from
runs that predate the `hookTimeout` fix below were found and removed.

### What was already fixed today

- `vitest.config.ts` now parses `.env.local` by hand (Node `fs`, splitting on
  `/\r?\n/` for CRLF). It does NOT use vite's `loadEnv` — that lives in `vite`,
  not `vitest/config`, and importing it from the latter throws
  `loadEnv is not a function`.
- `createTestUser` no longer inserts a `public.users` row. The phase-1 trigger
  creates it with the same id as `auth.users`; a manual insert now violates the
  FK.
- `category_id` removed from team fixtures — nullable since phase 3, and now a
  real FK to `tournament_categories`, so a random uuid fails.
- `org_entitlements` rows are seeded for both test orgs. Without them the
  `clubs` write policy (`org_has_product(org_id,'club')`) refuses the insert.
- `clubs.slug` is supplied and suffixed. It is NOT NULL with no default since
  `add_club_and_team_slugs` (2026-09-03) and globally unique. This broke the
  suite on 3 Sep, before any of the consolidation work.
- Fixture inserts go through a `must()` helper that throws the real Postgres
  message. Previously they destructured `data` and dropped `error`, so a
  constraint violation surfaced as `Cannot read properties of null` several
  lines later — which cost about four debugging rounds.
- `afterAll` now also deletes `teamB1` (it was orphaned every run, since
  `teams.club_id` is ON DELETE SET NULL) and tolerates a `beforeAll` that threw
  partway.
- `vitest.config.ts` sets `hookTimeout: 30000`. `beforeAll` makes ~15 sequential
  round trips to the live project (fixture inserts, 5× `createUser`, 5×
  `signInWithPassword`) — the default 10s hook timeout wasn't enough, and a timed-out
  hook silently reports all 21 tests as "skipped" rather than failing loudly.
- Three inline test-body inserts were missing fields required since phase2b: a
  club insert missing `slug`, and two guardian inserts missing `org_id` (guardians
  have no parent row to derive it from — see §5).

### Two real policy bugs the suite caught — both fixed, both worth understanding

`phase2h_fix_club_staff_guardian_writes` and `phase2i_club_staff_are_org_members`.

Phase 2e wrote almost every policy as `is_org_member(org_id) and (...)`. But
`is_org_member` only consulted `role_assignments` and `org_members` — so anyone
whose access comes from `club_staff`, with no `org_members` row, was fenced out
of **their own club's** teams, players, sessions and fees. The suite's own test
at "club_admin of Club B can still read Club B even without any org_members row"
documents that this is a supported case.

Fixed at the source rather than by patching 40 policies: `is_org_member` now also
returns true for club staff, assigned coaches, guardians of a player in the org,
and the player themselves. Re-verified afterwards that the cross-tenant fence
still holds — a club_admin of Club A sees Club A and nothing of Org B.

**If you widen a security helper, re-run the cross-tenant check before moving on.**

### A third bug the suite caught, once the first two were fixed

`phase2j_fix_can_read_club_org_collapse` and `phase2k_can_read_club_requires_club_admin`.

`can_read_club(p_org, p_club)` fell back to `is_club_staff(p_club) or
is_org_member(p_org)`. Almost every read policy is already written as
`is_org_member(org_id) and (can_read_club(org_id, club_id) or ...)`, with the same
`org_id` passed to both calls — so once the outer gate passed, the inner `or
is_org_member(p_org)` was trivially true too, and the whole club-scoping collapsed
to "any org member can read any club's data." This silently erased intra-org
isolation on every table using `can_read_club`: `players`, `training_sessions`,
`fee_charges`, `guardians`, `payments`, `player_evaluations`, `meetings`,
`expenses`, `memberships`, `document_uploads`, `approval_requests`,
`team_memberships`. A `club_staff` row with role `coach` compounded it further,
since `is_club_staff` doesn't check role at all — any staff row, any role, read
the whole club.

Caught by two tests: "coach assigned to Team A1 CANNOT see Team A2 sessions (same
club)" and "guardian CANNOT see a different player's fee charge, even same club" —
both returned the forbidden row instead of zero.

Fixed by making `can_read_club`'s override require `is_org_admin` (not mere
membership) and `is_club_admin` (not any staff role) — matching the access model
`getClubAccess()` in `src/lib/supabase/server.ts` already documents: only platform
admin and club_admin are club-wide, every other club_staff role is scoped to
`is_assigned_to_team()`, which the read policies already OR in separately.
Re-verified the cross-tenant fence afterwards; still holds.

### If the run fails again

A null-deref at the `teams` insert means `clubA` was null, which means the club
insert failed. Fixture inserts go through `must()`, which throws the real Postgres
error instead of surfacing a downstream null-deref — read that message first, it
will name the column or policy.

Confirm you are running the patched file: it is **18,412 bytes** and contains
`function must<T>`. An earlier write silently did not land while reporting
success once, so check the file before debugging the database.

---

## 0c. Coach / Player Profile / Parent-Guardian rework (2026-09-08, in progress)

Three detailed specs (`docs/specs/coach-module.md`, `player-profile.md`,
`parent-guardian-module.md` — copied from the user's own prompt files so they
survive outside this session) describe one shared initiative, not three
separate features: a canonical Player Profile with role-specific views for
Coach/Player/Guardian, plus a Coach → Guardian tournament-roster-acknowledgement
workflow threading through all three. Gap analysis against the actual app
(2026-09-08): the backend is further along than the UI — `development_goals`,
`player_evaluations`/`player_skill_ratings` (1-5, technical/tactical/physical/
mental, 27-skill `development_skills` framework), `player_development_notes`,
`drills`/`session_drills`, `fee_charges`/`payments`, `memberships`,
`document_uploads`, and — most importantly — the full guardian-acknowledgement
data layer (`approval_requests`, `requires_guardian_consent()`,
`approval_is_granted()`, `port_squad_to_tournament()`) already exist from the
Sept 7 phase 3-5 migrations. **None of the acknowledgement layer has any UI**
— grepped, zero references outside migrations/generated types. No canonical
shared Player Profile component exists either: `player/page.tsx`,
`guardian/page.tsx`, and the coach-side `c/[clubSlug]/teams/[teamSlug]/
players/[playerId]/` tree are three independent hand-rolled renderings.
Player-facing tabs today are actually Schedule/Attendance/Development/Fees/
Announcements, not the five sections (Overview/Development/Fees/Membership/
Family) the Player Profile spec assumes already exist — Membership and Family
have no player-facing UI at all yet. No PDF/TXT export tooling exists in the
repo. Permissions today are coarse: `club_staff.role` + `is_assigned_to_team()`
only, no granular per-permission model.

Agreed phasing (user confirmed: build the full granular permission table per
the specs, not a lighter role-only extension; guardian acknowledgement ships
in-app now, real email deferred until SMTP exists per §8; one phase at a time,
reviewed before the next starts):

- **Phase 0 — permission foundation. Done.** Additive only — see the
  `phase6a` migration row above. `club_admin` deliberately has no hardcoded
  bypass in `has_staff_permission()` (per the Player Profile spec's "do not
  simply make every administrator a superuser") — it gets a
  `role_permission_defaults` bundle containing every staff permission
  instead, same code path as everyone else.
- **Phase 1 — canonical Player Profile. Done.** `src/components/player-profile/
  PlayerProfile.tsx` is the one shared component (Overview / Development /
  Fees / Membership / Family) now used by all three viewer routes — the
  coach's `c/[clubSlug]/teams/[teamSlug]/players/[playerId]` page, `/player`
  (self), and `/guardian` (per child) — replacing three independent
  renderings. Reuses the existing Goals/Evaluations/Notes/Timeline/
  ProfileForm/PlayerFees/PlayerMembership components as-is (imported from
  their original location under the coach route rather than moved — they're
  pure prop-driven client components with no route coupling, so this works
  without changes; a future cleanup could relocate them but nothing requires
  it). New: `Overview.tsx` (header + football/development/training snapshots
  + recent activity) and `Family.tsx` (guardian list, read-only for player/
  guardian viewers, full add/remove/invite for coach). Coach viewer's
  permission flags come from `has_staff_permission()` (Phase 0) instead of
  the old `canManage` computation; player/guardian viewers are read-only,
  scoped by RLS rather than a configurable bundle. `development_goals`,
  `player_evaluations`, `player_skill_ratings`, `player_development_notes`
  RLS cut over to the new permission functions in the same pass (`phase6b`/
  `phase6c` migration rows above) — verified live against the showcase data
  (team-scoping, guardian/player visibility split, the player-visible-note
  read gap fixed in `phase6c`) and `tests/rls/club-manager-isolation.test.ts`
  stayed 21/21 throughout.

  Two known gaps, deliberately not fixed here (out of scope for this phase):
  `fee_charges`/`memberships`/`guardians` RLS is untouched, so the Fees/
  Membership/Family tabs' edit controls are computed to match today's exact
  behavior (`view_team` permission as a stand-in for the old `canManage`)
  rather than the spec's tighter "coaches shouldn't see finances by
  default" — deliberate, since tightening it now would be a silent UX
  change without the matching RLS cutover a later phase should do together.
  And `database.types.ts`: a full regeneration surfaces ~85 unrelated
  pre-existing type errors elsewhere in the app (trigger-derived `org_id`
  omitted from inserts, which the live schema requires but the file — as it
  already existed before any of this session's work — doesn't); reverted
  that regeneration and instead hand-added just the five `phase6a` tables
  (`permissions`, `role_permission_defaults`, `guardian_permission_defaults`,
  `staff_permission_grants`, `guardian_permission_grants`) and four
  functions (`has_staff_permission`, `has_guardian_permission`,
  `my_staff_permissions`, `my_guardian_permissions`) by hand, matching the
  file's existing Row/Insert/Update/Relationships shape exactly, touching
  nothing else. A real full regeneration (fixing the ~85 pre-existing
  `org_id` errors properly, not working around them) is still a separable
  cleanup task, just no longer blocking this phase's own type-correctness.
- **Phase 2 — fill real gaps in existing sections. Done.** Per-guardian
  permission management in the Family tab (club_admin can see each
  guardian's effective permission set — default bundle plus any override —
  and grant/revoke/reset individual ones via `setGuardianPermission()`,
  writing to `guardian_permission_grants`). Membership and Family tabs
  themselves already shipped in Phase 1 as part of the canonical component.
  Coach action-center dashboard (`src/app/c/[clubSlug]/ActionCenter.tsx`):
  Coach Module spec §1's "what do I need to know and do today" — today's
  sessions, upcoming sessions, a team snapshot (player count, 30-day
  attendance, active/needs-attention goals), and an action list (take
  attendance for a session with none recorded, plan a session with no
  drills attached, review a goal marked needs_attention) — action-first per
  the spec's own instruction, the list renders above the snapshot tiles.
  Shown to club_admin (all teams) and coach/team_manager (assigned teams
  only, verified live: a coach assigned only to U15 Girls sees just that
  team's snapshot, not the other two) as a new default "Overview" tab on
  `/c/[clubSlug]` — previously club_admin-only (the existing
  `ClubDashboardStats` rollup now renders below it, under a "Club-wide"
  label, unchanged otherwise). Richer development timeline (attendance/
  match events folded into `Timeline.tsx`, not just evaluations/goals/
  notes) stayed out of scope — no match data exists in this app yet to
  timeline, and attendance is already the Overview tab's own "Training"
  snapshot rather than a timeline entry.
- **Phase 3 — tournament roster + guardian acknowledgement. Done**, with two
  deliberate simplifications. New "Tournaments" tab on the team page lists
  the team's `tournament_entries` (entries themselves stay an org_admin
  action — `phase6d`'s migration comment explains why registering a team is
  gated more strictly than filling its roster); each entry opens
  `RosterBuilder.tsx`, one "Submit Roster" action that:
  1. Creates an `approval_requests` row (`status='awaiting'`) for any
     selected minor (`requires_guardian_consent()`) without a live one for
     this entry — adults skip straight to step 2.
  2. Immediately calls `port_squad_to_tournament()` with the full
     selection — adults and already-`approved` minors port right away; a
     minor whose request was *just* created comes back `consent_missing`,
     not an error, just not portable yet until the coach revisits once a
     guardian has responded.

  `port_squad_to_tournament()` (phase5b, 2026-09-07) hardcoded
  `is_org_admin(entrant_org_id)` as its only authorization — a real gap
  against the Coach Module spec's own "Finalize Roster" workflow, since
  org_admin is a different person from the club's coach in practice.
  `phase6d` extended it to also accept `has_staff_permission
  ('finalize_tournament_roster', ...)` scoped to the entry's own
  club_id/team_id — the exact permission `phase6a`'s catalog defined for
  this, unused until now.

  Guardian side: new "Tournaments" tab on `/guardian` (`GuardianTournaments.tsx`)
  lists acknowledgement requests across every child in one flat list, with
  confirm/decline inline (`decideAcknowledgement()` — decline requires a
  reason, matching `approval_requests`' own check constraint). No email —
  guardians see requests only by visiting the app (SMTP still isn't wired,
  §8); `notifications` table rows aren't created for this either, since
  nothing yet reads them and `approval_requests` is already the
  authoritative, directly-queried source for the guardian's own list.

  Export: TXT only (client-side blob download, no new dependency) —
  PDF deferred, no library installed yet.

  Simplification #1: the spec's separate Fill → Request-acknowledgement →
  Finalize steps collapse into one "Submit Roster" action, because there's
  nowhere to persist an in-progress "coach selected but not yet submitted"
  candidate list (no draft-roster table exists, and adding one was out of
  scope) — every page visit reconstructs state from what's actually
  persisted (`approval_requests` + `tournament_roster`), and an adult
  candidate with neither yet simply isn't selected by default, no data loss
  since nothing was ever recorded for them.

  Simplification #2: no roster versioning (v1 submitted / v2 updated / v3
  finalized) — a `tournament_roster` row is final the moment it's created;
  there's no "unfinalize" or edit-after-port path, matching the spec's own
  "if changes are required after finalization, require an authorized
  roster update process" as something to build later, not assumed here.

  Verified live end-to-end against the showcase data (`npm run build`
  clean, `tests/rls` stays 21/21): a coach submitted two adult candidates,
  one ported immediately, the other (a genuine seed-data edge case — a
  17-year-old the age-generation helper had placed on an *adult* team, with
  no guardian on file at all since adult teams don't seed guardians) came
  back `consent_missing` with no guardian to notify. Added a real guardian
  for that player (Rosario Ignacio — kept permanently rather than deleted,
  since it fixes a genuine gap rather than being pure test residue), then
  walked the full cycle: coach submits → guardian sees exactly one pending
  item on `/guardian`'s Tournaments tab → confirms → coach revisits, sees
  "Guardian approved", resubmits → player ports into the final 16-player
  roster.
- **Phase 4 — audit logging. Done.** All via the existing `write_audit()`
  SECURITY DEFINER function (append-only `audit_log`, no read UI built —
  out of scope, this phase is write-side only) — no new tables or
  authorization changes, just a call added at each sensitive action:
  `guardian.relationship.created`/`removed` (`addGuardian`/
  `removeGuardianLink`, both pre-existing actions that had no audit trail
  before this), `guardian.permission.changed` (`setGuardianPermission`,
  Phase 2), `tournament.acknowledgement.requested` (`submitRoster`'s
  guardian-consent step, Phase 3 — distinct from `port_squad_to_tournament`'s
  own `tournament.roster.ported_out`/`received` pair, which already audited
  the finalize step since phase5b), `tournament.acknowledgement.decided`
  (`decideAcknowledgement`, Phase 3), and `tournament.roster.exported`
  (`recordRosterExport` — the export itself is a client-side Blob download
  with no server round-trip, so this one-line action exists purely to log
  that it happened).

  Verified live: toggled a guardian permission as club_admin, confirmed the
  `audit_log` row landed with the correct actor email, entity, and
  before/after values, then reset the permission back to default.

**A second initiative followed immediately after Phase 4**, from a fresh user
request: notifications had shipped as email-only-deferred (Phase 3's own
note above), and the user asked to scope in-app/push delivery and widen
scope to cover fees/documents/movement/development for every minor (routed
to guardians) and adult (routed to the player's own account). Two real
discrepancies were flagged and resolved before building: the user's "18 and
under" is treated as identical to `requires_guardian_consent()`'s existing
`age < 18` (not a new/different rule — same threshold everywhere, on
purpose), and "movement" (not an existing schema concept) was clarified to
mean both team/roster movement and trip/travel logistics. "Documents" has no
feature at all yet — building it is in scope, not deferred. Phasing:

- **Phase 5a — notification core. Done.** `push_subscriptions` table
  (`phase6e` migration — one row per device, `unique(endpoint)`, self-only
  RLS) plus two SECURITY DEFINER functions: `push_subscription_targets(org,
  user)` (reads a user's subscriptions, gated on org membership) and
  `save_push_subscription(endpoint, p256dh, auth_key)` (upsert-by-endpoint,
  `auth.uid()`-scoped — deliberately SECURITY DEFINER so re-subscribing a
  shared device under a different account reassigns the row rather than
  hitting the previous owner's RLS). `src/lib/notify.ts`'s
  `notifyAboutPlayer()` is the one entry point future phases call: resolves
  minor → every guardian link with an effective `receive_notifications`
  permission true (Phase 0's permission, unused until now — same
  default-bundle-plus-override computation as `Family.tsx`, just resolved
  for an arbitrary player rather than the caller's own relationship) /
  adult → the player's own linked account only (nobody is notified if an
  adult has no account — there's no "player module" to surface it in yet).
  Writes a durable `notifications` row (`channel='in_app'`) always, then
  best-effort push via `web-push` + a real generated VAPID key pair (in
  `.env.local`, gitignored — still needs adding to Vercel's prod env vars,
  not done automatically) to every subscribed device; a 410/404 push
  response deletes that dead subscription rather than retrying it forever.
  Client side: `NotificationSubscribe.tsx` (a dismiss-free banner — shown
  whenever the browser supports Push and permission isn't already granted,
  hidden once subscribed) on both `/player` and `/guardian`, calling
  `Notification.requestPermission()` then `pushManager.subscribe()` then a
  new `savePushSubscription()` server action wrapping the RPC. `public/sw.js`
  (previously fetch-passthrough only, deliberately caching nothing dynamic
  — see §7's proposal-appendix bug this file already avoided) gained
  `push`/`notificationclick` listeners; the push payload is exactly what
  `notify()` JSON.stringifies (`title`/`body`/`linkPath`), not the Push
  API's own envelope, since there's no template registry yet — `payload`
  must include rendered `title`/`body` directly until Phase 5c wires real
  trigger points with real copy.

  Nothing calls `notifyAboutPlayer()` yet — that's Phase 5c. This phase is
  the plumbing only, verified live on `/demo`'s guardian and player
  personas: the banner renders and correctly reads `Notification.permission`
  (shows the "blocked" variant in the sandboxed preview browser, which
  denies notification permission by default — the OS-level grant→subscribe
  round trip itself couldn't be exercised in that sandbox, only code-path
  correctness). `npx tsc --noEmit`, `npm run build`, and `tests/rls` (21/21)
  all stayed clean; `database.types.ts` was hand-patched again rather than
  regenerated (this session's standing rule — see Phase 1's note above),
  adding just the `push_subscriptions` table and the two new functions.
- **Phase 5b — in-app inbox. Done.** `NotificationBell.tsx` in the global
  nav (`layout.tsx`, rendered for any signed-in user — harmless for
  roles nothing notifies yet, and matches `notifications_read_own`'s own
  org_admin-sees-all clause) — unread-count badge, a dropdown reading
  `getMyNotifications()` (a thin select relying entirely on the existing
  RLS policy to scope rows, no explicit recipient filter needed),
  mark-one-read on click (then navigates to `link_path` if set) and
  mark-all-read, both optimistic-then-persisted via `notifications-
  actions.ts`. Initial list is server-fetched once in the root layout so
  the badge is correct on first paint; opening the dropdown refetches for
  freshness. Verified live: inserted two real rows for the demo guardian
  (one pre-read, one not) via direct SQL — since nothing writes to
  `notifications` yet, that's still Phase 5c's job — confirmed the badge
  count, the read/unread visual distinction, "Mark all read" updating the
  database (re-queried directly, not just trusting the optimistic UI), and
  the empty state on the player and coach personas; cleaned up the test
  rows afterward. `tsc`/`build`/`tests/rls` (21/21) all stayed clean.
- **Phase 5c — wire existing triggers. Done.** `notifyAboutPlayer()` now
  gets called from `addFeeCharge`/`recordPayment`/`updateFeeChargeStatus`
  (fees-actions.ts), `addGoal`/`addEvaluation`/`addNote` (players/
  [playerId]/actions.ts, each passing its own `visibility` value through
  so nobody is notified about a `coach_only` row they can't actually open
  -- see below), `updateMembershipStatus` (membership-actions.ts, generic
  copy for any status, specific copy for `transferred`), and
  `submitRoster` (tournaments/actions.ts, both on raising a fresh
  acknowledgement request and on a successful port). `notifyAboutPlayer`'s
  signature dropped the `orgId` parameter from Phase 5a's draft -- it's
  derived from the player row instead, since every call site already has
  a `playerId` and this is one less thing to thread through. `linkPath`
  now defaults to `/guardian` for a minor's targets and `/player` for an
  adult's own account (overridable per template).

  **A real bug, found live, not caught by the RLS suite:** the first
  attempt at this phase created the fee charge correctly but wrote *zero*
  notification rows, with no thrown error anywhere. Root cause: Phase 5a's
  `notifyAboutPlayer` ran `supabase.from('notifications').insert(...)
  .select('id').single()` in the *notifying staff member's own request
  context* -- and `.select()` after an insert is a RETURNING-equivalent,
  which Postgres also checks against the table's SELECT policy
  (`notifications_read_own`, recipient-only or org_admin). A club_admin
  raising a fee for someone else's kid is neither, so that implicit
  SELECT check failed and rolled the *entire insert* back -- and the
  insert's own `{ data, error }` was destructured without reading `error`,
  so the failure was silent. The exact same trap existed on the
  sent_at/failed_reason update after a push attempt (`notifications_mark_
  read` is also recipient-only) and on cleaning up a dead push
  subscription (`push_subscriptions`' self-only RLS, deleting someone
  else's dead endpoint). Fixed with two more SECURITY DEFINER escape
  hatches, same established pattern as `write_audit`/`port_squad_to_
  tournament`/`save_push_subscription`: `create_notification(...)` (checks
  `is_org_member`, then inserts and returns the id as a plain scalar --
  no RETURNING-triggers-a-read-check trap) and `mark_notification_sent
  (id, failed_reason)` (`phase6f` migration), plus `delete_stale_push_
  subscription(endpoint)` (`phase6g`) for the subscription cleanup.
  `notify.ts` now also actually checks and logs the insert's `error`
  rather than swallowing it. Caught by re-testing live against the
  showcase data after the fee charge came back with zero notifications;
  confirmed the fix with a direct SQL repro (`set local role
  authenticated` as the real club_admin, insert with `.select()` analog
  → `42501`; same insert via the new RPC → succeeds) before touching the
  app code, then re-verified end-to-end through the UI (a club_admin
  added a `player_and_parent`-visible development note and recorded a
  fee payment; the guardian's bell showed both, `notifications.sent_at`/
  `read_at` behaved correctly) and cleaned up the test rows afterward.
  `tsc`/`build`/`tests/rls` (21/21) all stayed clean throughout.
- **Phase 5d — documents feature. Done.** `document_uploads` existed as a
  table only (zero application code, per this doc's own earlier note) with
  RLS that predated Phase 0's permission catalog — write was
  `can_admin_club()` only (club_admin exclusively, even though
  `role_permission_defaults` already seeded `manage_documents` for both
  club_admin AND staff, unused until now), and read let any guardian/
  player-self through unconditionally with no per-relationship gate
  (every other player-scoped table already cut over to
  `has_guardian_permission()` in phase6b/6c). `phase6h` migration cuts it
  over to the catalog entries Phase 0 already defined for this
  (`view_documents` on the guardian side, `manage_documents` on the staff
  side) — found and fixed as part of building the feature, same as
  Phase 5c's real bug, not a hypothetical.

  New "Documents" tab on the canonical `PlayerProfile.tsx` (6th tab,
  alongside Overview/Development/Fees/Membership/Family — the spec's own
  data model lists Documents as a peer of Membership/Fees/Guardians, not
  nested under one of them). `src/components/player-profile/Documents.tsx`
  + `documents-actions.ts`: `uploadDocument()` reads a real `File` from
  `FormData` (`file.arrayBuffer()` → base64 into `file_data`, matching the
  column's existing inline-storage design — no blob storage added), capped
  at 8MB; `reviewDocument()` sets approved/rejected + a note (rejection
  requires one) and records `reviewed_by`/`reviewed_by_role` from the
  caller's own `users` row; `deleteDocument()` removes a mistake. Both
  upload and review call `notifyAboutPlayer()` (`document.uploaded`,
  `document.reviewed`). Only club_admin/staff (`manage_documents`) can
  upload or review; players/guardians get a read-only status list — matches
  the RLS write policy exactly, and matches the spec's own "Registration —
  Complete / Tournament Waiver — Missing" status-tracking model rather than
  a self-service family upload flow (nothing in the spec or the existing
  write policy supports guardians uploading their own documents).

  Verified live: RLS write policy confirmed directly via SQL impersonation
  (a club_admin's insert matching what `uploadDocument()` produces
  succeeds) since the sandboxed preview browser can't drive a native file
  picker to exercise the upload form's own click-through — inserted that
  row for real, then drove the rest of the flow through the actual UI: the
  Documents tab listed it with a pending badge, "Approve" flipped it to
  Approved and cleared the badge, and the guardian's notification bell
  received `document.reviewed`. Confirmed the guardian/player view renders
  read-only (no upload/approve/reject controls) and the empty state
  renders correctly. Cleaned up the test row afterward. `tsc`/`build`/
  `tests/rls` (21/21) all stayed clean.
- **Phase 5e — movement, travel half. Done** (the trips/travel half only
  — see the note below on the team-transfer half). `addPassenger`/
  `removePassenger` (`trips/[tripId]/actions.ts`) now call
  `notifyAboutPlayer()` with the trip's name. Verified live: created a
  real trip, added Angelica as a passenger (`trip.passenger_added`
  landed), removed her (`trip.passenger_removed` landed), cleaned up
  both the trip and the test notification rows afterward. `tsc`/`build`/
  `tests/rls` (21/21) all stayed clean.

  **The other half of "movement" is a genuine missing feature, not just a
  missing notification hook — flagged to the user rather than built
  unprompted.** Grepped for any way to move a player from one team to
  another within the same club: none exists. `teams/[teamSlug]/
  actions.ts` only has `addPlayer` (create) and `removePlayer` (delete) —
  no transfer/reassign action anywhere, so today the only way to "move" a
  player between two of a club's own teams is to remove them from one
  and re-add them as a brand new player row on the other, losing their
  whole history (evaluations, goals, notes, fees, memberships — none of
  it carries over). `updateMembershipStatus`'s `'transferred'` status
  (wired to notify in Phase 5c) covers a player leaving the club
  entirely, not moving between two teams inside it. Building a real
  "reassign to another team" action is a separate feature decision (does
  it preserve history? does it need its own approval step for a minor's
  guardian? is a team change during an active tournament roster
  allowed?) that the original notification-scoping conversation flagged
  as an open question, not a green light — out of scope for this pass.

**A third round followed**, proposed before building (per the same "propose
before build" pattern as the notification initiative): the flagged
team-transfer gap, built properly this time, plus broadening documents
beyond tournament-only with role-based visibility by document type.

- **Player movement / team transfer. Done.** `team_memberships` had existed
  since `phase3_free_the_player` (2026-09-07) with zero application code —
  exactly the "one row per team stint" shape this needed, so no new table.
  `phase6i` migration: backfilled an initial stint for every existing
  player (`from_date` = `players.created_at`, the best available proxy,
  not a real join date — flagged as an approximation) so history doesn't
  start empty, then added `transfer_player_to_team(player_id,
  new_team_id)` — a SECURITY DEFINER RPC, not a raw table update, because
  `players_write`'s `WITH CHECK` only verifies `is_org_member(org_id)` and
  never re-checks permission against the *destination* team; a plain
  update would let a coach reassign a player into their own team from
  someone else's without the destination team's staff having any say.
  The RPC authorizes once against `manage_membership` (existing club-scope
  permission, already used for the Membership tab — no new permission
  key), then atomically closes the old stint, opens the new one, and
  moves `players.team_id`, and writes `movement.team_transferred` to
  `audit_log`. Scope: same-club, team-to-team moves only — leaving the
  club entirely is still `updateMembershipStatus → 'transferred'`
  (Phase 5c), and moving to a *different* club isn't modeled by this
  schema at all (players have no cross-club identity).

  UI: a new "Team History" section in the canonical `PlayerProfile.tsx`'s
  existing Membership tab (`TeamHistory.tsx`) — chronological stints with
  dates/jersey/position, and (coach/staff with `manage_membership` only) a
  "Move to another team" picker scoped to the same club's other teams.
  `movement-actions.ts`'s `transferPlayerToTeam()` calls the RPC then
  `notifyAboutPlayer()` — no guardian approval step, matching the user's
  explicit "parents do not need to approve but they need to be notified."

  A real UX bug found live: the coach's page (`teams/[teamSlug]/players/
  [playerId]`) is team-scoped and calls `notFound()` once the player's
  `team_id` no longer matches that route's team — so a successful transfer
  left the page 404ing on its own stale URL. Fixed by having the action
  return the destination team's slug and redirecting client-side to the
  new team's player page rather than leaving the view stranded. Verified
  live end-to-end: moved Angelica Alvarado U15 Girls → U8 → back, watched
  Team History accumulate both stints with correct date ranges, confirmed
  the redirect landed on the new team's URL both times, and confirmed both
  the `notifications` row and the `audit_log` before/after both times.
  `tsc`/`build`/`tests/rls` (21/21) all stayed clean.

- **Documents v2: any document type, role-based visibility. Done.** Phase
  5d's `docs_read`/`docs_write` gated every document type identically on
  `manage_documents` (club_admin/staff only, family read-only). Widened per
  the user's ask ("not limited to tournaments... viewable across coach,
  team manager, club mgr depending on type"): added a `category` column
  (`phase6j` migration, backfilled from each row's existing `type`) so RLS
  can gate by category, not just one blanket permission — a TypeScript-only
  mapping wouldn't be enforceable at the database level. New types, grouped:
  `identity` (birth_certificate, government_id), `medical`
  (medical_clearance, allergy_disclosure, insurance_card), `registration`
  (unchanged), `consent` (unchanged: code_of_conduct, consent_form,
  media_consent, tournament_waiver), `other` (unchanged). `medical`-category
  documents are now also visible/manageable via `view_medical` — already in
  Phase 0's catalog, already defaulting to club_admin + coach + team_manager,
  unused until now, so no new permission key needed; every other category
  stays `manage_documents`-only as before (more administrative/sensitive,
  no reason to widen). Guardian/player-self visibility is unchanged — a
  family still sees all of their own child's documents regardless of
  category. `TYPE_CATEGORY`/`MEDICAL_TYPES` live in `src/lib/document-
  types.ts`, not `documents-actions.ts` — a `'use server'` file can only
  export async functions, and a plain object export there breaks the build
  at runtime (hit this live, fixed by moving the constant out). `Documents.tsx`
  now takes `canManageGeneral`/`canManageMedical` separately: the upload
  type dropdown only offers categories the viewer can actually write
  (medical-only for a view_medical-only coach), and each row's
  approve/reject/remove controls check the row's own category against the
  right flag.

  Verified live: as club_admin, uploaded nothing new (Phase 5d already
  covered that path) — instead verified via SQL impersonation that RLS
  itself splits correctly (a coach's insert of a `medical`-category row
  succeeds, the same coach's insert of an `identity`-category row is
  refused with 42501), then drove the rest through the real UI as the
  coach persona: the upload form's type dropdown showed only the 3 medical
  types, the Documents list showed only the medical row (a birth
  certificate inserted alongside it stayed invisible), approving it
  worked and fired `document.reviewed`, and the birth certificate was
  confirmed untouched throughout. Cleaned up test rows afterward.
  `tsc`/`build`/`tests/rls` (21/21) all stayed clean.

---

## 0d. Role realignment against the Team Manager / Club Manager / Club Admin specs (2026-09-09)

Three role specs were supplied (`Team Manager`, `Club Manager / Org Manager`,
`Club Admin / IT Administration`). They were read against the live database
first; the conflicts below are real, not hypothetical, and Phases A+B are
applied. **Phases C–F are not built** — see the backlog at the end.

### The naming collision, and how it was resolved

`club_admin` in this codebase meant the club's **business owner**: it held all
26 permissions and anchored the RLS spine (`is_club_admin` → `can_read_club` /
`can_admin_club`). The Club Admin spec defines the same string as an **IT-only**
role with explicitly zero business authority. Opposite meanings, same word.

Resolution (product decision, confirmed 2026-09-09):

- The existing role is renamed to what it actually is: **`club_manager`**
  (`phase6k`). This is the specs' "Club Manager / Org Manager".
- The internal name is **not** `org_manager`. That would sit beside the
  existing `org_admin` / `org_members` / `is_org_member`, which mean something
  different and broader — a tenant owning multiple clubs *plus* tournament
  entitlements. The two specs contradict each other on whether a "Club
  Director" tier exists (Team Manager spec §1/§28 says yes, Club Manager spec
  §1 says no); the existing **org layer already occupies that tier**, so no new
  role was created for it.
- A future IT role will be **`club_it_admin`**, not `club_admin`. Every
  historical migration in this repo will forever read `club_admin` as
  god-mode; recycling the string invites exactly the confusion the rename
  removes. Display name can still be "Club Admin".

The rename was cheap because policies call *helpers*, not the literal: only
four functions embedded `'club_admin'` (`is_club_admin`, `can_admin_club`,
`can_read_club`, `has_staff_permission`) and four policies named it directly,
against 143 policies total. `is_club_admin()` was **dropped and replaced** by
`is_club_manager()` rather than redefined in place, so any missed reference
fails loudly instead of silently granting access.

### What was actually wrong with the roles

- **`team_manager`'s bundle was byte-identical to `coach`** — 19 permissions
  including `add_private_coach_note`, `manage_development`, `add_evaluation`.
  The Team Manager spec's single most emphasized rule ("player development
  remains a Coach-owned function") was fiction. Fixed in `phase6l`.
- **`club_admin` held development-authoring and roster-finalization**, both
  forbidden by the Club Manager spec (§19 read-only development, §29 no
  PREPARE/FINALIZE). Fixed in `phase6l`.
- **Club-scope vs team-scope collision.** `manage_documents` /
  `manage_membership` / `view_finances` are all `scope='club'`, and
  `has_staff_permission` *short-circuits the team fence* for club-scope keys.
  Simply adding them to `team_manager` would have handed over the whole club —
  the opposite of Team Manager spec §20. `phase6m` adds team-scope keys
  (`view_team_finance`, `manage_team_documents`, `manage_team_membership`) that
  route through the `p_team_id in current_user_team_ids()` branch instead.
- **A live gap found on the way:** `fee_charges` / `payments` / `memberships`
  RLS was gated purely on `can_read_club` / `can_admin_club`, so the club-scope
  `manage_finances` / `view_finances` / `manage_membership` keys were consulted
  by **no policy at all** — the `staff` role has nominally held
  `manage_finances` since `widen_fee_management_to_staff_role` without the
  database ever honouring it. `phase6m` wires them in. (`can_create_fees()` is
  referenced by zero policies and stays dead; not resurrected.)

### Deviation from the specs, on purpose

**`finalize_tournament_roster` is `coach` OR `team_manager`, and NOT
`club_manager`.** The Team Manager spec §15/§23 reserves finalization for the
coach alone ("do NOT grant FINALIZE_TOURNAMENT_ROSTER"); the product decision
overrides that. Consequence to keep in mind: the spec's
prepare→acknowledge→review→finalize handoff loses some of its point if the
same role can do both ends, which matters when Phase C builds the roster state
machine.

### Final bundles (phase6l / phase6m)

| Role | Perms | Shape |
|---|---|---|
| `club_manager` | 17 | Business boss. No development authoring, no roster prepare/finalize. |
| `coach` | 19 | **Unchanged.** Owns development, records attendance, finalizes rosters. |
| `team_manager` | 16 | Operations + team-scoped finance(read)/docs/membership. No development authoring, no attendance recording. |
| `assistant_coach` | 7 | New. Supports the coach, authors nothing, records attendance. |
| `treasurer` | 5 | New. Finance specialist. |
| `secretary` | 6 | New. Documents / membership / communications. |
| `staff` | 8 | **Unchanged.** Generic office helper. |

`club_staff.role`'s CHECK constraint now allows exactly these seven.

### UI now mirrors the write policies

`PlayerProfile.tsx`'s permission flags were computed from a `view_team`
stand-in dating to Phase 1, when `fee_charges`/`memberships` RLS was still
untouched. With `phase6m` those policies are real, so the stand-in would have
shown controls the database refuses. `canManageFees` is now `manage_finances`
alone (team managers read their teams' charges but cannot write them — spec
§23's finance permissions are all VIEW_/EXPORT_), and `canManageMembership` /
document management include the team-scope keys. Side effect: the **coach no
longer sees fee-management controls**, which is a bug fix — `fees_write` has
always refused them.

### Verified

`tests/rls/club-manager-isolation.test.ts` grew 21 → **32 tests**, including a
`team_manager` fixture on the *same team* as the coach so any difference is the
role and not the assignment. New coverage pins: coach can author private notes
and team manager cannot; team manager cannot manage development or add
evaluations but can still read development; attendance stays coach-recorded;
finalize belongs to coach + team manager but not club manager; and the team
manager sees their own team's fee charge but **not** another team's in the same
club. The pre-existing cross-tenant fence tests all still pass, which is the
proof the RLS spine survived the rename. Also verified live on `/demo`:
development authoring controls gone for the team manager, documents offering
the full category list, fees read-only.

### Not built (backlog, in rough priority order)

- ~~**C — Roster workflow**~~ — **done**, as visibility (§0f), and the
  versioning it deferred is now done too (§0h). `port_squad_to_tournament`'s
  `is_org_admin` bypass was narrowed in phase6t (§0g).
- ~~**D — Coach assignment model**~~ — **done** (§0i). `user_assigned_teams
  .is_primary` plus `set_team_primary_coach()`; the same pass fixed a live bug
  where nobody below org admin could assign anyone to a team at all.
- **E — Club Admin (IT) module. Partially built — the role and "view as" are
  done (see §0e); invitations, password/MFA reset, session revocation and
  account activation are not.** Those remaining pieces need the
  **service-role key in server actions** (a new attack surface — today
  service role is only used by the RLS test suite), and invitations/resets
  are **blocked by the 2-email/hour cap** in §8 until SMTP is wired. Good
  news: `audit_log` is already append-only with no UPDATE/DELETE policy for
  anyone, so "Club Admin cannot delete audit records" is structurally
  satisfied.
- **F — Seasons, committees, readiness score, the reports module.** No
  `seasons` table exists at all despite ~10 spec references; `team_memberships`
  (from the movement work) is the de-facto timeline. The two specs' reporting
  sections together are dozens of report types — its own project.
- Also unbuilt: `role_assignments` is still **completely empty**; every real
  grant lives in the legacy `club_staff` / `org_members` / `user_assigned_teams`
  tables, so §4's "write new grants to role_assignments" remains aspirational.
- The specs' 16–18 item navigation was deliberately **not** built; most of it
  has no backing data.

---

## 0e. Club Admin (IT) role and "view as" (2026-09-09)

`club_it_admin` exists (`phase6n`), plus a logged, time-limited **view-as**
(`phase6o`/`phase6p`) and the account-layer directory it needs (`phase6q`).

### Why this is a view-as and not session minting

Product decision was "go with impersonation". It is built as an *inspection*
session, not a session takeover, because **the Club Admin spec's own §10
requirements make minting impossible**: requirement 5 says "the original Club
Admin identity must remain attached to all audit records" and requirement 6
says "the impersonated user must not be treated as the actor in the underlying
audit record". `write_audit()` keys off `auth.uid()`, so if the admin's browser
held the target's JWT every action would be attributed to the target and be
indistinguishable from account takeover — the exact opposite of what the spec
asks for. Verified live: after a session, the `audit_log` row's `actor_email`
is the **admin's**, not the target's.

So the admin stays themselves and never gains the target's data access. What
they get is a readout of the target's *effective access* — role, assigned
teams, the permissions they hold, and (the useful part for support) the
permissions they **don't**. The demo case answers itself: a coach who can't
open the fee ledger shows `view_finances` and `view_team_finance` under "does
not have".

If true session takeover is ever wanted it is a separate, much riskier
decision and should get its own explicit sign-off — do not treat this as a
stepping stone to it.

### Guards, all enforced in `start_impersonation()`, never in the UI

Permission (`impersonate_user`), non-empty reason, not yourself, target must
belong to the club (no cross-tenant reach), **platform admins are never
impersonable**, 30-minute default expiry capped at 120, and one active
session per actor. `impersonation_sessions` has a SELECT policy only — no
INSERT/UPDATE/DELETE policy exists for anyone, so rows are written solely by
the SECURITY DEFINER functions and nobody, including the actor, can erase or
backdate one. Both start and end write to `audit_log`.

`effective_access_for()` refuses unless a live session exists for exactly that
actor/target/club triple. It is **diagnostic only and must never be called
from a policy** — it mirrors `has_staff_permission`'s club_staff branch, so if
it drifts the result is a wrong readout, not a security hole. It deliberately
omits the platform-admin bypass since platform admins can't be viewed as.

### Two things the role forced open

- `club_staff_read` requires `can_read_club`, so the IT role could not list
  the people it exists to troubleshoot. `it_club_directory()` (`phase6q`)
  returns exactly the account layer spec §11 permits — name, email, role —
  and nothing else.
- **`player_guardians`' write policy granted on `is_club_staff()`** — any
  club_staff row, no role or team check, the same class of bug phase2j/2k
  fixed for `can_read_club`. Harmless while every role was a business role;
  an actual privilege leak the moment an IT role exists. Now gated on
  `view_player`, which every business role already holds and the IT role
  does not.

### UI

`/c/[clubSlug]/it` — a separate route, not a tab in the business console
(spec §6). A **highly visible banner** (spec §10 requirement 3) renders from
the root layout for the life of the session and is explicit that identity has
not changed: "you are still signed in as yourself and acting with your own
permissions." Demo persona `Luisa Villar` is now the `club_it_admin`.

### Verified

RLS suite 32 → **41 tests**. New coverage: the IT role holds the technical
permissions and none of the business ones; reads zero players and zero fee
charges; cannot link a guardian; is not a club manager; and every view-as
guard (no permission / empty reason / non-member target / readout without a
session / readout stops working after the session ends). Driven live
end-to-end too: started a session as the IT admin against the coach, saw the
banner and the readout, confirmed the audit row was attributed to the admin,
ended the session and watched the banner disappear.

---

## 0f. Roster workflow states (2026-09-09)

Product decision: the spec's roster state machine is for **workflow
visibility, not enforcement**. That follows from the earlier finalize
decision — both coach and team_manager hold `finalize_tournament_roster`, so
a state machine gating a handoff between them would be gating nothing.

### Derived, never stored

`phase6r` adds `tournament_roster_candidates` — and deliberately **no status
column anywhere**. Every state is computed at read time in
`src/lib/roster-state.ts` from the three things that are actually true: who is
proposed (candidates), what their guardian said (`approval_requests`), and who
has been ported (`tournament_roster`). A stored status would be a second
source of truth that drifts from the approvals it summarises, and since
nothing is gated on reaching a state there is nothing to gain by storing it.

Per player: Not selected → Proposed → (No guardian on file) → Awaiting
guardian → Guardian confirmed / declined → Finalized. Rolled up per roster:
Draft → Proposed → Awaiting guardians → Ready for review → Partly finalized →
Finalized.

The spec's **"Locked" is intentionally not a separate state**: a
`tournament_roster` row is already immutable (there is no unfinalize path), so
Finalized and Locked describe the same reality. They only need separating if
an unfinalize workflow is ever built.

### Why a new table was needed at all

Phase 3's documented reason for collapsing the workflow into one click was
that there was "nowhere to persist an in-progress candidate list". That is
exactly what blocked visibility: the proposal lived in one person's browser,
so a team manager could not prepare something a coach picked up later, and no
state existed for anyone to observe. The candidates table is that missing
persistence and nothing more.

`submitRoster` is replaced by three actions — `addRosterCandidates`,
`requestAcknowledgements`, `finalizeRoster` — which are the same two
underlying operations Phase 3 performed (insert `approval_requests`, then
`port_squad_to_tournament`), split so each is observable. **No permission
changed**; both coach and team manager hold all three.

### Verified

47 RLS tests (up from 41) and a new pure-function suite, `npm run test:unit`
(14 tests), covering the derivation directly — including the case Phase 3's
live testing surfaced, a genuine minor with no guardian on file, which must
read differently from "we simply haven't asked yet".

Workflow driven end-to-end against the live showcase data as the assigned
coach: proposed 12 players, asked 12 guardians, and — the important one —
attempted to finalize *before* any approval, which returned `consent_missing`
for all 12 rather than porting them. Approving then finalizing ported all 12.
A coach from a different team is refused on the entry, and the IT admin can
neither see nor propose.

**Caveat on UI verification:** the browser pane's client-side Supabase auth
broke partway through this phase (sign-in requests stopped reaching the server
at all, for both the login form and the demo buttons), so the coach's
three-stage click-through was verified at the database rather than through the
UI. What *was* seen rendered: the entry page showing the derived `Draft` chip,
and correctly showing an IT admin the roster state with no player data and no
controls. Worth re-checking the three buttons in a browser next session.

---

## 0g. Tier 0 security + correctness batch (2026-09-09)

Three items, all found by checking the live database rather than trusting
this file's own backlog notes.

### 1. 25 SECURITY DEFINER functions were callable by anon (fixed, `phase6s`)

§0a records phase2g as having "regressed since, cause not identified". It had,
and the cause is mundane: **EXECUTE defaults to PUBLIC on function creation**,
and `anon` inherits PUBLIC — so every function added or recreated after
phase2g silently reopened. That also means "revoke from anon" alone does
nothing while PUBLIC still holds the grant; PUBLIC is what has to be revoked,
which is why the fix also has to re-grant `authenticated`/`service_role`
explicitly.

What was actually exposed, worst first:

- **Two mutating functions**, `expire_stale_approvals()` and
  `recompute_fee_status(uuid)`, callable unauthenticated over REST. Bounded —
  each writes only the value it would have computed anyway — but an anonymous
  caller should not be able to trigger writes at all.
- **Three minors-data oracles**: `requires_guardian_consent()` answers "is
  this player a minor?" to anyone holding a player UUID, along with
  `roster_consent_granted()` and `approval_is_granted()`. Not enumerable (RLS
  blocks listing players), so low severity — but §8 singles out minors' data
  for exactly this care.
- The rest were predicates returning false for anon, plus four trigger
  functions that should never be called directly.

**The migration is not the fix — the test is.** A one-time revoke has now
failed twice. `tests/rls` asserts `anon_executable_secdef_count() = 0`
(`phase6v` adds that helper, deliberately *not* SECURITY DEFINER so it stays
out of the set it counts) plus two direct probes proving anon really is
refused on a mutating helper and on the minor check. Adding a SECURITY
DEFINER function without revoking now fails the suite instead of sitting
unnoticed.

Verified no anon-facing policy calls any of these (0 matches) before
revoking — the same finding phase2g recorded, so this cost nothing at the
public surface.

### 2. Roster finalization: the admin override is narrowed, not removed (`phase6t`)

Club Manager spec §29 forbids bypassing coach finalization "through a generic
admin override", and `port_squad_to_tournament` granted
`is_org_admin(entrant_org_id)` unconditionally — exactly that.

**Deleting it would have been a mistake**, which is why checking first
mattered: **29 of 33 entries have no `club_id`**. Those are external teams a
host org entered directly — no Dula HQ club, therefore no club staff who
could ever hold `finalize_tournament_roster`. Removing the org-admin path
would have made them permanently unfinalizable.

So: a **club-backed** entry now requires `finalize_tournament_roster` on that
club/team and an org admin cannot override the club's own coach; a
**club-less** entry still falls back to org admin, because nobody else can
possibly be the authority. Both directions are pinned by tests.

### 3. `expire_stale_approvals()` was never scheduled (`phase6u`)

§5 has said to schedule it since the approvals were built; `pg_cron` wasn't
even installed. Harmless while no roster workflow existed — Phase C made it
live, so guardian requests would now sit as `awaiting` past their 14-day
deadline forever and misreport a roster as "Awaiting guardians". Now runs
hourly.

The safety property was never at risk: `approval_is_granted()` only ever
returns true on an explicit `approved`, so an unswept stale row could never
let a minor through. This was a reporting-accuracy fix.

### Also corrected while here: what SMTP is actually for

§8 says the 2-email/hour cap "blocks the consent flow". That is now **stale**.
Phase 5 made in-app + push the notification path, so acknowledgements reach
any guardian who has an account. More to the point: **nothing in this codebase
sends email at all** — no Resend, no nodemailer, no `inviteUserByEmail`, no
`resetPasswordForEmail`. `inviteGuardian()` only flips `account_status` to
`'invited'`; the guardian is never contacted and must be told out-of-band,
then self-registers at `/guardian-signup`.

So SMTP is a prerequisite for two features that **do not exist yet** —
guardian invitation delivery (the genuine chicken-and-egg: no account means no
in-app or push) and password reset (there is not even a "forgot password"
link) — not a blocker on anything built. Priced accordingly in the backlog.

### Verified

RLS suite 47 → **54**.

---

## 0h. Roster versioning (2026-09-09)

`phase6w`. A `tournament_roster` row was immutable once ported — §0c Phase 3's
"no unfinalize or edit-after-port path" — so a late injury or withdrawal had
no supported fix short of editing the database by hand.

### Two ints, no second table

`tournament_roster.added_in_revision` / `withdrawn_in_revision`, plus
`tournament_entries.roster_revision`. The roster as submitted at any earlier
revision stays reconstructible:

```
roster at revision N =
  added_in_revision <= N
  and (withdrawn_in_revision is null or withdrawn_in_revision > N)
```

`tournament_roster.status` has permitted `'withdrawn'` since phase5a and
nothing had ever written it. This is what it was for. **The row is kept, never
deleted** — that is the whole point.

This does not violate §0f's derived-never-stored rule: these record *when* a
row entered and left, which is a fact about the row, not a summary of the
approvals elsewhere.

### Why an RPC

`tournament_roster`'s write policy belongs to the **host** org
(`roster_host_write` = `is_org_admin(org_id)`), so club staff have no direct
write path to their own ported rows at all.
`withdraw_from_tournament_roster()`'s gate is deliberately identical to
`port_squad_to_tournament`'s (phase6t): taking a player off is the same
authority as putting one on, so a club-backed entry needs
`finalize_tournament_roster` on that club/team and **the club manager is
refused** — otherwise the admin override Club Manager spec §29 forbids on the
way in reappears on the way out.

Withdrawal also drops the candidate row, or the next finalize would port them
straight back in. Re-adding is therefore deliberate: propose, then finalize.

### Two consequences for the port, both forced by withdrawal existing

- A player already on the roster returns **`already_rostered`** instead of
  being inserted twice. Harmless while finalize was a once-per-entry act; a
  real duplication bug now that withdraw-then-re-finalize is the supported
  repair path.
- A finalize that ports nobody is no longer a new revision and no longer
  writes an audit row in two orgs, since re-finalizing an unchanged roster is
  now an ordinary no-op.

### "Locked" is still not a separate state

phase6w added the withdrawal path §0f said would be needed before Finalized
and Locked could differ — but it did not add a lock: withdrawal is available
at every revision. Locked only becomes real if a deadline (an entry cutoff, a
tournament start) closes the roster, and that is a fact about the
*tournament*, not a state a coach transitions to.

`roster-state.ts` gained a `withdrawn` **player** state so someone pulled off
a roster reads differently from someone never picked — without it they fall
back to "Not selected" and the history vanishes from the view. Withdrawn
players are excluded from the roster rollup, or a completed roster would sit
at "Partly finalized" forever.

### Verified

RLS 54 → **65**, unit 14 → **17**. Driven live end-to-end through the UI as
the assigned coach — **the browser-auth breakage §0f flagged has resolved, so
§0f's outstanding "re-check the three roster buttons in a browser" is done
too.** Withdrew a player with a reason, watched 12 → 11 at revision 2 with the
withdrawal and its reason listed as history, re-proposed and re-finalized back
to 12 at revision 3, where the finalize reported *"1 player added to the
roster. 11 already on it."* — the idempotence guard working. Audit landed in
both orgs attributed to the coach with the revision on each row; the
notification routed to the minor's guardian. Showcase data restored after.

---

## 0i. Primary coach, and a live team-assignment bug (2026-09-09)

`phase6x` — §0d's backlog item D. Checking the database first turned up a
second, larger problem than the one being fixed.

### The bug: nobody below org admin could assign anyone to a team

`user_assigned_teams`' policy was `is_org_admin(org_id)` for **every**
command, while `StaffRow.tsx` shows an "+ Assign to team" control to the club
manager — who is generally *not* an org admin (§0b: club staff routinely have
no `org_members` row). Confirmed by impersonating the showcase club manager:
refused, 42501. So that button has been failing for the role that owns the
club, and team assignment has only ever worked for an org admin or the seed
script's service-role key.

### The feature

"Primary coach" is a fact about an **assignment**, not about a person —
`club_staff.role` is club-wide, so it cannot say who leads which team. Hence
`user_assigned_teams.is_primary`, with a partial unique index
(`uat_one_primary_coach_per_team`) making "one per team" enforced rather than
intended. Backfilled from the data: every team had exactly one assigned coach,
so nothing was guessed — a team with two would deliberately have been left
with none for a human to designate.

`assign_team_staff` is a new **team-scope** key, following phase6m's
precedent: `manage_staff` is `scope='club'` and `has_staff_permission`
short-circuits the team fence for club-scope keys, so granting it to a team
manager would hand over the whole club's staff — the opposite of Team Manager
spec §20. `club_manager` still passes it on any team via
`has_staff_permission`'s own `cs.role='club_manager'` clause, but **only
because the key is in its bundle too** — that clause bypasses the team fence,
not the bundle check.

The single `uat_write` policy is split, because the spec's rule is
DELETE-specific. Team Manager spec §9 is now expressible and enforced: a team
manager may assign and unassign coaches on their own team, but **removing the
primary coach additionally requires `manage_staff`**. Promotion is not an
insert-time decision — a direct insert with `is_primary` true is refused, so
it goes through `set_team_primary_coach()`, which does demote-then-promote in
one step (the partial unique index would reject the promote while the previous
primary still stood, and a caller doing it in two statements can leave the
team with no lead). A null target clears the designation. `assistant_coach` is
deliberately ineligible: the point of the role is that it supports a lead
coach rather than being one.

**RLS filters a DELETE rather than raising it**, so a refused unassign matches
zero rows and looks like success. `unassignStaffFromTeam` now reads the row
count and says why — the count is the only signal there is.

Also fixed: `assistant_coach` was created in phase6l with real team-scope
permissions and then never offered a team assignment (`needsTeamAssignment`
was `coach || team_manager`), so every one of those permissions was
unreachable.

### Verified

RLS 65 → **77**. Driven live through the real UI as the club manager: assigned
a coach to a second team (the write that used to fail), saw "Make primary"
offered on exactly the one leaderless team, used it, and confirmed the audit
row attributed to the club manager. Showcase data restored after.

**Found while verifying, not fixed here:** the club console's Staff tab shows
every staff member except the viewer as "Unknown" with a blank email — the
embedded `users(name, email)` join is emptied by `public.users`' own SELECT
policy. Same class of gap as §0e's `it_club_directory()`. Flagged separately.

---

## 0j. Club entitlement P0 batch (2026-09-09)

`docs/club-entitlement-gap-analysis.md` scoped 25 recommendations before
Tournament-entitlement work begins. This lands the six P0 items — and, true
to the pattern of every phase in this session so far, verifying each one live
surfaced real bugs beyond what was originally scoped.

### P0-1 — the staff directory bug, fixed

`club_staff_directory()` (phase6z), gated identically to `club_staff_read`'s
own `can_read_club()` override — this fixes the broken name lookup for
whoever could already see the full roster; it does not widen who that is.
Verified live: the club manager's Staff tab now shows real names for all
seven staff, not "Unknown" for six of them.

### P0-2 — three dead guardian permissions, removed

`communicate_with_club`, `manage_availability`, `manage_forms` were granted
to every guardian by default and implemented nothing anywhere in either
codebase — not even referenced as a string. Removed from `permissions` and
`guardian_permission_defaults` outright (confirmed zero
`guardian_permission_grants` rows referenced them, so nothing was lost).

### P0-3/P0-4 — audit, both directions

Staff add/archive and team (re)assignment now call `write_audit()`
(`scope_type='club', scope_id=<club>` consistently, so they're actually
findable — see below). A read-only audit section was added to the IT page,
which had checked `view_audit_log` since Phase 4 and rendered nothing with
it.

**Found while wiring the read side:** `audit_log`'s own SELECT policy is
`is_org_admin(org_id)` only — a club_manager holding `view_audit_log` could
not read a single row. Same shape as phase6x's team-assignment bug: a
permission granted with no matching read path. Fixed with
`club_audit_log()` (phase6z1), the same narrow-RPC pattern as
`it_club_directory`/`club_staff_directory`, rather than widening
`audit_log`'s RLS (which also protects org-wide and tournament-scoped rows
this page has no business reading). The view is deliberately scoped to
`scope_type='club' AND scope_id=<this club>`, not `org_id` alone — an org can
own more than one club, and most existing `write_audit()` calls don't
consistently tag `scope_id` yet, so a broader filter would either leak a
sibling club's actions or require backfilling every call site. Under-showing
is the safe default here.

### P0-5 — club_staff gets a real lifecycle

`club_staff.status` (`invited`/`active`/`suspended`/`archived` — only
`active`/`archived` are live today; the other two are reserved for the
staff-invitation and deactivation work scoped as P1/P2, so that work is
additive, not another migration). "Remove" now archives rather than
deletes; team assignments ARE still deleted outright on removal, since
`user_assigned_teams` has no history concept of its own and a stale row
there would just make an archived person look like they're still on a team.

Six functions read `club_staff.role`; all six now also require
`status = 'active'`, checked exhaustively via `pg_proc.prosrc`, not
guessed: `is_org_member`, `is_club_staff`, `is_club_manager`,
`has_staff_permission`, `it_club_directory`, `effective_access_for`,
`start_impersonation`, `set_team_primary_coach`. Verified live: archiving a
coach drops `has_staff_permission`/`is_club_staff`/`is_club_manager` to
false immediately, while the row itself survives — a "Former staff" section
now renders it, read-only, no reactivation flow yet.

### P0-6 — club profile settings, and a second bug found live

`clubs.about`/`location`/`branding` existed with zero editing UI (seeded
directly by SQL). `EditNameForm.tsx` grew from a one-field rename into a
full profile form (name/about/location/logo), plus `src/lib/club-branding.ts`
establishing the org-vs-club precedence rule the gap analysis flagged as
undecided: **club branding wins when set, falls back to the org's**. The
logo goes through R2 (`shared/files/lib/r2` — CLAUDE.md's own §8 claim that
"R2 was never enabled" is stale; `media-actions.ts` already uses it live for
club photos), not inline base64 — added a `'branding'` category to
`uploadFile`'s type union alongside the existing `exports`/`media`/`documents`.

**Found while verifying live:** saving the profile form as the club manager
failed with "You don't have permission to do that" — on a plain rename, a
feature that predates this whole batch. `clubs_admin_write`'s `USING` clause
correctly reads `can_admin_club(org_id, id)` (club_manager OR org_admin),
but its `WITH CHECK` had narrowed to `is_org_admin(org_id) AND
org_has_product(...)`, silently dropping the club_manager branch. USING and
WITH CHECK on the same UPDATE policy describe the same intent; this asymmetry
was never deliberate. Fixed in `phase6z2` by rewriting the policy with a
matching `WITH CHECK`. The club rename button has, as far as can be told,
never actually worked for a club_manager — only for an org_admin — since the
policy was written.

### Verified

RLS suite 77 → **87**. Driven live end-to-end as the club manager: staff
directory shows real names; archived a staff member and watched them move
to "Former staff" while their permissions immediately zeroed out; the audit
log rendered the archive action and the earlier primary-coach-change and
impersonation events; edited the club's About text and confirmed it
persisted after a reload (only after `phase6z2` — the first attempt is the
bug recorded above). Logo upload verified at the RLS layer directly (a
native file picker can't be driven from the sandboxed preview browser, the
same limitation recorded in §0f) rather than through the UI.

---

## 0k. Club entitlement P1 batch (2026-09-09)

Five of the seven P1 items from `docs/club-entitlement-gap-analysis.md`
(7, 8, 10, 11, 12 — #9 was already covered by §0j's P0-6 settings work; #13,
IT's club-scoping, is deliberately held for the Tournament/org-hierarchy pass
per the user's own framing: "it will always be org then club/tournament").
Same pattern as every phase before it: verifying each item live surfaced
real bugs beyond the original scope.

### P1-11 — IT-owned suspend/reactivate, separate from the Manager's archive

`manage_account_status` (club_it_admin only) plus `set_staff_account_status()`
toggling `active` ↔ `suspended` — deliberately not touching `archived`, which
stays the club_manager's permanent, business-owned call (§0j). Both already
collapse to "not active" everywhere `has_staff_permission` and friends check
status, so no further authorization changes were needed; `it_club_directory()`
widened to include `suspended` (not just `active`) so there's something to
reactivate, still excluding `archived` — nothing to view-as or reactivate for
someone who's actually gone. New "Accounts" section on the IT page. Verified
live: suspended a staff member as the IT admin, watched their audit-visible
status flip and the button relabel to "Reactivate", reactivated them back.

### P1-7 — staff profiles (phone, bio, photo, certifications)

`staff_profiles`, keyed 1:1 on `club_staff.id` (not `user_id` — the same
person coaching at two clubs plausibly wants different info on file at each).
Self-service by default (`staff_profiles_write`'s RLS: self OR
`can_admin_club`), photo through R2 (`shared/files/lib/r2`, new `'profile'`
category) same as the club logo. StaffRow.tsx shows read-only bio/phone/certs
for everyone, an edit form only on the viewer's own row.

**Found live:** routing every staff-name lookup through `club_staff_directory()`
(§0j's own P0-1 fix) regressed a coach's ability to see *their own* name —
the RPC was gated on `can_read_club()` alone, dropping the self-branch
`club_staff_read`'s base policy always had. Fixed in `phase7c` by adding
`or cs.user_id = auth.uid()` back. A fix built to close one gap silently
opened a narrower one; caught only because P1-7 exercised a plain coach's own
row, which §0j's own verification hadn't happened to.

### P1-8 — staff notifications, real trigger wired

`staff_holding_permission(club_id, permission_key, team_id?)` — mirrors
`has_staff_permission`'s eligibility logic but enumerates every active staff
member holding it rather than checking one caller (deliberately a parallel
function, not `has_staff_permission` with a bolted-on target-user parameter —
that function is keyed to `auth.uid()` at six call sites since `phase6z`, and
overloading it risked one of them silently taking the wrong branch).
`notifyStaff()` in `notify.ts` is the staff-facing counterpart to
`notifyAboutPlayer()`. Wired to one real trigger: a guardian **declining** a
tournament roster acknowledgement now notifies whoever holds
`finalize_tournament_roster` for that team — approving can wait until the
coach next opens the roster; a decline is exactly the thing they previously
only found out about by happening to check. Verified live end-to-end: Mylene
Bautista declined Angelica's Copa Gali acknowledgement with a reason; both
Rodrigo (coach) and Benigno (team manager) got real notification rows with a
working `link_path` straight to the roster.

### P1-10 — a real support/escalation path to Platform Admin

`support_requests` + `support_request_messages`, keyed on `org_id` alone —
deliberately no `club_id` column, so a Tournament-only org needs zero schema
changes to use the identical path once that entitlement exists. New
`submit_support_request` permission (club_manager + club_it_admin).
Eligibility has no club_id of its own to check against, so the RLS evaluates
"holds the permission at *some* club in this org" by joining every club the
caller staffs — the only nontrivial predicate in the whole feature. New
`/c/[clubSlug]/support` (file, reply) and a "Support" tab in
`/platformconsole` (status transitions, reply) — status is platform-owned
once filed; the org side follows up via messages, never by editing the
ticket.

**Found live:** the platform console's queue silently rendered "no requests"
for an org that had just filed one. `created_by`/`author_user_id` referenced
`auth.users(id)`, not `public.users(id)` — the convention every other
user-referencing FK in this schema follows specifically because
`auth.users` isn't exposed to PostgREST's embedding, so
`users!created_by(name, email)` had no relationship to find, and the page's
own `{ data: requests }` destructure never checked `error` to surface it —
the exact silent-failure shape Phase 5c's RETURNING trap and others have hit
before. Fixed the FKs in `phase7f`, and added the missing error check so this
failure mode can't hide again.

### P1-12 — three dashboards down to two, one attendance formula

`ClubDashboardStats.tsx` deleted; its tile grid folded into `Reports.tsx` as
a "Club-wide" section shown only when the caller's own `dashboard` data
exists (unchanged permission boundary — `staff`-role viewers who reach
Reports via `canManageFinances` but aren't `club_manager` simply get `null`
there, same as before). `ActionCenter` stays separate — action-first "what do
I need to do today" is a genuinely different job from Reports' after-the-fact
visibility. `src/lib/attendance-stats.ts`'s `computeAttendancePct()` replaces
three independently-written copies of the same exclude-injured/suspended,
count-present-or-late, round-to-percent formula (the club-wide dashboard,
`ActionCenter`'s per-team snapshots, `Reports`' own per-team table) — the
underlying queries genuinely can't merge (different audiences see different
team sets), but the arithmetic had no reason to be copied three times.
Verified live: Teams/Players/Staff tiles read 3/34/7 correctly inside Reports,
Overview now shows only `ActionCenter`.

### Verified

RLS suite 87 → **103**. Every item driven live through the real UI (as the
relevant persona, not just at the database) with a browser-automation
limitation worth recording: this session's tab intermittently failed to
propagate real click events after several dev-server restarts (clicks
registered a screen coordinate but never reached React's handlers, and
`AnimatedNumber`'s `useInView` never fired in a stale 0×0-viewport tab) —
worked around by opening a fresh tab and, where clicks still didn't land,
dispatching them via `element.click()` directly. Noted here rather than
silently switched to SQL-only verification, since every item in this batch
did get a real end-to-end pass once the workaround was in place.

---

## 0l. Tournament RBAC foundation (2026-09-09)

The user's own "tournament.md" proposal, reconciled against three realities
the proposal itself didn't account for: the Tournament Manager (Vite) app is
frozen (§8) and keeps its own `org_members.role` (admin/team/referee/
official/audience) untouched; two dead tournament-role vocabularies already
sat in the schema (`tournament_members`, 0 rows, wrong vocabulary;
`access_requests`, 0 rows, and — found while reviewing it — a *live*
unauthenticated write hole, `WITH CHECK (org_id is not null)` with no auth
check at all); and Club's permission-catalog architecture
(`permissions`/`role_permission_defaults`/`has_staff_permission`) is the
right foundation to extend, not a parallel system to invent.

Both dead tables dropped as part of landing this.

### Three decisions, confirmed before building

1. **Team Coordinator reviews/flags; Organizer alone decides.**
   `review_tournament_entry` (Team Coordinator) is seeded in the catalog but
   not wired to anything yet — same "permission exists ahead of its
   consuming feature" pattern as several Phase 0 club permissions.
   `decide_tournament_entry` (Organizer) is the real accept/reject
   authority, via a dedicated RPC (below).
2. **Tournament Director / Competition Manager fold into Organizer** —
   Organizer absorbs `manage_competition` (divisions/brackets/scheduling/
   standings) as its own catalog entry, so it can be delegated to a
   separate role later without inventing one from scratch, but nobody holds
   it exclusively yet.
3. **External Organization access is a registration-form list, not an
   account-creation step.** A registering team lists who should get access;
   access is provisioned automatically on entry acceptance via an
   email-match self-claim, mirroring the guardian-invite flow's shape
   deliberately, not the alternative (creating real accounts at submission
   time, before anyone's decided the entry is even legitimate).

### The Tournament Role layer — `tournament_staff`

Mirrors `club_staff` exactly, status lifecycle included from day one
(`invited`/`active`/`suspended`/`archived` — `club_staff` took two
migrations, phase6z and phase7a, to get there; no reason to repeat that
here). Nine roles: `organizer`, `tournament_it_admin`, `team_coordinator`,
`secretary`, `treasurer`, `logistics`, `communications`,
`volunteer_coordinator`, `referee_coordinator`. `secretary`/`treasurer` are
deliberately the same STRING as their `club_staff` counterparts — same
real-world role, different table, no actual (role, key) pair collision
(confirmed, not assumed — see the scope-leak bug below, which is exactly
what checking this for real caught).

`tournament_it_admin`, not `tournament_admin` — mirrors `club_it_admin`
precisely, avoiding the exact trap `club_admin` caused (phase6k): a bare
"admin" string that sounds like supreme authority but structurally means
zero business permissions.

`is_tournament_staff`/`is_tournament_organizer`/`can_read_tournament`/
`can_admin_tournament` mirror their club equivalents 1:1, including
`can_admin_tournament`'s `is_org_admin` bootstrap path — the same problem
`club_manager` had (nobody below org_admin could ever add the first one)
fixed from the start instead of found live later.

**`has_tournament_permission(key, tournament_id)` has no team-fence
branch** — there's no entry-level narrowing yet (deferred until a real need
shows up, same restraint as everywhere else in this project), so
`permissions.scope` plays no role in it the way it does in
`has_staff_permission`'s team-fence bypass logic. That made it safe to
**reuse** three permission keys wholesale instead of duplicating them —
`view_audit_log`, `manage_account_status`, `submit_support_request` are
conceptually identical regardless of club vs. tournament context. 12 new
keys exist for genuinely tournament-domain concepts with no club analog
(`manage_tournament`, `manage_competition`, `decide_tournament_entry`,
`review_tournament_entry`, `manage_tournament_staff`,
`manage_tournament_documents`, `manage_tournament_finances`,
`view_tournament_finances`, `manage_tournament_logistics`,
`manage_tournament_communications`, `manage_tournament_volunteers`,
`manage_officiating`).

**A real bug found by re-checking the function's own logic, not by waiting
for a live test:** the first version of `has_tournament_permission` had no
scope gate at all. Since `role_permission_defaults` is one flat `(role,
key)` table with no table-awareness, and `secretary`/`treasurer` hold rows
spanning BOTH club and tournament meanings, a tournament treasurer calling
`has_tournament_permission('view_player', ...)` would have returned `true`
— not because anything granted it, but because `'treasurer'` happens to
hold that row for an entirely different table's purpose. Confirmed live
before fixing (`select exists(... role='treasurer' and
permission_key='view_player') → true`), then fixed by gating on
`perm.scope = 'tournament'` with an explicit allow-list for the three
reused keys (whose own catalog row still says `scope='club'`, since they
were never duplicated). Pinned by an RLS test now (`121/121`,
"does NOT get view_player just because the role string is shared").

`tournament_staff_directory()` and `tournament_audit_log()` shipped
**with** the permission they back (`view_audit_log`), not after — phase6z's
club version needed a whole P0 item to retrofit the read path once someone
noticed `view_audit_log` was granted and nothing rendered it.
`tournament_staff_directory()` also included its self-visibility branch
from the start — phase7c had to add that back to the club version after it
regressed a coach's own name.

### Entry decisions and officiating

`decide_tournament_entry(entry_id, status)` is a real RPC, not a raw RLS
policy — audited from day one via the same `write_audit()` pattern, rather
than needing its own P0-style retrofit later. Authorizes on
`decide_tournament_entry` (the new permission) **or** `is_org_admin` — the
org-admin fallback stays, same reasoning as `port_squad_to_tournament`'s own
club-less-entry branch (phase6t): a club-less entry has no
`tournament_staff` row bootstrapped yet either, in the general case.
`tournament_entries.status`'s real vocabulary is `pending/accepted/
declined/withdrawn` (its own CHECK, phase3) — not `rejected`, caught by the
constraint on first live test and fixed same-session (phase8c1).

Officiating: `tournament_officials` (assignment to *this* tournament's
matches) gets Referee Coordinator's `manage_officiating` permission,
OR'd alongside the existing `org_admin` path. `org_officials` (the org's
whole pool of officials, spanning every tournament that org runs, no
`tournament_id` column at all) deliberately **stays `org_admin`-only** —
it isn't tournament-scoped data, so routing it through
`has_tournament_permission` would mean picking one arbitrary tournament's
Referee Coordinator to authorize a change to an org-wide resource, which
has no principled answer.

`support_requests`' eligibility (phase7e) is widened to also recognize
`tournament_staff` holding `submit_support_request` — fulfilling the
promise made when that table was built ("generic over org_id from day
one... needs zero changes for Tournament"). The schema needed none; only
the read/insert predicates gained a second OR-branch mirroring the
existing club one.

### External Organization access — `tournament_entry_contacts`

A team registering from outside Dula HQ has no club and no org membership
— no `club_staff`/`tournament_staff` row to hang a permission bundle on.
The registration form lists who should get access (name/email/role ∈
`{team_manager, coach}`); rows start `pending` (purely informational,
matching the proposal's own "Coach... captured as team information unless
the tournament requires it"). `decide_tournament_entry` flips the
`team_manager` contact to `invited` automatically on acceptance — "once
approved, access will be provisioned" as a direct consequence of the
accept, not a second manual step. Coach contacts stay `pending` unless
separately invited — a deliberate, non-automatic act.

Access is self-claimed by email match, deliberately mirroring the
guardian-invite flow's *shape* (an invite is nothing but a row with a
matching email and a status flag; RLS is the entire boundary — no tokens,
no email sending, same interim workaround the guardian flow already lives
with) but with an **explicit, narrow predicate** rather than an inherited
assumption. Checking `guardians_read`'s actual policy while building this
surfaced that its own "own pending invite" claim depends on
`is_staff_in_org(org_id)` — which a genuinely cold invitee, with zero prior
relationship to the org, would fail. **Not fixed here** — out of scope for
this pass, worth its own look — but not repeated: `tec_read`/
`tec_self_claim` match purely on `lower(email) = lower(auth.jwt()->>
'email')`, no org relationship required.

`claimPendingTournamentEntryInvites()` (new, `server.ts`) mirrors
`claimPendingGuardianInvite()`'s shape exactly, called alongside it from
the root layout on the same "no `public.users` row yet" gate — with one
real difference: a person can hold more than one pending invite (an
external org submitting two teams to the same tournament, say), so it
claims every matching row in one pass, not just the first
(`claimPendingGuardianInvite` uses `.maybeSingle()`; this doesn't). The
"ensure a `public.users` row exists" logic both share was factored into
`ensureDulaUserRow()` rather than duplicated a second time.

`is_tournament_entry_contact(entry_id, min_role?)` mirrors
`is_assigned_to_team()` — a fact about one specific assignment, not a role
with a permission bundle. Entry-scoped, not tournament-wide.

### What's deliberately NOT in this pass

- **No generalization of Club's existing impersonation/audit functions**
  (`start_impersonation`, `effective_access_for`, `it_club_directory`,
  `club_audit_log`) to also cover tournaments — and this is now a
  **confirmed, final decision, not a deferral.** Gap analysis P1-#13 asked
  whether IT authority should become org-scoped, with club-scoping as a
  narrowing; the user's explicit ruling (2026-09-09, after this build
  landed) rejected that direction outright: **`club_it_admin` and
  `tournament_it_admin` stay scoped to their own entitlement, each with
  its own separate audit log** — no `org_it_admin` unification, ever.
  `tournament_it_admin`'s own `tournament_audit_log()`/
  `set_tournament_staff_account_status()` (same narrow-RPC pattern already
  proven three times on the club side) already matches this ruling
  exactly, so no further code change follows from it — it closes P1-#13
  rather than reopening it. `docs/club-entitlement-gap-analysis.md` §11/§13
  updated to record the resolution.
- **No Tournament Organizer console UI, no external registration form UI.**
  This pass is the authorization layer only — tables, permission catalog,
  resolver functions, RLS. Verified end-to-end via direct RLS/RPC calls
  (SQL impersonation and a real RLS test suite run), the same verification
  depth every schema-only phase in this project has used; there's no
  consuming page yet to click through.
- **`review_tournament_entry` is seeded, not wired.** No UI or workflow
  consumes it yet — matches how several Phase 0 club permissions existed
  before their features did.

### Verified

RLS suite 103 → **121**. `npx tsc --noEmit` and `npm run build` both clean.
Every authorization boundary confirmed via direct RPC/RLS calls against a
real tournament and a real club-backed entry in the showcase org: a
club_manager refused to bootstrap themselves as Organizer, an org_admin
successfully bootstrapping one; the scope-leak bug reproduced and then
disproven after the fix; `tournament_staff_directory`'s self-branch;
`decide_tournament_entry` refusing a non-organizer and succeeding (audited)
for the Organizer; `tournament_officials` writes refused before
`manage_officiating` was granted and allowed after; the full
`tournament_entry_contacts` claim cycle (invite → wrong-email refusal →
matching-email self-claim → `is_tournament_entry_contact` recognizing it).
Showcase data restored after every test.

---

## 0m. Syncing an external commit; billing fixes; the cross-org "backdoor" (2026-09-11)

Two commits (`3ade9b6`, `eb05901`) landed directly against this repo/origin
between sessions — a large billing domain plus
`docs/platform-implementation-roadmap.md`, generated by a different tool
("arenaai") the user also uses. This section covers three things done in
sequence: syncing that work safely, closing the real gaps a gap analysis
found in it, and building the one genuinely new capability the user asked
for — Platform Admin troubleshooting across **both** entitlements, layered
on top of (not replacing) the existing club- and tournament-scoped IT roles.

### What the sync found, and fixed

The external commit **deleted §0l of this file and all 18 RLS tests for
`tournament_staff`/`tournament_entry_contacts`**, with nothing added back —
confirmed via `git diff f818ac8 3ade9b6`: 212 lines removed, 0 added, on
both files. The underlying schema was untouched and stayed live throughout
(phase8a–phase8d never left `list_migrations`), so this was a documentation
and test-coverage loss, not a functional regression — but a real one:
neither existed until restored here from `f818ac8`, along with the
`tournament_staff`/`tournament_entry_contacts`/`tournament_staff_permission_grants`
type definitions in `database.types.ts`, which the same commit had also
dropped. A stray, garbled tracked file (a `git diff --stat` output that
ended up committed under a broken Unicode filename) was removed.

**The 14 billing migrations turned out to already be live**, just untracked
— `apply_migration` failed on the first file with "policy already exists",
which led to checking directly: every table, function, and seed row from
all 14 files was already present and byte-matching, applied out-of-band at
some point outside this session and outside `supabase_migrations
.schema_migrations` (confirmed function-by-function via `pg_get_functiondef`).
**One piece was genuinely missing**: `provision_product_billing_account()`
and its two triggers — the backfill inserts from
`billing_context_provisioning.sql` had run, but the trigger definition at
the bottom of that same file hadn't, so any *newly* created club or
tournament would silently get no billing account. Applied as its own patch
migration. (Registering the 14 untracked files into `schema_migrations`
directly was attempted and declined by the environment's own safety
classifier as a system-table write; harmless to leave as-is — the local
`.sql` files already match what's live.)

Two real, fixable bugs found while verifying the billing work, both closed:

- **The "Create invoice" form could never succeed.** `BillingConsole.tsx`'s
  form never collected a `billingAccountId` — `createPlatformInvoice`
  required one and every submission failed with "billing account… required".
  Fixed by looking the account up server-side from `orgId` instead (a
  platform account is 1:1 per org, enforced by
  `billing_accounts_platform_org_uidx`), removing the need for the UI to
  supply an id it never had a field for.
- **Billing reads were wide open.** `billing_domain_foundation.sql`'s own
  comment admitted the initial `is_org_member(org_id)` read policies were
  temporary ("Product-specific staff narrowing is added with the
  corresponding Club/Tournament billing UI and policies") — true for the
  *write* side (`billing_creator_scope`/`billing_reviewer_scope` correctly
  gate on `has_staff_permission('manage_finances', …)` for club and
  `is_org_admin` for tournament) but never done for reads. As shipped, any
  coach, guardian, or player could read every invoice and payment
  submission belonging to their whole org — other families' amounts and
  payment references included. Fixed with two new helpers,
  `can_read_billing_account()`/`can_read_billing_context()`, mirroring
  `can_review_billing_invoice`'s own branching (platform admin always; club
  context needs `view_finances`/`manage_finances` at that club; tournament
  context needs `view_tournament_finances`/`manage_tournament_finances` at
  that tournament; the named payer always sees their own record), and
  rewired every `billing_*_read` policy to use them. Verified live: a plain
  coach dropped from reading their club's billing account to refused; the
  club manager (holds `manage_finances`) unaffected.

Not touched in this pass, flagged for later: tournament billing's write
side still authorizes on `is_org_admin` alone rather than
`has_tournament_permission`, per its own migration comment ("Tournament
review remains organizer-admin-only until Tournament Manager adopts the
shared tournament permission catalog") — and the tournament billing
*design* document proposes six new permission keys
(`manage_entry_invoices`, `verify_tournament_payment`, etc.) that don't
reconcile with the two already-live in phase8's catalog
(`manage_tournament_finances`/`view_tournament_finances`, already granted to
`organizer`/`treasurer`). Reconcile before building any tournament finance
screen — don't add both.

### The cross-org "backdoor" — `platform_impersonation_*`

The user's own framing: Platform Admin troubleshooting should work **across
both entitlements**, and this is **additive** — `club_it_admin` keeps its
own club-scoped view-as exactly as §0e built it, `tournament_it_admin`
keeps its own tournament-scoped one, unchanged. This is a **third, wider
tier** of the same proven pattern, not a merge of the other two (the
opposite of the `org_it_admin` unification the user explicitly rejected in
`club-entitlement-gap-analysis.md` §13).

`platform_impersonation_sessions` is a separate table from
`impersonation_sessions`, not a widened version of it — the club-scoped
table's guards (`club_id not null`, the club-membership check in
`start_impersonation`) are load-bearing for that tier and a nullable
`club_id` would need its own branch anyway, which is really this table in
disguise. Keyed on `org_id` alone, so it works for a Tournament-only org
that has no club at all.

`is_user_in_org(user_id, org_id)` generalizes `is_org_member`'s own
relationship checks (club staff, assigned coaches, guardians, players) to
an arbitrary target rather than `auth.uid()`, and adds the tournament-side
relationships `is_org_member` predates by two days (`tournament_staff`,
`tournament_entry_contacts`) — `is_org_member` itself couldn't be reused
directly since every branch is hardcoded to the caller.

`start_platform_impersonation()` mirrors `start_impersonation()`'s guards
exactly (non-empty reason, not yourself, capped 30–120 minute expiry, one
active session per actor, **platform admins are never impersonable** —
same rule, no reason to widen it for the bigger tier) but authorizes on
`is_platform_admin()` and checks org membership via `is_user_in_org`
instead of a club-specific check.

`effective_access_for_platform()` is the readout, and the reason it's not
just `effective_access_for()` called twice: it aggregates **every** club
and **every** tournament the target touches within that one org into a
single readout (a Combined-entitlement org's user could hold a bundle at
either or both), inlining `has_staff_permission`'s and
`has_tournament_permission`'s own default-plus-grants-minus-revokes logic
per membership found — both are keyed to `auth.uid()`, not a target
parameter, so neither can be called directly for an arbitrary user, the
same reason `effective_access_for()` already had to do this once.
Diagnostic only, same discipline as its club-scoped predecessor: never call
this from a policy.

Two small companions this needed and that close gap analysis findings
§1.2/§1.5: `org_people_directory(org_id)` — platform-admin-only, spans
`club_staff`/`tournament_staff`/`tournament_entry_contacts`/`org_members`
in one org, which the troubleshooting UI needs to know *who* to view as in
the first place (neither `it_club_directory()` nor
`tournament_staff_directory()` look past one club/tournament); and
`platform_audit_log(org_id?, limit?)`, since Platform Admin had no read
path into `audit_log` at all beyond the service-role key, the same gap
`club_audit_log()`/`tournament_audit_log()` already closed for their own
tenants.

UI: a new "Troubleshoot" tab in `/platformconsole` (org picker showing each
org's held entitlements inline, a people list via `org_people_directory`,
"View as" prompting for a reason, then the readout rendered per
club/tournament membership found). `ImpersonationBanner.tsx` (root layout,
every page) now checks both `my_active_impersonation()` and the new
`my_active_platform_impersonation()` and renders whichever is active,
distinguishing "Inspecting access as X" (club-scoped) from "Platform
troubleshooting: inspecting X in ORG" (the new tier).

**A real bug found live, not by inspection:** the Troubleshoot tab's own
embedded "Active session" banner went stale after clicking "End session" —
it kept reading "Active" because `activeSession` was a server-rendered prop
fixed at page load, and `revalidatePath()` invalidates the *next*
navigation's cache, not the already-rendered client tree. Confirmed at the
database the session really had ended (`ended_at` was set correctly) while
the UI lied about it. Fixed by lifting `activeSession` into local state
that `startPlatformViewAs`/`endPlatformViewAs` update directly, the same
class of fix `Directory.tsx`'s own entitlement checkboxes needed once
before (§0j-era: a controlled `checked={state}` that didn't update after a
successful save).

### Verified

RLS suite 121 → **129**. New coverage: a non-admin (even an org_admin)
refused; the platform admin refused against a user with no relationship to
the target org; a successful session against a real club_staff member
returning the correct role and permission bundle; the audit row attributed
to the platform admin's email, never the target's; `org_people_directory`
refusing a non-admin and returning real rows for the admin; ending a
session locking the readout back out immediately. Driven live end-to-end
through the actual UI too (`window.prompt` needed patching via
`javascript_tool` first — the sandboxed preview browser throws rather than
returning null on an unhandled `prompt()`, the same limitation noted for
`BillingConsole.tsx`'s own reviewer-note prompts): selected Usna Gali
(showing "club, tournament" inline), viewed as a team manager, got back
their real 16-permission bundle, confirmed the root-layout banner rendered
site-wide, ended the session, watched the tab's own banner correctly clear
this time. `npx tsc --noEmit` and `npm run build` both clean for every file
touched in this pass — a **pre-existing, unrelated** batch of ~114 type
errors in `tests/rls/club-manager-isolation.test.ts` was confirmed present
identically at `f818ac8` (before any of this session's changes, using
today's `node_modules`) via a stash-and-checkout comparison, so it predates
this work and is not a regression from it; left alone rather than
scope-creeping into an unrelated `@supabase/supabase-js` typings
investigation. `npm run test:unit` stayed 20/20 throughout (includes 3 new
billing-domain tests from the synced commit).

---

## 0n. Closing the gap-analysis findings that didn't need a product decision (2026-09-19)

`docs/platform-club-tournament-gap-analysis.md` left four findings open after
§0m. This fixes the ones that were purely engineering; the rest are listed at
the end because each one needs a decision, not a fix.

### Org suspension now actually suspends (phase9a) — the last open P0

`organizations.status` was written by the console's Suspend button and read by
**nothing** (grepped every policy and helper: zero matches). Two layers,
because neither alone is enough:

- **The helpers** (`is_org_member`, `is_org_admin`, `is_club_staff`,
  `is_club_manager`, `is_tournament_staff`, `is_tournament_organizer`,
  `is_assigned_to_team`, `has_staff_permission`, `has_tournament_permission`)
  each gained an active-org guard, with Platform Admin left outside it so a
  suspended org can still be seen and reactivated. This is the layer that
  matters for **SECURITY DEFINER RPCs**: they run as the table owner, RLS never
  sees them, and they authorize only through these helpers.
- **A generated RESTRICTIVE policy** (`org_not_suspended`) on every table with
  an `org_id` column (59 tables). A restrictive policy is ANDed with every
  existing permissive one, so it fences direct-table access without rewriting
  60+ policies — and, unlike a check inside `is_org_member`, it also covers the
  many policies that never call `is_org_member` (the `is_org_member` spine
  turned out to be much patchier than §0b implied: a query for policies lacking
  it found most tables).

Deliberately **not** fenced: `billing_*` (a org suspended for non-payment must
still be able to see and settle its invoice) and `support_requests` (it must
still be able to contact Platform Admin) — via `org_fence_exempt()`. The
**test is the guard**, same lesson as the anon-execute regression (§0g):
`org_tables_missing_suspension_fence()` must return nothing, so a new `org_id`
table fails the suite until it is fenced or consciously exempted.

Also: `my_suspended_orgs()` + `SuspendedOrgBanner` in the root layout, so a
suspended org's members are told *why* everything went empty rather than
guessing it's broken; `toggleOrgStatus` now writes `platform.org.suspended` /
`reactivated` to `audit_log` and asks for confirmation (it used to change a
label, so it never needed either); and the Troubleshoot readout says when the
inspected org is suspended, because it reports permissions "on paper" that
every gate is currently refusing — without that an inspector would see a
healthy bundle and look for the problem elsewhere.

**Known edges:** the public directory listing of a suspended org is unchanged
(the fence is `to authenticated`; hiding it is a separate decision).
`club_staff_directory()` still returns the caller's *own* row while suspended
(phase7c's deliberate self-branch) — their own name and email, nothing more. A
suspended platform-invoice payer (`payer_org_id` → `is_org_member`) can't submit
payment through `submit_billing_payment`; only invoices payable by a named user
stay payable. If suspension is meant for non-payment, that path needs
deciding.

Verified live before trusting it: suspending Usna Gali inside a rolled-back
transaction dropped a coach from 3 teams / 34 players to 0, made
`has_staff_permission` false, and produced the suspension notice, while Platform
Admin still saw all 3 / 34. **Not** driven through the Directory's Suspend
button in a browser: the environment declined a click that would suspend a real
tenant, and that was the right call — the RLS suite now suspends and
reactivates a fixture org instead.

### Club Finances gate → permission catalog, and the expenses gap behind it (phase9b)

`canManageFinances = isClubManager || role === 'staff'` predated the permission
catalog, so `treasurer` — created as the finance specialist — couldn't open the
tab. It's now `has_staff_permission('view_finances')` to see it and
`manage_finances` for write controls. **Cutting the UI over alone would have
recreated §0d's mismatch**: `fee_charges`/`payments` honour `manage_finances`
but `expenses` RLS was `can_admin_club` only (phase6m missed it), so the
treasurer would have had a tab whose expense controls the database refuses.
`expenses` now matches the fees policies.

### Tournament billing uses the tournament catalog (phase9c)

`create_billing_invoice` and `can_review_billing_invoice` accept
`manage_tournament_finances` (held by `organizer`/`treasurer`) alongside
`is_org_admin`, replacing the "organizer-admin-only until the catalog is
adopted" stopgap. The six keys `tournament-billing-integration.md` proposed
were **never added** and the doc now says so, pointing at the two live ones —
adding them would have built the second tournament permission vocabulary the
roadmap itself warns about. One coarse key covering create + verify is
deliberate; split it only when a screen needs segregation of duties.

### A regression in my own earlier fix, caught by writing its test (phase9d)

§0m narrowed billing reads so a payer sees only their own invoice — but the
guardian page reads an invoice together with `billing_accounts(payment_
instructions)`, and after narrowing a payer could no longer read the account
row, so they'd have lost the instructions for paying. Payers may now read the
account of any invoice they owe (`is_billing_account_payer`), and only those.

### Support queue shows what the org holds

Each ticket now carries the filing org's products (same active/trial filter as
the Directory) and an "org suspended" chip, so triage doesn't need a trip to
another tab.

### Verified

RLS suite 129 → **147**: the suspension fence guard; suspend → coach/manager/
org admin refused on helper, RLS and RPC paths while Platform Admin isn't →
reactivate restores immediately; a treasurer can record and read an expense and
a coach can't; billing reads (payer sees own invoice and its account, a
same-org non-payer sees neither, club manager sees both); tournament
treasurer can create a tournament invoice and a non-staff coach can't. Billing
previously had no RLS test at all. Two failures on first run were test
mistakes, not bugs (`view_player` is team-scoped and needs a `p_team_id`;
`club_staff_directory` deliberately returns the caller's own row). `tsc` clean
for all app code, `npm run build` clean, unit tests 20/20.

### Still open, and why

- **Two financial ledgers (P1-8) — resolved by scoping, not migrating.**
  `fee_charges`/`payments` stays the **club ledger of record** (it's wired into
  reports, notifications, the player profile and the payment-status trigger);
  the billing domain is for Platform and Tournament billing, where there is no
  legacy ledger, and for club-context invoices only once a club opts into
  manual QR payments. To keep that honest in the UI, the club Finances tab's
  billing section is hidden until a club invoice exists (renamed "QR payment
  invoices" when it does), so a club never sees two ledgers side by side. No
  backfill and no bridge; revisit only if a club actually wants QR payments.
- **Tournament organizer console + registration UI (P1-10)** — proposed, then
  **built; see §0o**. The proposal (`docs/tournament-organizer-console-proposal.md`)
  is what surfaced this, and the point stands: it
  found that an Organizer who isn't an org admin **cannot read**
  `tournament_entries` or `tournament_categories` (their reads use
  `is_org_member`, which has no tournament-staff branch), so the console needs
  targeted policy changes rather than just pages. `tournament_categories` also
  has no fee or capacity column, contrary to what the gap analysis assumed.
- **Entitlement lifecycle (P1-6) — trial/grace deferred; the latent bug fixed.**
  The Directory's "delete the row to turn a product off" is a recorded,
  deliberate choice, and there's no pricing or real usage to design trial/grace
  against yet. But re-saving the products form used to upsert **every** product
  back to `active`, which would have silently undone a `trial` the moment one
  existed. `updateOrgEntitlements` now writes only rows that need it: an
  existing `active`/`trial` row is left alone, and a ticked product whose row is
  `suspended`/`cancelled` is still re-activated (ticking it is how an admin
  turns it back on).
- The 14 out-of-band billing migrations are still absent from
  `schema_migrations` (the environment declined the direct write).

---

## 0o. Tournament organizer console (2026-09-19)

`/tm/[orgSlug]/[tournamentSlug]` — the first native Tournament workspace, built
from `docs/tournament-organizer-console-proposal.md` after the user confirmed
its four open decisions: **host-entered registration first** (no self-service),
**`entry_fee`/`capacity` added to categories**, **no Team Coordinator "flag" in
v1**, and the route as named. Closes gap analysis P1-10. Reached from a
"Tournaments you manage" section on `/tournaments` (`my_manageable_tournaments()`).
The bracket/scores engine is untouched and still proxied at `/t/...`, linked
from the header.

Three tabs, each permission-gated by the catalog and never by role name (an org
admin is treated as holding everything, mirroring every RLS policy's
`is_org_admin` path):

- **Entries** — filter by status, accept/decline through `decide_tournament_entry`
  (never a direct UPDATE, so it stays audited and still auto-invites the team
  manager contact), and a host-entered "Add entry" form (team, category,
  optional contact, optional registration-fee invoice). Entries are always
  created `pending`; a full category can't be picked.
- **Categories** — create/edit/delete with entry fee and capacity; deleting one
  that entries use is refused.
- **Staff** — directory, add by email, suspend/reactivate, remove (archives;
  shown under "Former staff", re-adding restores the same row), and the audit
  trail. `add_tournament_staff()` does the email lookup inside a definer
  function that authorizes first: an Organizer isn't an org member and can't
  read other users, and a general "find user by email" surface is the wrong fix.

### The finding that made this more than pages (phase10a)

An Organizer who wasn't also an org admin **could not read** the entries and
categories they were meant to decide — those tables read through
`is_org_member`, which has no tournament-staff branch. Fixed with targeted
policies keyed on `is_tournament_staff` (reads) and the permission catalog
(writes), **not** by widening `is_org_member`, which underpins ~60 policies and
would have handed tournament staff club and player data. Note
`can_read_tournament` is organizer-or-org-admin only, so it couldn't be reused
for reads: a `team_coordinator` or `treasurer` would still see nothing.
Writes: entries insert only as `pending` (acceptance must go through the
audited RPC) and pinned to the tournament's own host org; categories need
`manage_competition`; and **`tec_write` was tightened** — it let anyone passing
`can_read_tournament` write entry contacts with no check on which org the row
claimed, and contacts are how an outside person later gains entry-scoped
access. The RLS tests use users with **no org membership at all**, so passing
them proves the new policies rather than the old org-member ones; they were run
first and failed on today's database before the migration was applied.

### Three bugs found only by driving it as an org admin (phase10b/10c + UI)

- **Org admins couldn't read tournament billing.** The invoice step said "no
  billing account you can use". `create_billing_invoice` and
  `can_review_billing_invoice` accept `is_org_admin` for tournament billing, but
  §0m's read narrowing only accepted the tournament finance permissions — my
  mistake — so an org admin could issue an invoice and then not read the account
  or invoice they'd just created. Read and write now agree (phase10b).
- **The audit trail was empty and Suspend would have errored.**
  `tournament_audit_log` and `set_tournament_staff_account_status` accepted only
  the tournament permission, though an org admin can already read the raw audit
  rows and edit `tournament_staff` through RLS. Both now accept `is_org_admin`
  (phase10c) — no new capability, just the RPCs agreeing with the tables.
- **Removed staff still looked active** because the directory returns archived
  rows too. They now list under "Former staff".

### Verified

RLS suite 147 → **159**. Driven live in a browser as the Usna Gali org admin
against Copa Gali: entry queue, adding an entry with a contact and invoice
(₱500 tournament-context invoice tied to the entry), capacity limit and the
disabled "full" option, editing capacity, accepting (contact flipped to
`invited`), adding/suspending/reactivating/removing/re-adding staff, the
unknown-email error, and category delete. Showcase data restored afterwards.
`tsc` clean for app code, unit tests 20/20, `npm run build` clean.

### The non-org-admin path, driven for real (Organizer demo persona)

The demo had no way to test this — every persona belongs to Usna Gali — so a
**Tournament organizer** persona was added: Dennis Manalo, organizer of Tiger
Cup at Davao Unity Sports (tournament-only), with **no org membership at all**.
Created without the destructive full re-seed by `scripts/seed-demo-organizer.mjs`
(idempotent; also re-asserts the shared password) and added to
`seed-showcase-demo.mjs` so a re-seed keeps it, plus `/demo` and
`docs/demo-data-showcase.md`. Password `DemoPass2026!` like the others.

Driven in a browser as that account: the console loads with the tournament's 6
entries and 2 categories; `/tm/usna-gali/copa-gali` and
`/tm/pilipinas-futbol/tiger-cup` (same slug, different org) are both 404; the
landing page offers only Tiger Cup; they can create a category, add an entry
with a contact, **issue the entry-fee invoice** (created under their own
account — this is the finance path that broke for org admins, now shown working
for a permission holder), accept the entry (contact flips to `invited`), and add
and remove staff. They get **no Suspend button** — `manage_account_status`
belongs to the IT admin role, and the UI shows only what would succeed. Test
rows were removed afterwards; only the persona's own organizer row remains.

### Not built, and known edges

- **Not built:** self-service public registration, the Team Coordinator flag,
  officiating UI. (The finance queue, slice 5, was built afterwards — §0q.)
- ~~`write_audit()` has no authorization check~~ — fixed in §0p.
- `tournament_entries` has no `org_id` column, so the phase9a suspension fence
  doesn't cover it directly; it's protected through the guarded helpers its
  policies use, and the suspension test doesn't assert it.
- The archived-staff directory, the "issue invoice" default-on checkbox and the
  capacity check (a count-then-insert, so two simultaneous adds could exceed it
  by one) are deliberate simplifications at this scale.

---

## 0p. Audit-log integrity: `write_audit` gets an authorization check (2026-09-19)

`phase11a`/`a1`/`a2`. §0o flagged that `write_audit()` trusted every caller: any
signed-in user could write an audit row claiming any action in **any** org. The
actor is taken from the JWT, so nobody could frame someone else — but anyone
could pollute another tenant's trail, and integrity is the whole point of an
audit log.

### Why it couldn't just start checking membership

17 SECURITY DEFINER functions call `write_audit` internally, and some write into
an org the caller doesn't belong to on purpose (`port_squad_to_tournament`
records the hand-off in the **host** org as well as the entrant's). A blanket
membership check would have broken all of them.

So it is split in two:

- **`write_audit_system(...)`** — the old unchecked body. `EXECUTE` revoked from
  `public`/`anon`/`authenticated`, granted to `service_role` only. A definer
  function runs as the owner, so the 17 internal callers need no grant; a client
  cannot reach it. Every internal caller was **repointed mechanically** (the
  migration regenerates each definition from `pg_get_functiondef` and swaps only
  the call), so nothing else about those functions can drift. Verified 0 still
  call the old name, 17 call the new one, all still SECURITY DEFINER.
- **`write_audit(...)`** — same signature, so the 14 direct server-action call
  sites (6 files) needed **no code change**. It now requires the service role,
  Platform Admin, or `is_user_in_org(auth.uid(), p_org_id)` — org member, club
  staff, tournament staff, guardian, player or entry contact. A null org is
  Platform-Admin-only. Actor attribution is unchanged.

`phase11a2` exists because the first version (`a1`) refused the service role,
and the RLS suite's fixtures write audit rows through it. The service-role key
bypasses RLS everywhere else, so refusing it here only broke tooling.

**Rule going forward:** a new SECURITY DEFINER function that audits calls
`write_audit_system`; server actions call `write_audit`. Calling the checked one
from inside a definer function will refuse whenever the caller legitimately
isn't in the org being written to.

### Verified

RLS suite 159 → **168**, all passing (the 17 repointed functions are exercised by
the existing port / decide-entry / billing / impersonation / roster tests, which
is the real proof they still work). New coverage: a member writes for their own
org and is recorded as the actor; the same user is refused for an unrelated org
and no row lands; null org refused to ordinary users; anon refused; Platform
Admin allowed anywhere; `write_audit_system` not callable by a signed-in user;
service role still works. Caveat: the migrations were applied before the tests
were written, so they were not watched failing first. The "refused" cases would
fail against the old function (it accepted everything), so they do discriminate.

---

## 0q. Tournament finance queue (2026-09-19)

Slice 5 of `docs/tournament-organizer-console-proposal.md`: a **Finance** tab in
the organizer console, shown to anyone holding `view_tournament_finances` or
`manage_tournament_finances` (or an org admin). Summary tiles (billed /
collected / outstanding / to verify), the payment instructions teams read,
payments waiting for verification, and the invoice list.

### Two RPCs the queue turned out to need (phase11b / 11b1)

- **`record_billing_payment(invoice, amount, method, reference, note)`.**
  `review_billing_payment` only acts on a payment a *payer submitted*, but a
  host billing an entry usually receives cash, or sees a transfer on their own
  bank statement — nothing is ever submitted, so without this the only way to
  mark an invoice paid was Platform Admin editing rows, and the verify queue
  would sit permanently empty. Authorization is exactly
  `can_review_billing_invoice`'s, so **it widens nobody**: whoever can verify a
  payment can record one. It writes an already-`verified` submission plus its
  allocation (so the ledger has one shape however money arrived), refuses an
  amount above the balance instead of clamping it (someone typing a figure has
  made a mistake worth surfacing), and audits as `billing.payment.recorded`.
- **`update_billing_account_instructions` widened for TOURNAMENT accounts.** It
  was "platform admin only during the validation phase". The instructions are
  the host's own GCash/bank details, so making Platform Admin type them in for
  every tournament doesn't scale. Now org admin or `manage_tournament_finances`
  for a tournament account; **club accounts stay Platform-Admin-only** until the
  club side gets the same decision made on purpose. **This is a product call
  that was made here, not asked for** — say if the validation-phase restriction
  should stay. The UI passes the existing `qr_storage_key` back unchanged,
  because the RPC overwrites both fields and would otherwise erase a QR that
  Platform Admin had set.

### A bug in `review_billing_payment`, found by driving the screen (phase11b2)

Rejecting a payment left its invoice at `submitted_for_verification`, so the
invoice read "payment submitted" with nothing left to verify and no signal that
the payer needed to pay again. It now returns to `awaiting_payment` (or
`partially_paid` if money is already in) when the rejected submission was the
last live one — and **not** when another submission is still pending. Not the
invoice status `rejected`, which looks like the obvious choice: the payer-facing
page (`guardian/page.tsx`) lists only `issued` / `awaiting_payment` /
`submitted_for_verification` / `partially_paid` / `overdue`, so a `rejected`
invoice would vanish from the payer's own list and they'd lose sight of what
they owe. The fix is shared with Platform billing and club-context invoices, which
all go through this function.

### Verified

RLS suite 168 → **180**. The finance describe was written first and shown
failing (the RPCs didn't exist; the rejection test failed on the actual bug).
Covers: a treasurer records a partial then the remaining payment and the invoice
walks `partially_paid` → `paid`; over-balance, zero and unknown-method amounts
refused; a same-org coach, a different org's user and anon all refused; an org
admin who isn't tournament staff can record; a paid invoice takes nothing more;
each recorded payment is audited to whoever recorded it; the existing verify
path still works; instructions are editable by finance holders and org admin
but not by a coach or another org, and **club** instructions still refuse a club
manager and an org admin.

Driven in a browser as Dennis Manalo (organizer, no org membership) against
Tiger Cup with three test invoices: saved instructions (persisted, audited under
his email), verified one payment (moved to "Settled and closed", tiles and tab
badge updated), rejected another — first with no reason (blocked with a message),
then with one (invoice back to "Awaiting payment") — and recorded ₱40 cash with a
receipt reference (invoice "Part paid", one allocation). Test rows and their
audit entries were removed afterwards. `tsc` clean for app code, `npm run build`
clean, unit tests 20/20.

### Fallout worth knowing

- **The RLS suite left fixtures behind** the first time the finance tests ran,
  and the *next* run then failed in `beforeAll` with "user already registered"
  and skipped all 180 tests. `billing_payment_allocations.invoice_id` has **no
  cascade**, so a test's cleanup `delete from billing_invoices` fails silently
  for any invoice that took a payment. The cleanup now deletes allocations and
  submissions first. If the whole file ever shows every test skipped, look for
  leftover `@rls-test.local` users and `rls-test-org-*` orgs (delete allocations
  → submissions → invoices → tournaments → org → users, in that order).
  28 orphaned `rls-*` tournaments from earlier crashed runs (their orgs are
  gone, so they can't be cleaned by org) still sit in `tournaments`; harmless,
  not removed here.
- Not verified in a browser: the read-only Finance view (no role holds view
  without manage by default, so it is only reachable via a per-user grant), and
  the tab's absence for staff without a finance permission (covered by the
  page's permission gate and the read RLS, not clicked through).
- Still not built: **a team contact has no screen to submit a payment** (external
  entrants have an account only after acceptance, and nothing renders their
  invoice), so today the queue is fed by hosts recording payments themselves.
  The verify path is real and tested, but nothing in the UI creates a submission.

---

## 0r. Public directory: logo tiles and posters (2026-09-21)

The homepage, `/clubs` and `/tournaments` stopped being text lists. **Clubs are
logo tiles; tournaments are 2:3 poster cards** (chosen from four mock-ups; the
Courts link is a one-row strip). One set of components serves all three pages
(`PublicClubList`, `PublicTournamentList`) and one loader module,
`src/lib/public-directory.ts`, owns the query, the defensive filtering and the
logo resolution, so the pages can't drift.

### Where each image comes from

- **Club logo:** the club's own logo, else the org's `logo_url`, else a
  generated crest — the club-over-org rule already in `club-branding.ts`. The
  club logo is a private R2 key, so the server signs a 6-hour URL per request;
  **if signing fails the tile silently falls back**, because a directory page
  that errors over a logo is worse than one with a crest. `public_clubs` gained
  `logo_key` and `org_logo_url` (`phase12a`; `security_invoker` and its
  SELECT-only grants were checked afterwards, not assumed). Exposing the key
  grants nothing on its own — it is only a path.
- **Tournament poster:** `tournaments.poster_url`, a public URL in the existing
  `tournament-posters` storage bucket. Empty means "generate one".
- **Both** degrade to the generated art if the image fails to load (`onError`),
  not just when the URL is missing — signed URLs expire and files vanish.

### One drawing, two consumers

`src/lib/crest.ts` is pure, dependency-free and limited to syntax Node can
strip, so the React fallback and `scripts/seed-directory-art.mjs` (which imports
it straight from `.ts`) draw **the same crest**. Verified: the on-the-fly
fallback for a club whose logo I blanked looked identical to its seeded image.

- **It is injected as markup, and club names are user input.** Only fixed
  constants, validated `#RRGGBB` colors, and initials filtered to letters and
  digits can reach the string; a unit test feeds it a `<img onerror>` name and a
  `"><script>` accent and asserts nothing but its own tags come out.
- **Shape and fill alone weren't enough to tell clubs apart.** The first render
  had the two Gali clubs (same initials, same org accent) as near-twins — same
  shield, same green, different ring. A third variable (none / star /
  underline) fixed it, and a test now requires the seeded look-alikes to differ
  in **at least two** visible ways. Clubs are shields or roundels, tournaments
  always hexagons, so the kinds read apart at thumbnail size.

### Seed art (`scripts/seed-directory-art.mjs`)

Renders one crest per club (R2, `clubs.branding.logoKey`) and one poster per
tournament (`tournament-posters`, `poster_url`) with `sharp`. It only touches
the four showcase orgs, **skips anything that already has an image** so it can't
overwrite a real upload, and `--force` replaces the seeded ones (deleting the
old R2 object once the row points at the new one). `--preview <dir>` renders
locally and uploads nothing — that is how the images were reviewed before the
real run. `seed-showcase-demo.mjs` runs it last, but only warns if it fails, so
missing R2 credentials don't turn a good data seed into a failed one.

### Also fixed on the way

- The homepage logged React's duplicate-key error: two orgs both run a "Tiger
  Cup" and a "National Team Qualifiers", and rows were keyed by slug alone.
  Now keyed by `orgSlug/slug`.
- At phone width one column of 2:3 posters was ~500px each (over 3,000px of
  scrolling for five tournaments). Below 520px both grids go two-across.

### Known edges

- **Re-seeding leaves the previous run's R2 crests orphaned.** The seed wipes
  the showcase orgs (their clubs go with them) but nothing deletes the objects;
  they are small, and posters are overwritten in place so those don't pile up.
- Seeded posters have the tournament name printed in the art, and the caption
  below repeats it. Real organizer posters usually carry a title too, and the
  caption is what makes two "Tiger Cup" cards distinguishable (organizer, venue).
- Signed logo URLs are new on every render, so the browser can't cache club
  logos across page loads. Fine at four clubs; revisit if the directory grows.
- Poster text renders in the fallback sans (no Oswald on the machine running the
  seed); the app's on-the-fly crests do use Oswald where the page loads it.

### Verified

Unit tests 20 → **33** (initials rules, determinism, override validation, the
markup-injection case, the at-least-two-differences rule). RLS 180 → **187**:
anon sees a listed club's logo key and its org logo, sees **nothing** of an
unlisted club (the key included), sees nothing once the org is suspended, gets
null for a club with no logo, and still can't write through the view. Driven in
a browser as a guest: real logos and posters load (club logos as signed R2
URLs), links are right (`/c/<club>`, `/t/<org>/<tournament>`), the console is
clean, `/clubs` and `/tournaments` render the same components, and a club and a
tournament with their images blanked showed the generated versions — both were
restored to their exact original values afterwards. `tsc` clean, build clean.

---

## 0s. How-to guides, and the product gaps writing them found (2026-09-21)

`docs/guides/` — role guides written from the code, the live database and the demo
accounts. **Complete:** `README.md` (start here), `platform-admin.md`,
`org-admin.md`, `club-manager.md`, `club-it-admin.md`, `coach-and-team-manager.md`,
`club-office-roles.md`, `tournament-organizer.md`, `tournament-staff.md`,
`guardian-and-player.md`. Each has a "last checked" date and a "not available yet"
list, on purpose: a guide that describes a feature that doesn't exist is worse than
none.

### The permission tables are generated, and that is the point

The tables of "what this role can do" are not typed. `scripts/lib/guide-
permissions.mjs` renders them from the live catalog (`permissions`,
`role_permission_defaults`, `guardian_permission_defaults`) between
`<!-- BEGIN permissions: club:club_manager -->` / `<!-- END permissions -->`
markers; `npm run docs:permissions` rewrites them and `docs:permissions:check`
fails if any is stale. **The RLS suite runs the same check against the live
database**, so changing a role's bundle without regenerating fails a test — I
corrupted a table to confirm it fails with the file name and the fix in the message.

- **A second reach fix, found writing the tournament guides:** the three shared keys
  are catalogued as club-scope, so a tournament role's table said "Whole club" for
  them. In a tournament context they now read "This tournament".
- The marker is `<context>:<role>` because `secretary` and `treasurer` are one
  string across the club and tournament worlds (§0l). A club context keeps
  club/team-scope keys; a tournament context keeps tournament-scope keys plus the
  three shared ones (`view_audit_log`, `manage_account_status`,
  `submit_support_request`). A marker that resolves to nothing throws instead of
  rendering an empty table, since that is nearly always the wrong context.
- **A bug the first render exposed:** the club manager's team-level permissions
  were labelled "Assigned teams only". `has_staff_permission` short-circuits the
  team fence for `club_manager` (§0i), so they reach every team. The renderer now
  says "Every team in the club" for that role; other roles keep the narrow wording.
  Worth remembering: a generated table is only as right as the rule that labels it.
- Platform admin and org admin have no table: they are identities (`platform_
  admins`, `org_members`), not catalog roles.

### Gaps found while checking the guides against the app

**Gaps 1–3 were fixed afterwards (§0s.1 below); 4–7 are open.** Each guide documents
the current behaviour honestly and points at the workaround.

1. ~~**An org admin cannot add staff to a club — so nobody can appoint the first
   club manager.**~~ **Fixed.** `AddStaffForm` renders only for `is_club_manager`, which is false
   for an org admin, and the `/clubs/new` page tells them to "add yourself or someone
   else as club_manager on the club's page". Confirmed live as the Usna Gali org
   admin: badge "No access here", "My teams (0 of 3)", no form. It is a **UI-only
   gap**: `club_staff_write` is `can_admin_club`, which includes org admins. Today a
   platform admin has to do it (`is_club_manager` is true for them).
2. ~~**Guardians and players land on the public homepage after a normal sign-in, with
   no link to `/guardian` or `/player`.**~~ **Fixed.** Login always redirects to `/`; the only
   routes into those pages are the `/demo` buttons and notification links. Confirmed
   live as Mylene Bautista.
3. ~~**An org admin's Tournaments tile opens the tournament engine (`/t/<org>`), and
   nothing links to the native console.**~~ **Fixed.** `/tournaments` ("Tournaments you manage")
   and `/tm/<org>/<tournament>` are reachable only by typing them.
4. ~~**Nothing can list a club or tournament publicly.**~~ **Fixed (below).** `publicly_listed`
   defaults to `false`; only tournaments had a checkbox (in the tournament app's platform
   console), clubs none, so the directory only showed clubs set by direct database writes.

5. ~~**Club office roles can't be given a team, so their document, membership and fee
   permissions have no screen.**~~ **Fixed (§0s.3 below), and turned out to be three
   bugs, not one.** `TEAM_SCOPED_ROLES` in `StaffRow.tsx` was coach, assistant coach
   and team manager only; a player's profile opened only for someone assigned to the
   team (`view_player` is team-scoped). Confirmed live as the demo `staff` user:
   every team said "Not assigned", the team page showed 0 players, and the Finances
   tab offered only "+ Add expense". A treasurer therefore couldn't record a fee
   charge or payment, and there was no club-level way to add a charge.
6. **Six tournament roles hold a permission that no screen uses** (team coordinator,
   secretary, logistics, communications, volunteer coordinator, referee coordinator).
   The console has Entries, Categories, Finance and Staff only. Also worth knowing:
   non-organizer staff can read entries but **not** the contacts (`tec_read` is
   `can_read_tournament`, organizer or org admin) — a good boundary, but the guides
   originally claimed otherwise until the policy was read.
7. ~~**The roster's inline player panel has five tabs and no Documents; the full profile
   has six.**~~ **Fixed (below).** Documents was reachable only via "Open development
   profile →", so a secretary or staff member, whose whole role is documents, had no
   obvious way to it.

Smaller: ~~there is no "create team"~~ (fixed, below), no staff sign-up page (the app links a login by email but never creates one), and
no "forgot password" link. These were known; the guides now say so where a reader
would hit them.

### Fixing gaps 1–3 (2026-09-21) — and the bug underneath gap 1

`phase12b`, `phase12b1`. Checking why gap 1 was a *UI-only* gap turned up that it
was not only a UI gap: **"Add staff" and "Link player login" have been broken for
everyone except a platform admin.** Both did `select id from users where email = …`
from the client, and `public.users`' SELECT policy (`users_read_self_and_org`) exposes
only your own row, a platform admin's view, or rows with a `role_assignments` entry in
your org — and `role_assignments` is still empty (§0d). So the lookup returned nothing
and the action reported "no account", even for a club manager adding a real user. Only
the platform admin passed, which is why it looked fine in every earlier walkthrough.
Widening `users` reads would expose every account's email to any tenant, so the fix
follows `add_tournament_staff` (§0o): the lookup moves into a SECURITY DEFINER
function that **authorizes first**, then looks up.

- `add_club_staff(club, email, role)` authorizes on `can_admin_club` (club manager or
  org admin) and audits via `write_audit_system`. Adding someone whose row is
  `archived` **restores** it; an active duplicate is a `unique_violation`. Its team
  assignments are not restored — they were deleted on archive (§0j).
- `link_player_account(player, email)` authorizes exactly like `players_write`, so
  nothing widened.
- **The org admin's UI:** the club page computes `canAdminStaff = canManage ||
  is_org_admin` for the Add-staff form and the Former-staff list. **Remove** is gated
  on the same flag. Before, every staff member saw **Remove** and got a refusal;
  RLS was always right, the button was not. Primary-coach designation, rename and
  team linking stay club-manager-only on purpose (`set_team_primary_coach` needs
  `manage_staff`, which an org admin doesn't hold).
- **Guardian/player landing:** `personaLanding()` (`src/lib/persona-landing.ts`, pure,
  unit-tested) redirects "/" to `/guardian` or `/player` for someone with **no
  organization and no tournament to manage**. A coach whose child plays for the club is
  a guardian too and keeps the org home; a top-bar **My children** / **My profile**
  link (`personaLinks`) reaches the page from anywhere.
- **Tournaments you manage** strip on "/" (`my_manageable_tournaments()`), linking
  `/tm/<org>/<tournament>`. Tournament staff have no org membership, so `hasOrg` is
  false for them; the redirect deliberately skips anyone who manages a tournament, or
  they would be bounced past the only link to their console.

**A second gap, found doing this and fixed the same day (`phase12c`):** the Add-staff
role dropdown had no `club_it_admin`, so an IT admin couldn't be appointed from the UI
(only seeded). Since that role carries no business authority (§0e), appointing one was
deliberately kept narrower than the other roles: `add_club_staff` now requires
`is_org_admin` specifically for `p_role = 'club_it_admin'`, on top of the
`can_admin_club` check every role already needed — a club manager still adds everyone
else, but not this one. The form only offers the option when `is_org_admin` RPC says
so, so a club manager never sees a choice the database would refuse. Verified: two more
RLS tests (an org admin can appoint one; a club manager cannot and nothing is written),
written before the migration and watched the manager-refusal test fail first.

**Known edge (since closed, see "Two loose ends closed" below):** the Staff tab's "Assign to
team" and "×" controls were ungated in the UI, so a team manager saw ones the database refused.

Verified: unit tests for the landing rules; RLS tests for the org-admin staffing
contract (11, including restore-on-re-add and the club-IT-admin appointment split) and
the definer lookups (16), written before the migrations and watched fail. Driven live
in a browser: the org admin's club Staff tab, a guardian's normal sign-in (lands on
`/guardian`, nav link present) and the demo
organizer's homepage (strip present, not redirected).

### Fixing gap 5 (2026-09-22/23) — club office roles, and two bugs found underneath it

`phase12d`, `phase12d1`. Asked as "club office roles team assignment" -- widen
`TEAM_SCOPED_ROLES` (StaffRow.tsx/page.tsx) to also offer treasurer/secretary/
staff a team, matching how assistant_coach was added in phase6x. That part
needed **no migration**: `uat_insert` authorizes on the ASSIGNER's own
`assign_team_staff`/`is_org_admin`, never on the assignee's role, so a club
manager could already put any `club_staff` row on a team -- only the UI array
was stopping it.

Verifying that live surfaced something bigger: **`players_read` has never
consulted the permission catalog at all** -- only `is_assigned_to_team`,
`can_read_club` (club_manager/org_admin only), or guardian/self. So even after
team assignment, a treasurer's `manage_finances`/`view_finances` -- club-scope
permissions, exactly like `fee_charges`'/`memberships`'/`document_uploads`' own
policies already honour club-wide -- only worked on the ONE team they'd been
assigned to, not the whole club their permission was supposed to reach. Worse:
the club-wide **Finances tab**, reachable with no assignment at all since
`view_finances` is club-scope, was already showing every fee charge -- with
**"Unknown" as the player name** for anyone outside the viewer's own assigned
teams, confirmed live via SQL impersonation before writing a single line of
fix (a `staff` role's embedded `players(name)` came back null while the
`fee_charges` row itself read fine).

Fixed by giving `players_read` the same club-scope branch its three dependent
tables already have: read access for whoever holds `view_finances`,
`manage_finances`, `manage_documents` or `manage_membership` at that player's
own club. Read only -- `players_write` is untouched, so a treasurer still
cannot rename a player, only see who they are.

**A second bug, found pinning the first one with a test rather than by
inspection:** all 108 real players in the database have `club_id` set, which
looked like nothing to check -- until tracing how they got it showed no
trigger or default ever sets it, and `addPlayer` (`teams/[teamSlug]/
actions.ts`) receives a `clubId` parameter and never uses it. Those 108 are
all seeded directly; the next player added through the live "+ Add player"
form would have been the first with a permanently null `club_id`, invisible to
the branch just added. `fill_org_id_from_parent` already derives `org_id` from
`team_id` on insert; `club_id` gets the same treatment now
(`fill_club_id_from_team`, a new trigger) rather than a one-off fix in the
action, so every insert path is covered the way `org_id` already is, and the
action needed no code change. The new trigger function itself tripped §0g's
own guard on the very first full suite run afterward -- created without the
revoke-from-anon/grant-to-authenticated block every other SECURITY DEFINER
function here carries, caught immediately by `anon_executable_secdef_count()`
going from 0 to 1.

**A third, smaller thing, found by actually clicking through as the `staff`
persona rather than trusting the RLS fix alone:** the team roster page's own
inline player panel -- the first thing anyone actually opens, before "Open
development profile →" -- computed its Fees/Membership controls from
`canManage` (team-assignment only) plus a role-literal `access.role ===
'staff'` fallback for fees alone. That fallback matched the literal string
`'staff'` and nothing else, so a **treasurer** (not generic staff) got no
"+ Add charge" here despite holding `manage_finances`, and **nobody** got
"+ Add period" without being individually team-assigned, even though
`manage_membership` is club-scope too. The full player-profile page
(`PlayerProfile.tsx`) already computed these correctly via
`has_staff_permission` -- this inline panel just hadn't been cut over.
Fixed by computing `canManageFees`/`canManageMembership` from
`has_staff_permission('manage_finances'/'manage_membership', clubId)` on the
roster page itself and threading them down (`TeamRosterTabs` →
`PlayerDetailPanel` → `PlayerFees`/`PlayerMembership`) instead of reusing the
coarser `canManage`, which stays exactly as it was for player-removal and
guardian-linking (Family tab) -- those genuinely are team-scoped, coach-ish
actions and weren't touched.

**Net effect: team assignment is no longer what makes a club office role's
screen work.** It already wasn't the club-wide permission holder's real
gate -- that was `players_read` and the two role-literal spots above. What
being assigned to a team now actually adds for treasurer/secretary/staff is
narrow and real: posting an **announcement** to that team's own audience
(`ann_write` still has no permission-catalog branch, only
`can_admin_club`/`is_assigned_to_team` -- not touched here, flagged as a
smaller, separate thing) and the roster page's own "assigned" badge. Fees,
Documents and Membership all work club-wide today with zero assignment.

Verified: the RLS suite grew 215 → **223** (8 new tests for this finding,
written before the migration and watched fail for the right reason -- 3 of 8
failed on the first run, all matching the exact "Unknown"/refused-read bug
just diagnosed; a full-suite run afterward caught the anon-execute regression,
fixed before the suite went green). Driven live end-to-end as the demo
`staff` persona (no team assignment, confirmed via a direct query first): the
U15 Girls roster -- a team she does not staff -- rendered its real 12-player
list instead of the old "0 players"; the FEES tab offered **+ Add charge**;
the MEMBERSHIP tab, previously offering nothing at all, now offered
**+ Add period**, and using it wrote a real `memberships` row (confirmed by
direct query, then by reload showing it) -- cleaned up afterward. `npx tsc
--noEmit` clean, `npm run build` clean, `npm run docs:permissions:check`
clean (the generated tables were untouched by this pass).

### Announcements honour manage_communications (2026-09-23/25) — and a hole in `ann_write`

`phase12e`. The follow-up §0s.3 flagged: `ann_write` never consulted the permission
catalog, so a secretary or staff member holding `manage_communications` ("Send
team/club announcements", club-scope) could post only to a team they were assigned to.
Writing the test first turned up something worse than the gap it was written for:
**`ann_write`'s WITH CHECK was only `is_org_member(org_id)`, and an INSERT under an ALL
policy consults WITH CHECK alone -- so any org member could post an announcement to any
audience, on any team.** A guardian, the IT admin and a treasurer all did, in the failing
run. UPDATE/DELETE were fenced properly by USING, which is why pin and delete looked
fine and nothing ever surfaced it. (Same shape as `clubs_admin_write`, §0j: USING and
WITH CHECK on one policy describing different intents.)

One expression now serves both clauses: `can_admin_club`, or
`has_staff_permission('manage_communications')` (club-scope, so any audience, any team),
or an assigned team member posting a **team** audience for their own team. The last
branch also requires `audience = 'team'`, so a coach can no longer attach a club-wide
audience to their own `team_id` to slip past. UI: `Announcements.tsx` takes
`canPostAnywhere` (club manager or manage_communications) instead of `isClubManager`, so
secretary/staff get every audience and every team; the guides' "Not available yet" line
about club-wide posting is gone.

Verified: 9 RLS tests, written first -- 6 failed against the old policy for exactly the
reasons above, all pass after. Full RLS suite 233/233.

### The roster panel gets a Documents tab (2026-09-25) — gap 7

Documents was reachable only from the full profile ("Open development profile →"), which
a secretary or staff member has no reason to open. `PlayerDetailPanel` now has a
Documents tab (with a pending-count badge) rendering the same `Documents` component the
full profile uses. No migration: the roster query embeds `document_uploads` and RLS
(`docs_read`) already scopes what comes back. The page computes the same three checks
`PlayerProfile.tsx` does -- `manage_documents`, `manage_team_documents`, `view_medical`,
each with the team -- so the panel's controls agree with what `docs_write` accepts (a
coach still sees and manages medical documents only).

Verified live as the unassigned demo `staff` user: the tab appears with a pending badge,
lists the document with Approve / Reject / Remove / Upload, and Approve wrote
`status = approved`. Test document removed afterwards. `tsc` clean.

### Two loose ends closed (2026-09-25)

- **Staff tab controls now match `uat_insert`/`uat_delete`.** They authorize on
  `is_org_admin` or `assign_team_staff` **for that team**, and only the club manager and
  team manager hold it -- and a team manager only for their own team. The Staff tab showed
  "+ Assign to team" and "×" to every viewer regardless, so a team manager saw controls
  for other teams that the database then refused. The club page now computes
  `assignableTeamIds` (every team for a club manager or org admin; otherwise one
  `has_staff_permission('assign_team_staff', club, team)` per team) and `StaffRow` offers
  assignment and unassignment only there. Removing the primary coach additionally needs
  `manage_staff`, so that × is hidden unless the viewer is a club manager or org admin.
  Verified live as the demo team manager: the only × on the page is on their own U15
  Girls assignment; the primary coach's row has none.
- **The roster badge and footer no longer say "not assigned" to someone with club-wide
  access.** A treasurer/secretary/staff member viewing a team they aren't on read
  "STAFF — NOT ASSIGNED HERE" and "ask a club admin to assign you", as if locked out,
  when their role reaches every team (§0s.3). The badge now reads "… — club-wide access"
  and the footer says which actions still need an assignment (adding or removing players,
  training, guardians). Verified live as the unassigned demo staff user.

### Creating a team (2026-09-25)

The club page could only *link* a team that already existed and was unclaimed, so a new
club could never get its first team from the screen. The Teams tab now has **Create team**
(name and squad type) above the link form, for club managers and org admins.
`createTeam()` inserts into `teams` under the existing `teams_write` policy
(`can_admin_club`, so no migration); `fill_org_id` derives the org from the club, the sport
is copied from the club, the URL slug comes from the name with a numeric suffix when
`(club_id, slug)` is taken (`u12-boys`, `u12-boys-2`, … up to 9), and `team.created` is
audited. `squad_type` stays the label it always was (never gate on it, §5). Same pass:
the Teams list said "Not assigned →" to office roles whose role reaches every team; it now
says "Roster →" for anyone holding finance, membership or document access.

Verified: 3 RLS tests pin the write side (a club manager and an org admin create; a coach,
a guardian and another club's manager are refused; a duplicate slug is a clean 23505). Driven
live as the demo club manager: created a team (slug, org, sport and audit row all correct),
created a second with the same name and got the `-2` slug; test rows removed.

### Public listing: owner opt-in (2026-09-25) — gap 4

Design in `docs/proposals/public-listing.md` (with the two other proposals in
`docs/proposals/`). `phase13a`, `phase13a1`.

**A correction to §0s.** Finding 4 said nothing writes `publicly_listed`. That was true for
**clubs** only: the tournament app's platform console has a "List publicly" checkbox and its
creation forms set the flag. Clubs had no screen; all four listed clubs were listed by a
direct database write.

**Decision:** the owner opts in, held by the **club IT admin and tournament IT admin** (plus
org admin and platform admin). New catalog keys `manage_club_listing` (club scope, held by
`club_it_admin`) and `manage_tournament_listing` (tournament scope, held by
`tournament_it_admin`) rather than one reused key, because the club and tournament
resolvers differ. A **platform admin can block** via a separate `listing_blocked` flag, so
unblocking restores exactly what the owner had; the views require listed and not blocked.
The club manager and the Organizer can take a listing **down** but not list it.

**A hole found first:** `clubs_admin_write` lets a club manager write any column, so any
club manager could flip `publicly_listed` straight through the API, with no screen and no
guard; and a tournament IT admin could not write it at all (`tournaments_write` is
`is_org_admin`). `guard_listing_flags()` (BEFORE INSERT/UPDATE on both tables) now refuses
turning the flag on without `can_change_listing()`, and any change to the block columns
unless the caller is a platform admin. Calls with no signed-in user (service role,
migrations, the SQL editor) pass. The IT roles have no table write access, so
`set_public_listing()` and `set_listing_block()` (SECURITY DEFINER, authorize first, audited
via `write_audit_system` as `club|tournament.listing.changed|blocked`) are how they act.

**A second hole, caught by the anon direct-read test:** `clubs` and `tournaments` each
carried **two** anon/authenticated "listed" SELECT policies under different names. I
rewrote one of each to add `and not listing_blocked`, but the older twin stayed, and
permissive policies OR together, so a blocked row was still readable straight from the
table even though the views hid it. Dropped in `phase13a1`. (My first policy query only
matched policies naming `anon`, which is why the twin was missed.)

**UI:** a shared `PublicListingCard` shows the state and exactly what becomes public,
warns about unset fields, and says plainly when the platform has blocked the listing. It is
on the club **IT page** (IT admin, org admin), on the **club page** (club manager can take
down, org admin can list), and on a **Public listing** tab in the tournament console. The
platform console has a **Listings** tab (filter listed/blocked/everything, Block with a
reason, Unblock).

Verified: 9 RLS tests, written first (all 7 substantive ones failed on the missing
permission, RPCs and guard), then green after the migration except the anon table read,
which found the twin policy. Driven live: the club IT admin unlisted and re-listed Usna Gali
FC through the card (flag, `public_clubs` and the audit row attributed to them all
correct; restored to listed); the demo organizer sees the tournament tab with the remove
button and no list button; the platform console Listings tab shows all 4 clubs and 5
tournaments. Not clicked: Block/Unblock in the platform console (covered by the RLS
tests), and no demo persona exists for the tournament IT admin.

### What was and wasn't clicked through

Driven live: the org admin's club page and Staff tab (gap 1), the guardian's normal
sign-in and page (gap 2, and the guardian guide's tab and banner wording), the demo
`staff` user's whole club page (gap 5), and the coach and team manager on the same
player (the coach's team page, schedule and add-player forms, the full profile's six
tabs and development controls; the team manager sees the same sub-tabs with no add
controls). The console screens' text was otherwise read from the running code. **Not clicked through:** the
platform console's suspend/provision flows in this session (they were driven in
earlier ones, §0m/§0n), the club manager's finance and staff forms, and the
guardian's confirm/decline and payment forms. Their steps come from the code, so
treat those sections as "code-checked".

I also could not test whether `/guardian-signup` accepts an email nobody invited:
Supabase rejects `.local` and `example.com` addresses, and using a real mailbox to
find out wasn't worth it. The guides therefore say only what the code shows — that
it is the sole sign-up page and is written for invited guardians.

---

## 0t. IT-issued logins with a temporary password (2026-09-25)

`phase14a`. Email is parked (§8), so "invite by email" can't be how people get an
account. Instead the **club IT admin, tournament IT admin or a platform admin creates
the login** and hands over a **random temporary password**, shown once. (Rejected: a
predictable default like `Dulhq_<email name>` — anyone who knows a colleague's email
would know their password until they changed it.)

- **Flow:** create → temp password (12 chars, no look-alikes, `node:crypto` randomness,
  never stored) → first sign-in is redirected by `middleware.ts` to `/change-password`
  while `app_metadata.must_change_password` is true (not user-editable, unlike
  `user_metadata`) → the chosen password clears the flag and stamps `activated_at`.
- **72-hour expiry, enforced at the auth layer:** hourly `expire_temp_logins()` (pg_cron)
  sets `auth.users.banned_until` for never-activated expired logins, so holding the
  temp password and calling the auth API directly doesn't work either. Reissue lifts the
  ban. The login page turns GoTrue's "User is banned" into "temporary password expired".
- **Who may, and on whom:** `manage_club_logins` (club_it_admin) / `manage_tournament_logins`
  (tournament_it_admin) / platform admin, via `can_provision_login`. **Reissue is limited to
  logins that same scope issued** (`provisioned_logins`), because one person can be a
  guardian at one club and staff at another: reissuing an arbitrary email would be a
  cross-tenant account takeover. A platform admin may reissue any ordinary account, never
  another platform admin's.
- **The service role is now used by the app** — `src/lib/admin-auth.ts`, server actions
  only, and always after the database function has authorized the caller.
  **`SUPABASE_SERVICE_ROLE_KEY` must be added to Vercel's production env vars** (it is in
  `.env.local`). Without it the screens report that logins aren't set up.
- **UI:** "Create a login" on the club IT page, on the tournament console's Staff tab (raw
  permission — an org admin does not create a tournament's logins), and a platform console
  "Logins" tab with reissue-by-email. This also closes the "add staff needs an existing
  account" dead end: IT creates the login, the manager adds it by email.
- **Known limits:** forced change is enforced in our middleware; the tournament engine
  (`/t/...`, outside the matcher) doesn't check it, and a temp-password holder could call the
  auth API to change their own password without our checks (the 72h ban bounds this). A
  failed create says the email already has an account, which tells an IT admin that. A
  person who forgets a password they chose needs an IT reissue until email exists.
  Google sign-in was discussed as a later addition, not built.
- **Verified:** RLS suite 246 → 256; unit 58 → 69; driven live (create → forced redirect
  from `/clubs` → weak password rejected → change → activated + audited → a banned account
  shows the expiry message). Test account removed afterwards.

### Entrant portal (2026-09-26) — `phase15a`, slice 1 of the roles/portal proposal

`/entry/<entryId>` for a team contact from outside any organization: entry status, the
entry-fee invoice(s), the host's payment instructions, and a form to report a payment.
Home shows **Your team entries** for anyone with an active contact row. This is what
finally feeds the finance queue (§0q): a payment the team reports lands in **Payments to
verify**.

- **Nothing widened.** Contacts belong to no org, so the tables stay closed to them (tested:
  they still can't select `billing_invoices` or `tournament_entries`). Reads and the write go
  through definer functions that authorize first on `is_tournament_entry_contact`:
  `my_entrant_entries()`, `entrant_entry_portal(entry)`, `submit_entry_payment(...)`. The
  invoice is found by `source_type='tournament_entry'`, `source_id=<entry>` — the invoice
  has no payer user for a team that had no account when it was issued, so
  `submit_billing_payment` (which needs a payer) could not be used.
- **Only the `team_manager` contact pays**; a coach contact sees the entry and fees only.
  Amount is capped at what is still owed *after* payments already awaiting verification, so
  two submissions can't double-claim the balance. A suspended host org closes the portal.
- **Only an active contact has a portal.** Contacts start `pending`, become `invited` when
  the entry is accepted, and `active` on first sign-in with the matching email
  (`claimPendingTournamentEntryInvites`). An entry that is still pending has no portal yet.
- **Not built:** proof-of-payment upload, the QR image (the key is returned but not
  displayed), documents/announcements for entrants, and a demo persona for it.
- **Verified:** RLS suite 256 → 264; driven live as a throwaway team manager on Tiger Cup
  (home strip, entry page, submitted ₱200 of ₱500, invoice moved to "waiting for
  verification", form then offered the remaining ₱300). Fixture removed afterwards. Note the
  live check set the demo tournament's payment instructions to a sample GCash line.

### Team coordinator notes and flags (2026-09-26) — `phase15b`, slice 2

`review_tournament_entry` (team_coordinator and organizer) finally has a consumer.
`tournament_entry_notes` holds notes and flags on an entry; a flag stays open until the
organizer (`decide_tournament_entry`), an org admin, or its own author resolves it. Entries
show "N open flags", and a **Flagged** filter joins Pending/Accepted/Declined. The
coordinator also gained read access to the entry's **contacts** (`tec_read` got a
`review_tournament_entry` branch) — they need to reach the team they review. **Reviewing is
not deciding**: tested that a coordinator cannot call `decide_tournament_entry`.

- Writes only through `add_entry_note` / `resolve_entry_note` (no INSERT/UPDATE/DELETE
  policy), so a note can't be edited or deleted after saving; each is audited
  (`tournament.entry.noted|flagged|note_resolved`). Entrants never see them.
- The author's name is stored on the note (`author_name`, phase15b1): other staff can't read
  `public.users`, so a join showed "someone".
- New org_id table, so it carries the `org_not_suspended` fence itself (phase9a's guard test
  would otherwise fail).
- Verified: RLS 264 → 272; driven live as a throwaway coordinator on Tiger Cup (Notes button,
  flag with author name, "1 open flag", Flagged (1), Resolve → Flagged (0); no Accept/Decline
  offered). Fixture removed. Not clicked: the organizer resolving someone else's flag.

### Tournament announcements (2026-09-26) — `phase15c`, slice 3

`manage_tournament_communications` (communications role, organizer) finally has a consumer: an
**Announcements** tab in the organizer console posts to the teams entered in the tournament.
A post shows on the entrant portal (`entrant_entry_portal` now returns `announcements`) and drops
one in-app notification per person into their bell, linking to `/entry/<id>`.

- Audience `all` = pending + accepted entrants; `accepted` = accepted only. Declined/withdrawn
  teams are never addressed. Contacts must be **active** (signed in), the same rule as the portal.
- Writes only through `post_tournament_announcement` / `retract_tournament_announcement`; the table
  has no write policies, so a post can't be edited (retract and repost). Staff read the table;
  entrants read only through the portal function. Audited as
  `tournament.announcement.posted|retracted`.
- **In-app only.** No push (the send is a definer function, and push delivery lives in
  `notify.ts`) and no email (§8). Retracting hides it from entry pages but the bell row already
  sent stays.
- **Not built:** posting to officials or to the public tournament page (the proposal mentioned
  both), and scheduling.
- Verified: RLS 272 → 281 (written first; 5 of 9 failed before the migration); driven live as
  the Tiger Cup organizer (posted) then a throwaway entrant (announcement on the entry page,
  bell badge 1). Fixture removed.

### Tournament entry documents (2026-09-27) — `phase15d`, slice 4

`manage_tournament_documents` (secretary, organizer) finally has a consumer: a **Documents**
tab in the organizer console, and a Documents section on the entrant portal
(`/entry/<id>`) for uploading. Files go through R2's `documents` category (declared in
`shared/files/lib/r2.ts` since phase5d, never used until now — club documents are still
inline base64; this is the first R2-backed document store).

- **Two upload paths, both start `pending`:** `submit_entry_document` (any active entry
  contact — team manager or coach) and `staff_upload_entry_document` (secretary/organizer/org
  admin, for paperwork that arrived some other way). Review is separate from upload:
  reviewing your own team's document is never possible for a contact, since only a
  `manage_tournament_documents` holder or org admin can call `review_entry_document`.
  Rejecting requires a reason, checked server-side (not just the client's `required`
  attribute, unlike the club-side Documents component).
- **Deleting:** the uploader may remove their own upload while it is still `pending`
  (a mistake fix); once reviewed, only staff can remove it.
- **A real bug, caught by the tests, not by inspection:** the first `review_entry_document`
  called `create_notification()`, which checks `is_org_member()` on the **caller** —
  written for a client-side caller acting on their own org membership. Tournament staff
  aren't org members (`is_org_member` has no `tournament_staff` branch), so a secretary
  approving a team-uploaded document raised "not a member of this organization" and rolled
  back the whole review, including the status update already in the same statement. Same
  trap class as phase5c's RETURNING-triggers-a-read-check bug. Fixed (`phase15d1`) by
  inserting into `notifications` directly, matching `post_tournament_announcement`'s own
  pattern: a function that has already authorized the caller doesn't need a second,
  differently-scoped check on the way out.
- Staff read the table directly; entrants read only through `entrant_entry_portal`'s new
  `documents` field. Nobody writes the table directly.
- **Not built:** downloading/viewing the uploaded file (no signed-URL endpoint yet — the
  review screen shows only the name and status), and a document-request workflow (asking a
  specific team for a specific document).
- **Verified:** RLS 281 → 290 (written first; 6 of 9 failed before the migration, the other
  2 failures after the first fix pinned the real bug above). Driven live: seeded a
  submission via RPC as a throwaway entrant (**the sandboxed browser can't drive a native
  file picker**, the same limitation recorded for club document/logo uploads) — portal showed
  it pending; the Tiger Cup organizer's Documents tab listed it, Approve moved it to
  Approved (took a couple of seconds for the Server Action's revalidation to land, same as
  entry accept/decline). Fixture removed afterward.

---

## 0u. Retiring logistics and volunteer coordinator (2026-09-28)

`phase15e`. The proposal in `docs/proposals/tournament-roles-and-entrant-portal.md`
asked, before slice 4 landed, whether to build slices 5–6 (an Officials tab; new
tables for venues/arrivals and volunteer shifts) or retire the two roles with no
holder, no screen, and no plan to get one. Decided: retire.

Unlike `review_tournament_entry` (a permission seeded ahead of its feature, on a
role — team_coordinator — that stayed and eventually got one, phase15b), these two
roles themselves are gone, so their permission keys went with them —
`manage_tournament_logistics`/`manage_tournament_volunteers` are removed from the
catalog outright, same P0-2 precedent as the three dead guardian permissions:
zero consumers anywhere, confirmed live before deleting, not assumed. This also
removes the **organizer's own grant** of both keys (phase8b had seeded them there
too) — an org-wide permission with no screen and no role left to delegate it to
isn't worth keeping "in case".

Checked first, not assumed: zero `tournament_staff` rows held either role and zero
`tournament_staff_permission_grants` rows referenced either key. The migration
itself refuses to run if a live row is ever found holding one of the retired
roles, rather than deleting staff out from under someone.

`tournament_staff.role`'s CHECK constraint now accepts seven roles (was nine);
`role_permission_defaults.role`'s separate CHECK narrowed the same way. The
Add-staff role dropdown (`StaffPanel.tsx`) and the how-to guides had both roles
removed rather than left rendering a choice the database now refuses.

**Verified:** RLS suite 290 → 296: the role strings refused by the check
constraint, both roles absent from `role_permission_defaults`, both permission
keys absent from `permissions` entirely, and `has_tournament_permission` false
for both keys even for the organizer. `npm run docs:permissions:check` clean
after removing the two guide sections (a role with zero `role_permission_defaults`
rows throws rather than rendering, by the generator's own design — confirmed the
failure mode before fixing it, not just fixing on faith).

---

## 0v. Tournament poster upload (2026-09-28)

`phase16a`. `tournaments.poster_url` (the public tournament directory's 2:3 poster
cards, §0r) had a reader in three places and a writer nowhere — the only thing
that had ever set it was `scripts/seed-directory-art.mjs`, a dev seeding script.

Built in one shared pair of pieces, used from both surfaces the user asked for
(the organizer console, which an org admin already reaches with full access via
`can()`'s own `is_org_admin` fallback; and the platform console, for any
tournament regardless of org):

- **`set_tournament_poster(tournament_id, poster_url)`** — the checked write.
  `tournaments_write` is `is_org_admin(org_id)`-only, so an Organizer
  (tournament_staff, not an org member) has no direct write path to this column
  at all — same shape as `set_public_listing`/`set_listing_block`. Authorizes on
  `is_platform_admin() or is_org_admin(org_id) or has_tournament_permission
  ('manage_tournament', tournament_id)` — `manage_tournament` is the Organizer's
  own "configure tournament identity" permission (its phase8b description
  already says so), no new key needed. Gated on `org_access_allowed` like every
  other tournament write. Audited as `tournament.poster.updated`.
- **`src/lib/tournament-poster-actions.ts`** — the actual bytes. The
  `tournament-posters` Storage bucket (public read, 5MB limit, four image mime
  types — all enforced by Storage itself, confirmed live rather than assumed)
  has `storage.objects` RLS that is **platform-admin-only** for every write,
  found while building this — so an Organizer or org admin uploading directly
  from their own session would always be refused. Fixed the same way club
  documents and IT-issued logins both already solve "someone who isn't a
  platform admin needs to write a protected resource": upload via the service
  role first (`serviceClient()`, phase14a's module — the one place it's used),
  then call the checked RPC with the caller's own session; a refusal there
  removes the just-uploaded object again. Storage path is
  `<orgSlug>/<tournamentSlug>-poster`, deliberately **without** a file
  extension — the seed script's own `-poster.png` path meant switching image
  formats orphaned the old object; an extension-less key is stable across
  format changes since the browser reads the real type from the response's
  `Content-Type`, not the URL.
- **`TournamentPosterUpload.tsx`** — one component, both surfaces. Upload,
  replace, remove; a `canManage` prop the caller computes (the organizer
  console's existing `manage_tournament` check; always true on the platform
  console, which is already platform-admin-gated to be on that page at all).

Wired into the organizer console's **Public listing** tab (next to the existing
"Poster: uploaded" preview line, which had nothing behind it until now) and the
platform console's **Listings** tab (one card per tournament row, clubs
unaffected — posters are tournament-only).

**Verified:** RLS suite 296 → 303: organizer can set, treasurer can't; org admin
can set and clear with null; a platform admin can set a poster on a tournament
in an org they hold no staff role in at all; a suspended host org refuses even
the organizer; audited. One test cleanup bug caught by re-running the suite
afterward and finding its own leftover: the platform-admin sub-test deleted its
throwaway `platform_admins` row and user at the end of its own test body rather
than in the describe's final cleanup, so the first (failing, pre-migration) run
left one behind when the assertion threw before reaching it — moved to the
final cleanup, same lesson this file has recorded before about fixture cleanup
needing to survive a failing assertion, not just the happy path.

Driven live end-to-end as the Tiger Cup organizer: uploaded a test image (the
sandboxed browser can't drive a native file picker, so the file was attached
via `DataTransfer` directly on the hidden input, a documented workaround, not a
first for this project), confirmed the new object under
`davao-unity-sports/tiger-cup-poster` in the database, removed it, saw the
"no poster" placeholder state render correctly, then re-ran `scripts/seed-
directory-art.mjs` to restore the showcase tournament's real poster (skips
anything that already has one, so re-running was safe). Also found and cleaned
up two unrelated leftover fixtures from an earlier session that had never been
removed (`docs-fixture`'s "Debug Cup" tournament with its own seeded poster,
and one leftover `rls-test.local` platform admin) while verifying this —
neither was caused by this phase, both are gone now. Confirmed the
platform console's Listings tab renders a poster card per tournament row,
including the correct empty state for one that has never had a poster.
`npx tsc --noEmit` clean.

---

## 0w. Org accent theming (2026-09-28)

The user's own framing: "try applying the org's accent color as a dominant color
scheme for their interface after login." Two scoping questions were asked and
answered before building, both taking the narrower option: (1) themed only
within that org's own pages (club console, tournament console) — the platform
console, public directory and anything not tied to one org stay the default
green; (2) for someone who holds roles at more than one org, whichever org the
*page* belongs to, not one fixed "primary" org for the whole session — a club
page uses that club's org, a tournament page uses that tournament's org, no
per-user "my org" concept needed.

**The persistent top nav is deliberately NOT themed**, and this is a real
architectural limit, not an oversight: the nav lives in the root layout,
rendered as a sibling *before* `{children}`, not an ancestor of a nested
route's own layout — so a CSS custom property set inside a club or tournament
layout literally cannot cascade up to it (CSS inheritance only flows to
descendants). Reaching the nav would need the root layout itself to resolve
per-request org context, which no route segment currently threads up to it.
Decided this was fine, even good: the nav stays Dulà HQ's own brand chrome,
consistent everywhere; the workspace below becomes the org's.

**`src/lib/org-theme.ts`** — pure, dependency-free (same discipline as
`crest.ts`), turns one `#RRGGBB` into the small set of variants globals.css
itself needs: an HSL-derived hover shade, soft tints for *both* themes, and an
`onAccent` text color computed from WCAG relative luminance so a pale accent
(tested with a bright yellow) gets dark text instead of unreadable white-on-
pale. Invalid or missing input — an org's `accent` column is a free-typed
field the platform console already lets an admin edit — falls back to the
existing default green, never left unstyled or fed straight into a `<style>`
tag unvalidated.

**A real CSS bug, caught only by checking the rendered color, not by reading
the component:** the first version set `--accent`/`--accent-hover`/etc. on the
scoping div but buttons stayed the default green regardless. Root cause:
`--accent-gradient: var(--accent);` is declared exactly once, at `:root` in
globals.css, and a custom property's *computed* value is fixed wherever it is
actually declared and then inherited as that already-resolved string — NOT
re-evaluated against `--accent` at whatever element it's used from. So every
descendant inherited `:root`'s frozen `#059669`, no matter what `--accent` was
overridden to further down. Fixed by redeclaring `--accent-gradient: var(--accent);`
inside the org-accent scope too, so it gets freshly resolved there. Grepped
globals.css afterward for any other custom property whose value is itself
`var(--accent...)` — only the one.

**`OrgAccentTheme.tsx`** wraps its children in a `.org-accent-scope` div plus a
`<style>` tag (not an inline `style` attribute) so the dark-mode soft tints can
be set with a `:root[data-theme="dark"] .org-accent-scope { ... }` rule that
reads the theme off `<html>` regardless of where the div sits — matching
globals.css's own light/dark split rather than assuming one pale tint works on
both a white and a near-black surface, which an arbitrary org color can't.

**Two new layouts**, both server components reading the org's `accent` through
the same RLS-respecting client every page under them already uses, so nothing
about access changes:
- `src/app/c/[clubSlug]/layout.tsx` — `clubs.org_id → organizations.accent`.
  Works for both staff (any listing status, via `clubs_member_read`) and a
  guest on a *listed* club's public page (the public read policy); a private
  club a guest can't see just returns no row, so the page renders unthemed and
  its own sign-in prompt is untouched.
- `src/app/tm/[orgSlug]/[tournamentSlug]/layout.tsx` — `organizations.accent`
  straight off the org slug already in the URL, no tournament join needed.
  This route is never public, so there's no guest branch to think about.

**Not themed, on purpose, to keep this pass scoped:** the entrant portal
(`/entry/<id>`) — its host org's accent could be added the same way, but
`entrant_entry_portal()` doesn't currently return one and this wasn't asked
for; a clean follow-up if wanted, not assumed here.

**Verified:** unit suite 69 → 79 (`org-theme.test.ts`: fallback on invalid/
missing input, every derived value is a valid hex, luminance-based text-color
flip, hover always darker or equal, light soft tint lighter than dark soft
tint for the same accent, deterministic, case-insensitive input). Driven live:
CDO FC's page (org accent `#2563EB`, blue) showed its "Listed" chip and
primary buttons in blue while the top nav stayed the default dark green — the
`--accent-gradient` bug was caught and fixed at exactly this step, before it
was trusted. Tiger Cup's console (Davao Unity Sports, `#7C3AED`, purple)
showed its active tab and primary buttons in purple after the fix, confirmed
in both dark and light theme. `npx tsc --noEmit` clean.

---

## 0x. Entrant portal theming, and a poster watermark starting at /login (2026-09-29)

Follow-up to §0v/§0w, from the same user request as the poster feature: extend the
accent theming to the entrant portal, and use a tournament's poster as a "watermark
background" — starting with the sign-in screen itself, before anyone has authenticated.

**Entrant portal (`/entry/<id>`)** now wraps in the same `OrgAccentTheme` as club and
tournament pages, using the host org's accent — `entrant_entry_portal()` (phase16b)
now also returns `host_org_accent` and `tournament_poster_url`, so the portal needed
no new query, just two more fields on a function that already authorizes the caller
as a contact of that entry.

**`PosterWatermark.tsx`** — a poster faded into the page's own background: low
opacity, blurred, vignetted to `var(--bg)` so it fades identically in either theme
and never fights the content's contrast. Renders nothing at all when there's no
poster (most tournaments won't have one, §0o), rather than an empty gap. Dropped
into the entrant portal and, per the request, `/login`.

**Theming `/login` needed knowing which tournament a sign-in is "for" before anyone
is authenticated**, which the shared `/login` route never needed before. Split
`LoginForm` (client, unchanged apart from a new `posterUrl` prop) out of a new
`page.tsx` (server component) that reads the `redirectTo` query param — already set
by `middleware.ts` whenever a direct link to a protected page gated sign-in first —
and resolves a background for two shapes:

- `/tm/<org>/<tournament>` (the organizer console): through `public_tournaments`,
  the same anon-safe view the public directory already uses. Only shows a background
  for a tournament its own owner chose to list — nothing new is exposed.
- `/entry/<id>` (the entrant portal): entries are never public, so this needed a new
  function, **`entry_login_background(entry_id)`** — deliberately callable by
  `anon`. It returns only a tournament's name/poster/accent for a given entry id,
  nothing about the entry itself (no team, no status, no contacts), and only while
  the host org is active. Flagged to the user before building it: this is the first
  conscious exception to this project's own "zero anon-executable SECURITY DEFINER
  functions" invariant (§0g), tracked rather than silently added —
  `anon_executable_secdef_count()`'s guard gained a named, one-entry
  `anon_executable_secdef_allowlist()` rather than being weakened generally, and a
  test pins the allowlist to exactly this one function. Not a wider hole than
  what's already public: `organizations`' own name/accent/logo are anon-readable
  with **no** listing gate at all (`orgs_public_read`), so this reveals less than
  that already does.

**A real bug in the guard itself, caught by the RLS suite, not by inspection
(`phase16b1`):** `anon_executable_secdef_count()` is deliberately NOT `security
definer` (§0g — it has to stay outside the set it counts), which means it runs
as its *caller*, not its owner. It calls `anon_executable_secdef_allowlist()`
internally, and that function's `EXECUTE` had only been granted to
`service_role` — so any ordinary authenticated caller of the counter (the RLS
suite's own club admin, or any real app code) got refused with `42501` just for
calling it, which the suite caught immediately on the next full run. Fixed by
granting `authenticated` too; the allowlist itself names nothing sensitive.

**A real bug, environment-specific, not app code:** right after building this, the
sign-in form's own fields and button rendered as fully transparent in the browser
pane — `getComputedStyle` showed the `Reveal`-wrapped elements stuck at their
`initial={{opacity:0}}` framer-motion state, never reaching `animate`. The
accessibility tree showed the form was genuinely present and interactive throughout
(`Email`/`Password`/`Sign in` all there); only the animated *opacity* never
resolved. Restarting the dev server fixed it once, then it recurred on the very
next navigation in the same tab — this is the same class of limitation §0k already
recorded (`AnimatedNumber`'s `useInView` not firing in a stale/backgrounded
automation tab), not something to chase further: verify motion-gated content in
this environment via the accessibility tree and computed styles, the same way §0k's
workaround did, not by trusting a screenshot's opacity.

**Verified:** RLS suite 303 → 309 (the portal's two new fields, the anon lookup
returning exactly the three safe columns for a real entry, refusing nothing but
returning zero rows for a made-up id, hidden while the host org is suspended, and
the allowlist pinned to exactly `entry_login_background`). Driven live: a throwaway
entrant's own portal page showed the purple Davao Unity Sports accent and the Tiger
Cup poster watermark; `/login?redirectTo=/tm/davao-unity-sports/tiger-cup` and
`/login?redirectTo=/entry/<a real id>` both showed the same purple accent and
poster pre-authentication, confirmed via computed `--accent` on `.org-accent-scope`
rather than relying on the screenshot (see the bug above). `npx tsc --noEmit` clean.

---

## 0y. Officials tab — the last open slice of the roles/portal proposal (2026-09-29)

`phase16c`. Slice 5 of `docs/proposals/tournament-roles-and-entrant-portal.md`, the
last one left after logistics/volunteers were retired (§0u): a Referee Coordinator
had `manage_officiating` and nothing to do with it.

**The same read-side bug phase10a found for `tournament_entries`/`tournament_categories`,
found again by checking rather than assuming.** `toff_write` (writes to
`tournament_officials`) has correctly checked `has_tournament_permission
('manage_officiating', tournament_id)` since phase8c — but `officials_read` and
`toff_read` were both `is_org_member(org_id)`-only, and a Referee Coordinator is
tournament_staff, not an org member. Confirmed live before building anything: signed
in as a real referee coordinator, read zero rows from both tables. Fixed with
`can_view_org_officials(org_id)` (org member, or holds `manage_officiating` on *some*
tournament in that org) — only the READ side widens. `org_officials`' WRITE side
(`officials_write`) stays exactly what §0l already decided: `is_org_admin` only, since
it's the org's whole pool across every tournament it runs, and routing a write to it
through one arbitrary tournament's permission has no principled answer. A coordinator
now sees the whole pool to assign from, but only an org admin adds, edits, or
deactivates someone in it.

**UI:** a new **Officials** tab, shown to anyone holding `manage_officiating` or
who's an org admin. Two sections: **This tournament** (assign from the pool with a
role — referee/assistant referee/fourth official/commissioner/table official — and
remove an assignment; open to the coordinator), and **Organization's officials
pool** (read-only list for the coordinator; add/deactivate/reactivate for an org
admin only — `canManageOfficialsPool` is deliberately `!!orgAdmin`, not the generic
`can()` helper, since `can()` would have folded the coordinator's own
`manage_officiating` into the org-wide pool write that §0l's decision specifically
refused).

**A test-writing mistake, not an app bug, caught before it was trusted:** the first
version of the "cannot write the org-wide pool" test expected an `update()` call to
return an error, and it didn't — because RLS filters an update that matches no
visible/writable row rather than raising (the same "RLS filters a DELETE rather than
raising it" lesson §0i already recorded for team unassignment). Fixed by asserting
the row was actually unchanged afterward, the real proof. A second test named
"unrelated org" but used a same-org fixture (a coach, who counts as an org member via
`is_org_member`'s own `club_staff` branch) — swapped for a genuinely different org's
fixture once caught.

**Verified:** RLS suite 310 → 316 (six tests: coordinator reads both tables and a
treasurer can't; coordinator assigns and removes and a treasurer can't; coordinator
cannot write the pool itself while an org admin can; a genuinely different org reads
neither table). Driven live against real showcase data — Tiger Cup already had 4
officials and 3 assignments from outside this session (source not identified,
pre-existing): as the Davao Unity Sports organizer, assigned the fourth (unassigned)
official, confirmed it appeared, removed it again, back to the original 3. As the
Usna Gali org admin on Copa Gali, added no new official (the pool already had one to
test with) but deactivated one and reactivated it, watching the badge and button
label flip both times. Showcase data confirmed unchanged afterward in both cases.
Also hit, and worked around, a corrupted dev-server webpack cache from this
session's very long uptime (`Cannot find module './873.js'`) — clearing `.next` and
restarting fixed it; noted here in case it recurs, since it looked at first like a
broken sign-in rather than stale build output. `npx tsc --noEmit` and `npm run
build` both clean.

---

## 0z. `/login`'s destination context, and a false alarm on `dula-hq.vercel.app`

Two things the user flagged after §0y, checked the same day.

### `/login` vs `/login?redirectTo=...` looked identical

Fair complaint against §0x's own work: the poster/accent background only renders for the
two shapes it explicitly handles (`/tm/<org>/<tournament>`, `/entry/<id>`), so being
redirected to sign in before `/platformconsole` (or `/guardian`, `/player`, `/clubs/new`,
any `/c/<slug>/...` page) looked exactly like typing `/login` cold — no indication of why
the person was stopped or where they'd land. `resolveBackground()` (`src/app/login/
page.tsx`) is now `resolveContext()`, returning a `destination` string alongside the
background: the `/tm`/`/entry` branches now also select the tournament's `name` (already
an anon-safe read, `public_tournaments`/`entry_login_background` both already return it)
and phrase it as "Tiger Cup's tournament console" / "your team's entry for Tiger Cup";
everything else middleware.ts can redirect from gets a hardcoded phrase
(`/platformconsole`, `/guardian`, `/player`, `/clubs/new`, `/c/`) with a generic "where you
left off" fallback for anything unmatched. `destination` renders as a subtitle under "Sign
in" (`LoginForm.tsx`/`LoginFields`) only when non-null, so the bare `/login` page (no
`redirectTo`) is untouched. Verified live: bare `/login` unchanged, `?redirectTo=
%2Fplatformconsole` reads "to continue to the platform console", and
`?redirectTo=%2Ftm%2Fdavao-unity-sports%2Ftiger-cup` correctly resolved the real name,
"to continue to Tiger Cup's tournament console". No migration, no RLS change — same two
already-public reads, just also selecting `name`. `npx tsc --noEmit` and `npm run build`
both clean.

### The "Find your tournament" gallery at `dula-hq.vercel.app` is not live data

The user saw a "Find your tournament" page listing 7 tournaments each tagged **DEMO**
(*Copa Gali Futbol 2026, Copa Davao 2026, Manila Summer Invitational 2026, Cebu Volley
Classic 2026, Cebu Women's Volley Cup, Davao Hoops League S2, Davao 3x3 Showdown*) at
`dula-hq.vercel.app/#` and expected it gone. Checked directly rather than guessed:

- **It is hardcoded client-side content in the sibling `DulaHQ` (Vite) repo's
  `index.html`** — a `DEMO_ORGS` array and a `gallery-screen`/`renderGalleryGrid_()`
  renderer, entirely `localStorage`-backed. It is not a query against the shared
  Supabase project at all, so §0's 2026-09-07 data wipe could never have touched it —
  confirmed live too: reloading the root shows a *different* randomly-generated demo
  tournament each time (team names drawn from a fixed `DEMO_TEAM_NAMES` pool), which a
  real database row would not do.
- **The user's memory that this "was retired/removed" is corroborated by the code's own
  comment**, not just recalled: the file has a note at the seed-data block saying "the
  original version of this section was deleted in an earlier revision and its exact
  source wasn't preserved" and was reconstructed from a spec. §0m already recorded that
  an external tool ("arenaai") landed commits directly against this repo/origin between
  sessions and had deleted unrelated content (§0l and its RLS tests) without anyone here
  asking for it — this demo gallery being re-added is the same shape of unrequested
  external change, just discovered later.
- **Flagged, then removed on request.** `DulaHQ` is the frozen Tournament Manager app
  (§8: "Keep the tournament engine unrewritten... proxied, never ported"), so this was
  flagged rather than silently edited — the user confirmed, and the gallery-rendering
  functions were removed from `DulaHQ/index.html` (its own repo, own commit history) the
  same day, replacing the root's `#signin-wrap` with the plain sign-in shell. `DEMO_ORGS`,
  the `/t/{slug}` demo-tenant preview boot, and the Superadmin Console's Tenant Directory
  were left alone — a different, deliberate feature, not what was reported.

---

## 0za. Metered usage billing: wiring up an unused scaffold (2026-09-29)

The application-flow audit (§0a's addendum, `docs/LEGACY_CANDIDATES.md`) had flagged
three orphaned SQL functions as a "step 7" nobody could responsibly decide alone:
`record_billing_usage_event()`, `snapshot_billing_usage_period()`,
`project_billing_amount()` — real, correctly-authored, granted, and completely unused.
Checking further turned up more than three orphaned functions: a whole **metered-billing
catalog** the external "arenaai" billing sync (§0m) had seeded and nobody ever
populated — `billing_usage_meters` (7 meters: active clubs/players/staff seats/teams/
tournaments, storage GB, tournament entries) and `billing_plan_meters` (real included
quotas already assigned per plan — e.g. the base club plan includes 200 players, 30
staff seats). `billing_plan_meters.overage_unit_amount` is `0` everywhere — nobody's
priced overages, matching the user's own framing exactly: "gives me data on
utilization so I can factor it into pricing... in the future" — visibility first,
pricing later, not touched here.

### Two meter shapes, two recording strategies (`phase16e`)

- **6 "gauge" meters** (active clubs/players/teams/staff seats, storage) — a monthly
  value. `run_monthly_usage_snapshot()` (new, `pg_cron`-scheduled for 01:00 on the 1st,
  mirroring `expire_stale_approvals`/`expire_temp_logins`) computes each per org and
  records it with an idempotency key of `org:meter:YYYY-MM` — record once a month,
  and `snapshot_billing_usage_period()`'s pre-existing SUM aggregation stays correct
  as-is, summing exactly one row, with zero changes needed to that function's actual
  arithmetic.
- **1 "counter" meter** (`tournament_entries_monthly`) — a genuine discrete event,
  recorded in real time from the existing `addEntry` action
  (`src/app/tm/[orgSlug]/[tournamentSlug]/actions.ts`), right after its `write_audit`
  call, keyed by the entry's own id so it can never double-count.

### Storage: track going forward, R2 uploads only (user's own choice, asked directly)

Nothing in this app ever stored a file's byte size — only its R2 key. Three options
were put to the user (defer the meter / track new uploads going forward / query R2
live each month); **"track going forward"** was chosen. `org_storage_events` (new
table, append-only, upload events only — deletions aren't subtracted in this first
pass, so the figure is "cumulative uploaded" not "currently stored", a known,
documented simplification) is written by `shared/files/lib/r2.ts`'s `uploadFile()`
whenever a caller passes the now-optional `orgId` param, via the new
`record_storage_event()` RPC — best-effort, wrapped in try/catch so a metering hiccup
can never fail the actual upload it's riding alongside. Wired into the five call sites
that actually resolve an org: club logo (`c/[clubSlug]/actions.ts`), club media
(`media-actions.ts`), staff profile photos (`staff-profile-actions.ts`), and both
tournament-entry document upload paths (`entry/[entryId]/documents-actions.ts`,
`tm/.../actions.ts`). **Tournament posters are deliberately excluded** — they go
through a *different* backend (Supabase Storage, not R2, per
`tournament_posters_storage_bucket`), are upsert-in-place per tournament, capped at
5MB, and don't accumulate the way documents and photos do.

### Two real bugs, both caught by actually running it before trusting it

1. **`record_billing_usage_event()`/`snapshot_billing_usage_period()` both required
   `auth.uid()`**, so `run_monthly_usage_snapshot()` — service_role/cron-only, no JWT
   in that context — couldn't call either. First attempted fix mirrored `write_audit`'s
   own service-role JWT allowance (`phase16f`/`phase16g`) — wrong, because pg_cron's
   real scheduled execution carries no JWT at all either, unlike a genuine
   service-role *API call*. The actual, established fix (same as `write_audit`/
   `write_audit_system`, §0p): unchecked `_system` twins
   (`record_billing_usage_event_system`, `snapshot_billing_usage_period_system`,
   `phase16h`) that `run_monthly_usage_snapshot()` calls directly, since it's already
   the trusted gate (`EXECUTE` locked to `service_role`) and re-authorizing a second
   time through the checked wrapper in a context with no `auth.uid()` was never going
   to work. The checked originals are untouched in spirit — still exactly right for
   their real direct callers (e.g. `addEntry` calling `record_billing_usage_event` as
   the signed-in organizer).
2. **`billing_usage_events.context_type` has a CHECK constraint** (`platform` / `club`
   / `tournament` / `shared` — the same vocabulary as `billing_usage_meters.product`),
   not `'organization'` as first guessed — caught on the very next manual run
   (`phase16i`).
3. **`org_storage_events` had no suspension fence.** §0n's own guard test
   (`org_tables_missing_suspension_fence()`) caught it on the first full RLS
   run after this landed — every `org_id`-carrying table needs the
   `org_not_suspended` RESTRICTIVE policy or the guard flags it by name.
   Added (`phase16j`), matching every other table's exact policy shape
   (`as restrictive for all to authenticated using (org_access_allowed(org_id))`).
   This is exactly the "the test is the guard" pattern §0g/§0n both already
   established — a real gap caught by a pre-existing regression test, not
   found by inspection.

### UI: utilization vs. quota, not a raw event log

The Platform Console's Billing tab had a "Recent usage events" list since the
external sync, always empty (zero rows ever recorded) — kept, but a new **"Usage &
utilization"** section above it (`BillingConsole.tsx`) is the one that actually
answers the question asked: per org, per meter, the latest recorded month's quantity
against that org's plan quota (`billing_plan_meters.included_quantity`, resolved by
matching the meter's own `product` to whichever of the org's subscriptions covers
it — club first for a `shared` meter), with a thin progress bar and the row itself
turning red once `quantity > includedQuantity`. Verified live: Usna Gali and CDO both
run 2 clubs against a 1-club-included base plan, and both rows render red — the "am I
over my own plan's limits" question this whole feature exists to answer, answered
correctly on the first real data. A real timezone bug was caught the same pass: the
month label used `new Date(periodStart).toLocaleDateString()` on a date-only string
("2026-09-01"), which a US-timezone browser rolls back to "August" (date-only ISO
strings parse as UTC midnight; local formatting can shift the calendar day) — fixed
with an explicit `timeZone: 'UTC'`.

### Verified

Manually ran `run_monthly_usage_snapshot()` against the live project and got real,
sane numbers for every real org (Usna Gali: 2 clubs/66 players/14 staff/5 teams; CDO:
2/42/11/3; the three tournament-only orgs correctly show zero clubs/players/teams).
Verified `record_storage_event()`'s authorization directly (an org's own admin
succeeds, a different org's admin is refused, `anon` is refused both the RPC and the
table read) before trusting the R2 wiring. RLS suite 316 → **323**, all green on the
second full run (the first caught the missing suspension fence above): a new
`describe` block covers storage-event record/read authorization, the checked
function's real-caller authorization, the `_system` twins being service_role-only,
and a live `run_monthly_usage_snapshot()` call producing a real current-month row.
`npx tsc --noEmit` and `npm run build` both clean; `anon_executable_secdef_count()`
stayed `0` throughout (`record_storage_event` is `authenticated`-only by design, same
as every other user-facing SECURITY DEFINER function in this project).

### Not built, on purpose

Overage pricing (`billing_plan_meters.overage_unit_amount` stays `0` — a later,
explicit decision, not this pass's job). Deletion-aware storage accounting (uploads
only, for now — see above). A manual "recompute now" button on the Troubleshoot/
Billing tab (the monthly cron is the only trigger; add one later if waiting for the
1st becomes a real annoyance). `active_tournaments_monthly` isn't snapshotted by the
monthly job — tournaments already have their own lifecycle elsewhere in the console;
revisit if it turns out to matter for pricing.

### Follow-up, same day: infrastructure cost visibility (`phase16k`)

Immediately after the above, the user asked for something genuinely different:
"metered usage should capture micro-transactions that could have cost implications
with systems like supabase, firebase, vercel, etc" — not what any org's plan should
be measured against (§0za's own catalog above), but what running Dula HQ itself
costs to operate.

**"Micro-transactions" isn't literally achievable.** Checked first: none of
Supabase, Vercel, or Cloudflare expose individual-request cost data via any API —
all three report usage as periodic rollups (daily/monthly totals), the same
gauge-style pattern already built for the business meters, just pointed at
infrastructure instead of business entities. Confirmed with the user directly
(asked, not assumed) on three real forks:

1. **Which providers** — Vercel + Supabase + R2 (this app's actual stack). Firebase
   isn't used anywhere in this codebase — nothing to track there unless it's ever
   added.
2. **New credentials or not** — both Vercel's usage API and Supabase's Management
   API need a personal/project access token that doesn't exist in this project's
   env vars today (only the anon/service-role/R2 keys do). **Chose: estimate from
   data already in the app, no new credentials.**
3. **Per-org or platform-wide** — **platform-wide.** Most of this genuinely isn't
   attributable to one tenant's traffic (Vercel bandwidth and Supabase compute are
   shared across every org).

**What "estimate from data already in the app" actually meant, once checked:**
three of the four metrics turned out to be *exact*, not estimates — `pg_database_size(current_database())`,
`sum(storage.objects.metadata->>'size')`, and `org_storage_events` (already built
for §0za, just summed with no org filter for the platform total) are all real
Postgres data, not approximations. Only `supabase_auth_mau` is a genuine proxy
(`auth.users.last_sign_in_at` in the current month stands in for Supabase's own
MAU billing metric, which fires on any authenticated request, not just sign-in —
documented as an approximation, not claimed as exact).

**Vercel has no proxy at all**, and this app doesn't pretend otherwise — nothing in
this Postgres database can stand in for bandwidth or compute, since nothing here
logs individual HTTP requests. The UI says so directly rather than inventing a
number (`BillingConsole.tsx`): *"Vercel bandwidth and compute aren't tracked here
— nothing in this app's own data can approximate them; seeing real numbers would
need a separate connection to Vercel's own usage API."*

**New table `platform_infra_metrics`** (metric_key, value, unit, period, unique
per metric+period) — platform-admin-only read, written only by
`record_platform_infra_metric_system()` (unchecked, service_role-only, same split
discipline as §0za's own functions) which `run_monthly_infra_snapshot()` calls
directly for the same reason `run_monthly_usage_snapshot()` does: it's already the
trusted gate. Scheduled alongside the existing monthly job (`15 1 1 * *`, 15
minutes after, so they don't race).

**Cost framing without a fabricated dollar figure:** the underlying Supabase
project is still on the **free tier** (CLAUDE.md §8), so a computed "$X/month"
against paid-tier overage pricing would describe spending that isn't happening.
Instead, each Supabase metric shows against its real, stable, publicly-published
free-tier cap (DB 0.5GB, storage 1GB, 50,000 MAU) — the actual cost-implication
signal on a project that isn't paying for any of this yet is *how close to the
free ceiling*, not a hypothetical bill. R2 gets the one place a real number *is*
defensible: its always-free allowance (10GB) doesn't depend on a plan tier at all,
so overage past it is priced with Cloudflare's own flat, stable $0.015/GB-month
rate — shown as "$0/month" while under the allowance, a real estimate once over
it.

### Verified

Confirmed the authorization boundary directly before building any UI: a platform
admin (with the `email` JWT claim `is_platform_admin()` actually checks — an
earlier manual test without it read as "not admin", a test-setup gap, not a
policy bug) reads all four metrics; the same org admin who was refused §0za's
storage events is refused here too; ran `run_monthly_infra_snapshot()` manually
against the live project and got real numbers (24MB DB, 14 MAU, ~215KB Supabase
Storage, 0 R2 so far — nothing's been uploaded since §0za's "track going forward"
choice). RLS suite grew again (platform admin reads / org admin and anon refused /
the recorder and snapshot functions are service_role-only / a real snapshot run
produces exactly the four expected metric rows). Driven live in the browser as the
platform admin persona: real numbers, correct progress bars, no console errors.
`npx tsc --noEmit` and `npm run build` both clean.

---

## 1. The two deployments

| | Tournament Manager | Club Manager |
|---|---|---|
| Repo | `pharveylg/DulaHQ` | `pharveylg/dulahq-2.0` |
| Vercel project | `dula-hq` (`prj_okiIUfI48WOmItkuvV4bItutq76V`) | `dulahq-2.0` (`prj_HdHoCH2bUqKwhZz3MTCow17xoWH4`) |
| Live URL | `dula-hq.vercel.app` | **`dulahq-20.vercel.app`** |
| Stack | Vite, single-file `index.html` (~483 KB rendered) | Next.js 15 / React 19, App Router |
| Auth storage | `localStorage` | `@supabase/ssr` cookies + `src/middleware.ts` |

Vercel team `g0d3y3` (`team_gvz7rTFE9CltHjfH4DBwMTDB`), **plan: hobby**.

> The proposal document says the Club app is at `dulahq-2.0.vercel.app`. It is
> not — Vercel subdomains can't contain dots. It is `dulahq-20.vercel.app`.

Both apps share one Supabase project: **`zytyakbgwaegvftblkcn`** ("Dula HQ",
us-east-1, Postgres 17). The account has 3 Supabase projects, **2 active — the
free-tier cap**. Supabase branching is therefore unavailable; test RLS with
`begin; set local role authenticated; set local request.jwt.claims = '…'; … rollback;`

**Naming.** "2.0" is transitional. Once consolidation lands the product is just
Dula HQ: rename the repo, the Vercel project, and free the `dula-hq` **org slug**,
which is currently taken by a tenant row and collides with the platform name.

---

## 2. Verified ground truth (2026-09-07, post-migration)

| Fact | Value |
|---|---|
| Tables | 60 |
| Tables without RLS | **0** |
| Policies | 131 |
| Tables carrying `org_id` | 53 |
| Security advisor **errors** | **0** |
| `auth.users` / `public.users` | 2 / 2 — ids now **match** |
| Orgs / clubs / teams / players | 0 / 0 / 0 / 0 |
| `development_skills` | 27 (reference data, kept) |
| `backups` | 17 (1.0's live store, kept) |

`public.users.id` **is** `auth.users.id`. A trigger creates the profile row on
signup and keeps `email` in sync. `current_dula_user_id()` still exists and now
simply returns `auth.uid()`, so existing RPC callers keep working.

---

## 3. Live security issues — status

1. ~~`public.backups` has RLS disabled~~ — **fixed**. RLS on, `anon` revoked at
   the grant level (it now errors, not just returns zero rows). Policy is
   deliberately loose (any signed-in user) because `backups` has no `org_id`;
   tighten or drop it when the tournament module is settled.
2. ~~`teams` UPDATE policy with predicate `(club_id IS NULL)`~~ — **fixed**, that
   policy is gone; `teams` writes now require `can_admin_club(org_id, club_id)`.
3. ~~`registrations` INSERT predicate `true`~~ — **fixed**, now `org_id is not null`.
   Still unbounded in volume: no rate limit. Open.
4. ~~`tournament_names` SECURITY DEFINER view~~ — **dropped**. It was worse than
   flagged: unfiltered and `anon`-readable, so it leaked **every unpublished
   tournament**. Replaced by `public_tournaments` / `public_clubs`, both
   `security_invoker`, both gated on a published flag.
5. ~~Missing `search_path`~~ — **fixed** on every function.
6. ~~Helpers executable by `anon` over REST RPC~~ — **fixed**, `EXECUTE` revoked
   from `anon` on every SECURITY DEFINER function. No anon-facing policy calls a
   function, so this cost nothing.
7. **Leaked-password protection is still off.** Dashboard → Auth. Free. Open.

---

## 4. RBAC: the real shape (rebuilt)

`role_assignments (user_id, scope_type, scope_id, role, org_id)` replaces the
three competing systems. Scopes: `platform` / `org` / `club` / `team` /
`tournament`.

The legacy tables — `org_members`, `club_staff`, `user_assigned_teams` — are
**still read** by the helpers, so existing grants keep working. Write new grants
to `role_assignments`. Retiring the legacy tables is a contract step; do it only
after the app stops writing them.

`users.role` is no longer an authorization source. It is still readable; drop it
once nothing reads it.

**Two gates, asked of different subjects.** Both must pass:

- `org_has_product(org_id, 'club'|'tournament')` — what the **resource's org**
  bought. An org with no `org_entitlements` row cannot write clubs or tournaments.
- `has_role(scope_type, scope_id, roles[])` — what **this person** may do there.

Conflating them is the bug where buying a product appears to grant access to
everyone else's instances of it.

Helpers available: `is_platform_admin()`, `is_org_member()`, `is_org_admin()`,
`is_club_staff()`, `is_club_admin()`, `can_read_club(org,club)`,
`can_admin_club(org,club)`, `is_assigned_to_team()`, `is_guardian_of()`,
`is_player_self()`, `can_create_fees(org,club)`, `current_user_org_ids()`,
`current_user_team_ids()`.

---

## 5. The new API surface the app must use

**Inserts.** `org_id` is `NOT NULL` on 53 tables. A `BEFORE INSERT` trigger
derives it from the parent row for 31 of them. These have no parent — the app
must pass `org_id`: `clubs`, `guardians`, `matches`, `registrations`, `referees`,
`officiating_team`, `access_requests`, `venues`, `org_officials`,
`tournament_entries`.

**Fees.** Never set `fee_charges.status` by hand. A trigger on `payments`
recomputes it as `paid` / `partial` / `overdue` / `pending` from `sum(payments)`.

**Consent.** `requires_guardian_consent(player_id, on_date)` — computed from
`players.dob` at the date of the action, **defaults to true when dob is unknown**.
Never gate on `teams.squad_type` (a default/label only) and never on
`players.age` (a stale text column, deprecated). A 17-year-old in an adult squad
must still be caught.

Roster consent rows: `subject_type='tournament_roster'`, `subject_id=<entry id>`,
`player_id=<player>`. Schedule `expire_stale_approvals()`; until it runs,
`approval_is_granted()` still refuses anything not explicitly approved.

**The port — the only two places data crosses the org fence, both writes:**

```ts
supabase.rpc('port_squad_to_tournament', { p_entry_id, p_player_ids })
// rows of { player_id, roster_id, outcome }
// outcome ∈ 'ported' | 'consent_missing' | 'not_your_player'

supabase.rpc('port_match_results_home', { p_match_id })  // → row count
```

`port_squad_to_tournament` requires the entry to be `accepted`, refuses any minor
without an approved consent row, copies **only** name / dob / jersey, and writes
to `audit_log` in both orgs. **No SELECT policy anywhere spans a tenant.**

**Public pages.** Query `public_tournaments` / `public_clubs`. Nothing is
published by default — set `publicly_listed = true` deliberately.

**Audit.** `write_audit(org_id, action, …)`. The table is append-only: there is
no UPDATE or DELETE policy for anyone, platform admin included.

**Renamed / deprecated.** `media.r2_key` → `media.storage_key`. `players.age` and
`match_events.player_name` are display-only legacy.

---

## 6. Plan — what is left

**Done:** identity unification, tenant boundary, entitlements, RBAC, audit,
player/team decoupling, approvals, tournament schema, the port. Phases 1–5.

**A. Buy the domain, then single origin — done, DNS pending.** `dulahq.com` is
still unregistered; **`dulahq.app` was registered instead** and is attached to
the `dulahq-2.0` Vercel project (`vercel domains add`, verified
`project.attached: true, verified: true`). **DNS is not yet pointed at Vercel**
— it's still on the registrar's (GoDaddy) nameservers. Needs either an A record
at `@` → `216.198.79.1` + `64.29.17.1`, or delegating to `ns1.vercel-dns.com` /
`ns2.vercel-dns.com`; re-check with `vercel domains verify dulahq.app --scope
g0d3y3`. `dula-hq.vercel.app` is untouched, still the break-glass URL.
Rewrites `/t/:slug`, `/t/:slug/:path*`, `/platformconsole` → `dula-hq.vercel.app`
are live in `next.config.js`; `src/middleware.ts`'s auth gate excludes those
paths so the proxy isn't intercepted first. DulaHQ's canonical/`og:url` now
point at `https://dulahq.app/`.

**B. One cookie session — done.** The Vite tournament app (`pharveylg/DulaHQ`,
a single ~7,000-line `index.html` of classic synchronous inline `<script>`
tags) keeps its existing synchronous UMD Supabase client — converting the
whole file to an ES module so `@supabase/ssr`'s `createBrowserClient` would
fit was ruled out as too large and risky a change to a file this doc says to
leave alone. Instead it got a hand-rolled `storage` adapter (plain synchronous
`getItem`/`setItem`/`removeItem`) that reads/writes `document.cookie` in
`@supabase/ssr`'s exact format: verified against `@supabase/ssr@0.5.2`'s own
source rather than guessed — cookie name is supabase-js's default storage key
(`sb-<project-ref>-auth-token`, computed from `SUPABASE_URL`), value is
`'base64-'` + unpadded base64url of the UTF-8 session JSON, chunked past 3180
chars into `<name>.0`/`.1`/… cookies. The CDN `supabase-js` script tag is now
pinned to `2.112.3`, matching this repo's own `node_modules` version exactly,
since an unpinned `@2` could silently drift the storage-key derivation this
depends on. Tested end-to-end with a throwaway account against the live
project, both directions: sign in on either app, the other picks up the same
session with no second sign-in; sign out on either, the other sees it too.
Only works because both apps are served from the same `dulahq.app` origin now
(§6.A) — no `Domain` attribute is set, so it's a host-only cookie.

**C. Entry flow — done.** `/` is a public landing page (Clubs / Tournaments),
same for everyone, no role-based redirect. `/clubs` and `/clubs/[clubSlug]`
branch on auth: guests get a public view (`public_clubs`, or a same-either-way
"sign in" prompt that doesn't reveal whether a given club is private or
doesn't exist), staff get the existing console unchanged. New `/tournaments`
queries `public_tournaments` natively — not proxied, the proxy is only for
opening a specific tournament's actual engine. Login's four dead demo-account
buttons (referencing the deleted `test-*` accounts) are removed.

**D. Wire the app to §5.** `database.types.ts` is generated and committed
(`src/lib/supabase/database.types.ts`) but not yet wired into
`createClient<Database>()` in `client.ts`/`server.ts` — start there.

**E. Sports + PWA.** `sports` is seeded (football production; tennis, pickleball,
basketball `coming_soon`) and `sport_id` is on clubs, teams and tournaments.
Remaining: manifest, service worker, picker.

**F. Contract steps — audited, none executable yet.** Checked all six against
the actual app code rather than assuming:

- `users.role` as an auth source — **already clean**. Grepped every `.role`
  comparison in the app; the only reads are display (`layout.tsx`'s nav chip,
  `/clubs`' "Signed in as X"). Nothing gates on it. Can't drop the *column*
  yet, though — it's still read for that display.
- `players.age` — **already clean**. Every usage is a `${player.age}y` label
  (`PlayerDetailPanel.tsx`, the player detail page); nothing decides anything
  with it. Same story: still displayed, so not droppable yet.
- Retire `org_members` / `club_staff` / `user_assigned_teams` — **not ready**.
  Actively written by shipped features (`addStaff`, team assignment) and read
  by this session's own D-phase RPC calls. Retiring now breaks staff
  management outright.
- Retire `referees` / `officiating_team`, drop `match_events.player_name` —
  **not applicable from here**. Zero references anywhere in this app; these
  belong to the Tournament Manager app, which stays unrewritten/proxied by
  explicit rule (§8). Not this codebase's call to make.
- Drop `backups` — **not ready**, per this file's own standing note: needs
  the tournament module rebuilt to parity first, which hasn't happened.

**G. `tournaments.id` — done.** Was `text`, inherited from 1.0's
single-tournament era. Changed to `uuid` (with a `gen_random_uuid()` default,
which it never had) along with all 7 dependent `tournament_id` columns
(`matches`, `player_tournament_results` — no formal FK, same reference
regardless —, `tournament_categories`, `tournament_entries`,
`tournament_members`, `tournament_officials`, `tournament_roster`). Verified
safe before running: the Tournament Manager app's own id generator
(`newTournamentId_()`) already emits `crypto.randomUUID()` on every insert, so
this needed no change on that (explicitly unrewritten, §8) side. `DROP
VIEW`/`DROP POLICY` was needed around the migration for `public_tournaments`
and `tournament_categories`' `tc_public_read` policy, the only two things that
directly depended on the column's type — both recreated identically.
End-to-end verified: inserted a tournament with no `id` supplied, got a real
UUID back from the new default, `public_tournaments` and the `/tournaments`
page both rendered it correctly, link target was the right `/t/:org/:slug`.

---

## 7. Do not trust the proposal's appendices

`dula-hq-integration-proposal.md` Appendices A, D and F are **unverified and
contain known defects**. None of that SQL has ever been executed. The applied
migrations supersede Appendix F entirely — do not run it.

- **`has_permission(capability, scope_type, scope_id)` in D.5 ignores
  `scope_type` and `scope_id` entirely.** Superseded by `has_role()`.
- **D.5 keys RBAC on `subject_email`; F.1 on `subject_id`.** Superseded:
  `role_assignments` keys on `user_id` → `auth.users.id`.
- `granted_by email text not null` (D.5) — does not parse.
- `unique (scope_type, scope_id, subject_email, role_id)` with nullable
  `scope_id` — nulls are distinct, so platform rows duplicate freely. The applied
  version uses two partial unique indexes instead.
- No `enable row level security` anywhere in the document.
- F.2's profiles backfill breaks on duplicate emails; `_identity_missing` uses a
  predicate that can never be true, so the safety net always reports all-clear.
- Appendix A's service worker caches `/icons/192.png` while the manifest ships
  `/icons/icon-192.png` — `addAll` is atomic, so install fails and the worker
  never activates. Its scope `/` also intercepts `/t/*`, against its own footnote.
- The `@supabase/ssr` bootstrap destructures `data.user` from `getSession()`,
  which never returns one — every session reads as signed out. Use `getUser()`.

---

## 8. Constraints

- **Free-tier only** wherever possible. Vercel **hobby permits non-commercial use
  only** — the moment Dula HQ takes revenue it must move to Pro. Scheduled, not
  optional.
- Watch **Fast Origin Transfer: 10 GB/mo on hobby** — a proxy architecture spends
  this before the 100 GB visitor bandwidth. Not currently tracked anywhere.
- Supabase Free: **no automatic backups, no PITR**, pauses after 7 days idle. Set
  up a nightly `pg_dump` and a keep-alive ping.
- **Cloudflare Workers: still not used.** R2, however, **is enabled and live**
  — this line was stale as of §0j: `shared/files/lib/r2.ts` backs club media
  photos (`media-actions.ts`) and now club logos (`EditNameForm.tsx`, §0j),
  both verified working against the real bucket. Storage is a mix of
  Supabase (1 GB free, small structured blobs like `document_uploads`) and
  R2 (photos, logos) — not Supabase alone. `wrangler.toml` in this repo is
  still dead weight; nothing here runs on Workers.
- Supabase built-in email sends **2 per hour** — blocks guardian signup, password
  resets and staff invites. Wire custom SMTP (Resend free 3k/mo, Brevo 300/day)
  before onboarding any real club. **This blocks the consent flow**, which is the
  guardian's first contact with the product.
- Player and guardian records are **minors' data**. Backups and retention are not
  optional niceties.

---

## 9. How to work on this

- **Run the SQL.** Every defect in §7 would have surfaced on first execution.
  Migrations live in `supabase/migrations/` as `.sql` files, not in a Markdown
  appendix.
- **Ask for a test, not just a fix.** Two that caught real bugs on 2026-09-07:
  an `anon` simulation proved the public directory had gone dark after a policy
  rebuild dropped its policies; a port call with no consent recorded proved the
  minor was refused and the adult was not.
- **Beware drop-all policy rebuilds.** `phase2e` drops every policy per table
  before recreating them, which silently removed the anon directory policies
  created in `phase2d`. `phase2f` restores them and must stay ordered after 2e.
- **Verify against the live project, not the document.**
  `mcp__Supabase__get_advisors` and `pg_policies` are the source of truth.
- Keep the tournament engine unrewritten. It works. It is proxied, never ported.

---

## 10. RBAC demo (2026-09-07)

`/demo` is a public page with one standing, real account per RBAC role
(platform admin, org admin, club admin, coach, team manager, staff, guardian,
player), signing straight into a standing demo club and tournament —
`scripts/seed-rbac-demo.mjs` creates all of it (org slug `dulahq-rbac-demo`,
club `dulahq-demo-club`, tournament `dulahq-demo-cup`). Shared password
`DemoPass2026!` — not a real secret, intentionally public, don't reuse it for
anything that matters.

Deliberately a **separate org from `loadDemoData`/`wipeDemoData`** (§0b's
`dula-demo`) so clicking "Wipe demo data" on `/clubs` never touches it. Re-run
the seed script any time to reset it (it cleans up its own prior run first).

The demo tournament's `data` column is intentionally left empty rather than
hand-crafted — the live Tournament Manager app serializes its *entire*
working state (brackets, rosters, live scores) as one opaque JSON blob into
that column on every save (`saveTenantTournament_()` in `index.html`,
literally `JSON.stringify(S)` where `S` is the whole in-memory app state).
Faking that blob by hand would mean reverse-engineering an undocumented
internal format — exactly the risk §8's "keep it unrewritten" rule exists to
avoid. An empty `data` renders the app's own placeholder content instead,
which is what `/t/dulahq-rbac-demo/dulahq-demo-cup` currently shows. If a
populated bracket is ever wanted for the demo, build it by driving the real
UI as the org admin persona (`is_org_admin` + the `tournament` entitlement
already let that account manage it), not by writing to `data` directly.

**Note: this section describes the original setup and is stale on specifics**
(`seed-rbac-demo.mjs`/`dulahq-rbac-demo` predate the four-org showcase dataset
`scripts/seed-showcase-demo.mjs` now seeds, which `/demo` actually points at —
see `docs/demo-data-showcase.md` for the current accounts). Not rewritten here,
out of scope for the change below; flagged so it isn't trusted at face value.

**2026-09-29: `/demo` reorganized, platform admin removed from it.** The page
is unauthenticated (`middleware.ts`'s `PUBLIC_PATHS`) and might get shown to a
prospect — a one-click button granting full platform-admin access on a public
page was a real exposure, not just untidy. Removed outright, not just hidden:
platform admin still signs in the normal way (`/login` with a real account) and
opens `/platformconsole` directly: nothing about that path needs a demo
shortcut, since the console itself already gates on `is_platform_admin()`.
The remaining 8 personas (`DemoPersonas.tsx`) are now grouped into **Club
Roles** and **Tournament Roles**, each `Persona` carrying a `products: Product[]`
field rather than being implicitly one or the other. Only **Org admin** is
genuinely shared — an org admin's authority spans whatever entitlements their
org holds (Usna Gali has both), not one product's own staff table — and its
card renders in **both** sections with a "Shared access — club + tournament"
chip, rather than a separate third bucket, so the note appears exactly where
someone would look for that role. No other current persona's role string is
actually shared between the club_staff and tournament_staff catalogs (that's
`secretary`/`treasurer`, per §0l — no demo account exists for either yet).
Verified live: platform admin button gone, both sections render with the
right personas, the shared chip appears on both Org admin cards. `npx tsc
--noEmit` and `npm run build` both clean.

**Same day, immediate follow-up: "(demo)" tagging, contained edits, and a
logout fix.** Three more asks, one genuinely hard.

- **"(demo)" tag, everywhere a demo account's role is shown.** The label was
  always the wrong thing to begin with: `layout.tsx`'s nav chip and
  `/clubs`' "Signed in as X" line both read `public.users.role`, a legacy
  display-only column (§5/§6.F) that's literally just `"audience"` for
  every demo account — not "Team Manager." Pulled the real label instead
  from a single new file, `src/lib/demo-personas.ts` (`PERSONAS` moved out
  of `DemoPersonas.tsx` into it, imported back rather than duplicated), with
  a `getDisplayRole(email, fallbackRole)` helper: known `@dulahq-showcase.local`
  emails get `"<real role> (demo)"`, everyone else keeps their normal
  role/fallback unchanged. Wired into three places: the persona picker
  card, the site-wide nav chip, `/clubs`' subtitle.
- **Logout redirect.** `NavActions.tsx` pushed to `/login` after sign-out;
  changed to `/` — one line, matches how `/` already handles both guest and
  signed-in views with no login wall.
- **Contained demo edits — proposed three options, user picked Option B**
  (real writes through the real app, reverted on a schedule) **at a 30-minute
  cadence**, not the nightly cadence first proposed. Ruled out true
  per-session isolation as disproportionate here: Supabase free tier has no
  branching (§1), and demo personas are standing shared accounts, not
  unique per visitor, so two prospects could be on the *same* account
  concurrently — real session-scoped isolation would need either simulating
  every write client-side (touches nearly every feature in the app) or
  provisioning a fresh cloned tenant per sign-in (a real build, not a
  config change). A scheduled reset costs almost nothing because the reset
  mechanism already existed and needed no changes: `scripts/seed-showcase-demo.mjs`
  is already idempotent and safely re-runnable (wipes its own prior run by
  org slug and by the `@dulahq-showcase.local` domain before reseeding).

  New `.github/workflows/reset-demo-data.yml` (`schedule: */30 * * * *`,
  plus `workflow_dispatch` for a manual "run now"), running that exact
  script against the **live** project unchanged — no script logic added,
  only the schedule and credentials. Needs two new GitHub Actions secrets
  this session could not add itself (repo settings access, and the service-role
  key shouldn't be handled in chat either way): `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY`, same values as `.env.local`. **Until those
  are added, the workflow will fail on every scheduled run** — flagged
  here so a string of red X's in the Actions tab isn't mistaken for a new
  bug. R2 credentials weren't requested: the seed script's own poster/logo
  step already treats a missing/failed R2 upload as a non-fatal warning,
  and it's a no-op after the first successful run anyway
  (`seed-directory-art.mjs` skips anything that already has an image).

  Honest limit, stated rather than glossed over: this is "resets every 30
  minutes," not "vanishes the instant you log out." Two prospects on the
  same persona within the same 30-minute window can still see each other's
  edits. Accepted tradeoff for the cost, per the user's own choice of
  Option B.

Not yet verified live (the workflow can't actually run until the two
secrets above are added) — `npx tsc --noEmit` and `npm run build` both
clean for the app-code changes; the workflow YAML itself wasn't run.

---

## 0zb. Mobile nav on the frozen Tournament Manager, and where OLLES's accent color actually stops (2026-09-29)

Two reports checked the same day, both against `ollesfc`/`ollescup15` (15th OLLES Cup).

### The pre-sign-in bottom tabs, and a duplicate "Teams" in the More sheet

"At the login screen for tournaments, the tabs at the bottom should not be
there... the dropdown for categories, schedule, etc. should not be redundant
to the bottom tabs" was about the frozen sibling `DulaHQ` (Vite) repo, not this
one — a deliberate, scoped exception to §8's "keep it unrewritten" rule, same
precedent as the demo-gallery removal in §0z. Confirmed live at mobile
viewport (375×812) before touching anything: `#signin-wrap` was covering the
screen, but `renderNav()` had already populated the bottom tab bar, the
category strip and the header dropdown behind it — clickable, not just
visible. `AUTH.signedIn` starts `false` and every real entry point
(`completeLogin`, `enterGuestView`, the demo/superadmin/tenant logins,
`guestRegisterTeam`) sets it `true` right before its own `renderNav()` call, so
`renderNav()` now bails out (clearing all four nav surfaces, mirroring the
existing `superadmin`/`guestTeamReg` bail-out shape already in the function)
until one of those has run.

Separately, admin's curated `MOB_BAR` bottom bar (Home/Teams/Groups/
Officials/Bracket — the only role with a curated subset; every other role's
full nav list is 7 items or fewer) left the "More" overflow sheet rendering
the role's *entire* unfiltered `NAV` list, so "Teams" (and Home/Groups/
Officials/Bracket) appeared a second time under People. Fixed by excluding
whatever page key already has a bottom tab before building the sheet.
Desktop's header dropdown was left untouched on purpose — it's the sole nav
there (no bottom bar to duplicate against), so it still needs every item.

Verified live end-to-end against a local static build of the edited file:
signed out, `#mob-nav-inner`/`#category-strip`/`#manage-dropdown-wrap` all
empty; "Continue as Guest" (audience role) repopulates the bar correctly;
signing in as a real `admin`-role account (`org_members.role`, this app's own
untouched role system) shows the curated 5-tab bar plus "More", and the More
sheet lists Setup/Categories/Registrations/Access Requests/Document Reviews/
Users/Referees/Officiating Team/Standings/Live Streams/Audit trail plus the
system items — no Home/Teams/Groups/Officials/Bracket. Committed to `DulaHQ`
directly (`19eb2b3`), not this repo.

### OLLES's accent color: correct in the new console, absent by design in the old engine

"The accent color selected for the org did not carry over to their tournament
screen color theme... check 15th OLLES Cup" turned out to be two different
screens with two different, both-correct answers, not one bug. `organizations
.accent` for `ollesfc` is `#009dff`, confirmed via SQL. Checked both consumers
live, signed in as a throwaway org-admin scoped to that org:

- **`/tm/ollesfc/ollescup15`** (this repo's own native organizer console,
  §0o) — `.org-accent-scope`'s computed `--accent` and `--accent-gradient`
  both read `#009dff`, and a real rendered button's background is
  `rgb(0, 157, 255)`. Theming works exactly as built in §0w.
- **`/t/ollesfc/ollescup15`** (the proxied, frozen `DulaHQ` engine) — no
  `.org-accent-scope` element exists at all and no accent custom property is
  set anywhere on the page. This is the screen the user actually meant, and
  it was never wired up: §0w/§0x/§0y's org-accent-theming work only ever
  extended to this repo's own `/c/` and `/tm/` layouts, never into the
  frozen Vite app §8 keeps unrewritten. Not a regression — a real, so-far
  undocumented scope boundary, now recorded here rather than left to look
  like a bug on the next report. Extending it would mean giving the frozen
  engine its own accent-reading boot step, which is a real (if small) carve-out
  of "unrewritten," not attempted here without it being asked for directly.

No code change followed from this half — reported as a finding, not a fix.

---

## 0zc. Homepage: Tournaments first, both sections collapsible, "(demo)" tags (2026-09-29)

Three asks against the public directory on `/`: swap section order (Tournaments
before Clubs), make both collapsible, and label showcase data "(demo)".

**Order and collapse.** `PublicDirectory()` in [src/app/page.tsx](src/app/page.tsx)
now renders Tournaments, then Clubs, then Courts, each wrapped in a native
`<details className="dir-section" open>`/`<summary>` instead of a plain
`<section>` — no client JS, the browser owns open/closed state, and it degrades
to plain content if CSS fails. All three default open, so nothing changes
visually until someone collapses one. `.dir-section`/`.dir-section-chevron` in
[globals.css](src/app/globals.css) suppress the native disclosure marker
(`list-style: none` for Firefox, `::-webkit-details-marker` for Chromium/Safari)
and draw a `▸` that rotates 90° on `[open]` instead, so the summary reads as the
section's own heading rather than a generic widget.

**"(demo)" tagging.** New [src/lib/demo-orgs.ts](src/lib/demo-orgs.ts) — pure,
same discipline as `demo-personas.ts`'s own `DEMO_EMAIL_DOMAIN` check — hardcodes
the four showcase org slugs `scripts/seed-showcase-demo.mjs` creates (`usna-gali`,
`cdo-ysc`, `pilipinas-futbol`, `davao-unity-sports`; confirmed against the seed
script rather than guessed). `public_clubs`/`public_tournaments` already returned
`org_slug` (added for logo/poster resolution); `loadPublicClubs`/
`loadPublicTournaments` in [public-directory.ts](src/lib/public-directory.ts) now
also select it and compute `isDemo` once, so `PublicClubList`/
`PublicTournamentList` just render `.dir-demo-tag` (italic, `--text-muted`, no new
color) next to the name — no org-slug list duplicated into either component. No
migration: both view columns already existed, this only changed what the loader
selects.

**OLLES confirmed not a showcase org**, matching §0zb's own finding earlier the
same day — "15th OLLES Cup" renders untagged, the four showcase orgs' clubs and
tournaments all render "(demo)".

Verified live: page text at both desktop and mobile (375×812) viewport shows the
new Tournaments-then-Clubs-then-Courts order with every showcase listing tagged
and OLLES's own untagged; clicking the "Tournaments" summary collapses only that
section (Clubs/Courts stay open, re-verified via `details.open` + the chevron's
computed `transform` rather than trusting a screenshot, matching this project's
established verification discipline) and clicking again reopens it cleanly.
`npx tsc --noEmit` and `npm run build` both clean (the only errors are the
pre-existing, unrelated `tests/rls/club-manager-isolation.test.ts` batch §0m
already recorded). Hit the same corrupted dev-server webpack cache §0y already
documented (`Cannot find module './873.js'`, caused here by running `npm run
build` against the same `.next` directory a dev server already had open) —
cleared `.next` and restarted, same fix as last time.

---

## 0zd. Tournament Roles demo personas: the rest of the catalog (2026-09-29)

`/demo`'s "Tournament Roles" section had only two cards (Org admin, Tournament
organizer) against "Club Roles"' seven — flagged by the user, who also asked
for something plain-English ("referee, official/committee") that doesn't map
1:1 to any role string in either system. Checked before building: on-field
match officials (`org_officials`/`tournament_officials`) have no login at all
in this app — a pool of names, not accounts — so they can't be a "sign in as"
persona regardless of interpretation. Asked the user to pick a scope; they
confirmed the full remaining `tournament_staff` catalog (six roles:
`tournament_it_admin`, `team_coordinator`, `secretary`, `treasurer`,
`communications`, `referee_coordinator` — `logistics`/`volunteer_coordinator`
stay retired per §0u).

All six join the *same* Tiger Cup entry (Davao Unity Sports) as the existing
Organizer persona, rather than being spread across tournaments — same
reasoning §0d already used for the coach/team-manager pair sharing U15 Girls:
one console where all seven tournament roles are directly comparable.

`scripts/seed-demo-tournament-staff.mjs` (new) mirrors
`scripts/seed-demo-organizer.mjs`'s own pattern exactly — idempotent,
upsert-by-`(tournament_id, user_id, role)`, no destructive wipe — so it could
be run once against the live database without touching any other demo data.
`scripts/seed-showcase-demo.mjs` gained the same six accounts (in a
`TOURNAMENT_OFFICE_ROLES` loop right after the Organizer block, plus a
`report.demoPersonas.tournamentOfficeRoles` array feeding `writeReport()`'s
table) so a future full re-seed keeps them — not run this session, since a
full re-seed is destructive to live demo data and the standalone script
already had the live effect. `src/lib/demo-personas.ts` gained six `Persona`
entries; `/demo`'s grouping is entirely data-driven off `products`, so no
component code changed.

Descriptions state each role's real boundary rather than just its name:
Team coordinator reviews/flags but cannot decide (Organizer alone can, per
§0l's deliberate deviation from the Team Manager spec's own suggestion);
Referee coordinator assigns officials to *this* tournament's matches but
cannot touch the org-wide officials pool (`org_admin`-only, §0o/§0y); IT admin
holds no business authority at all (mirrors club IT admin, §0e).

Verified live: signed in as Referee coordinator, landed on the console
showing exactly Entries/Categories/Officials (no Finance/Staff/Announcements/
Public listing — matches holding only `manage_officiating`); signed in as
Organizer and opened Staff, which now lists all 7 tournament_staff rows with
the right names, emails and roles. `npx tsc --noEmit` and `npm run build`
both clean. The RLS suite wasn't re-run — this added only data rows through
already-covered, unchanged authorization paths (`tournament_staff` insert via
service role, which bypasses RLS; the console itself is gated by policies the
existing 328-test suite already exercises), and the live sign-in above is
itself an end-to-end proof against the real RLS, not a substitute test.

---

## 0ze. `/official`: a self-view page for a linked official, and a Referee persona (2026-09-29)

Follow-up to §0zd. Asked why a referee/official persona couldn't be added
too. Checked rather than assumed: `org_officials.user_id` **is** nullable-
linkable to a real login, and `officials_read`/`toff_read` already let a
linked official read their own pool row and their own match assignments
(phase16c, §0y) — a login was never the blocker. The real gap: **nothing in
the app renders anything for that account.** Grepped every consumer of
`org_officials`/`tournament_officials` — the only one is the organizer
console's own Officials tab (staff-side, assigning officials), never a
self-service view. Signing a linked official in would have landed them on
the plain public homepage, same as a guest, since `personaLanding()` only
knew about org membership, club staff and tournament staff. Confirmed this
with the user before building — not a hard wall, just unbuilt — and they
asked for the real page, not just the persona.

**`my_officiating_assignments()`** (`phase16l`, new SECURITY DEFINER
function, self-scoped on `auth.uid()`, no parameter) is why a new function
was needed at all: a linked official's own `tournament_officials` row is
directly readable, but **`tournaments`' own SELECT policy** is
`is_org_member` OR `is_tournament_staff` OR publicly-listed — none of which
covers a plain `org_officials.user_id` link, and a private tournament isn't
in `public_tournaments` either. A plain embedded select would have silently
returned `tournaments: null` for every row the page needs to show. Same
shape as `entrant_entry_portal()` needing a definer function for the same
reason. Verified the self-scoping directly: the org admin persona (zero
`org_officials` rows) gets zero rows back, provable both by query and by the
function's own `where o.user_id = auth.uid()` — no parameter to widen, so
there is nothing else to check. `anon_executable_secdef_count()` stayed `0`
after adding it.

**`/official`** (new page) mirrors `/player`/`/guardian`'s own shape: auth-
gated, a "not linked" empty state for a real signed-in account with no
`org_officials` row, otherwise a read-only profile card (org, designation,
grade, contact info, active/inactive) per linked official row plus an
Assignments list (tournament name, org, date, venue, role) from the new RPC,
each row linking out to `/t/<orgSlug>`. Deliberately read-only — adding,
editing or assigning an official all stay staff-side actions in the
organizer console; this page has no write path at all.

**`getMyPersonas()`/`persona-landing.ts`** gained a third persona
(`official`, optional on the type so existing call sites without it keep
compiling), alongside guardian/player: `personaLanding` now also redirects
"/" to `/official` for a linked official with no org and nothing to manage
(after guardian/player, same ordering rationale as the existing two), and
`personaLinks` offers a "My officiating" nav link. Both call sites
(`page.tsx`, `layout.tsx`) already spread `getMyPersonas()`'s full result, so
neither needed a code change.

**Referee demo persona** links a new account to the *existing* "Mark
Bendijo" / Head Referee `org_officials` row at Davao Unity Sports (Davao's
own officials pool, seeded by `seed-showcase-demo.mjs`) rather than creating
a fresh, unassigned pool member — so `/official` has a real assignment to
show from the first sign-in, not an empty list. `scripts/seed-demo-
referee.mjs` (new) mirrors `seed-demo-organizer.mjs`'s own idempotent,
non-destructive pattern; `seed-showcase-demo.mjs` links the same official
(reading `davaoOfficials[0].full_name` rather than hardcoding it, so the
name stays correct even though it comes from the script's own deterministic-
but-order-dependent name generator) so a future full re-seed keeps it.
`src/lib/demo-personas.ts` gained one more entry (`destination: () =>
'/official'`), explicit in its own description that this is `org_officials`,
not `tournament_staff` — no console, just this one page.

Verified live: signed in as the new Referee persona, landed directly on
`/official` (confirming the persona-landing redirect fires for a real
account, not just the unit test) with the real profile (Head Referee, Davao
Unity Sports, phone/email on file) and exactly one real assignment (National
Team Qualifiers, correctly joined — Tiger Cup's own earlier assignment for
this official is no longer live, from other testing in an earlier session;
the page correctly reflects whatever is actually in the database rather than
what the original seed script intended); the "My officiating" nav link
present and pointed at `/official`; no console errors. Unit suite 79 → **81**
(two new `persona-landing.test.ts` cases). `npx tsc --noEmit` and `npm run
build` both clean (confirmed `/official` in the route list). The RLS suite
wasn't re-run — no policy changed, and the self-scoping proof above already
covers the one new authorization surface directly.

**A real bug, found live the same day by the user clicking through the new
persona, not by inspection:** `/official`'s Assignments list linked each row
to `/t/<orgSlug>` — the frozen Tournament Manager engine. That app resolves
identity purely from `org_members`/`club_staff` (§0a's decade-old model); it
has no concept of `org_officials` at all. Following the link while signed in
as the Referee persona reproduced exactly: `#signin-wrap`'s `completeSupabaseLogin_`
(shared session, §6.B) tried to resolve the referee's email against
`org_members`, found nothing, fell back to `platform_admins`, found nothing
there either, and showed "Signed in as X, but no tenant membership was
found. Contact your platform admin." — alarming and wrong, since nothing
actually needs a platform admin's attention. Fixed in `dula-hq-2.0` by
removing the link entirely (assignment rows are now plain, non-clickable —
there is no coherent destination for this identity in that app). `/official`
was never supposed to send anyone there in the first place; this was always
going to break, the persona just gave a live account to actually click it.

**The same trap turned out to be much older and broader**, confirmed by
reproducing it as the pre-existing **Tournament organizer** persona too, via
the organizer console's own "Open tournament engine" link — every one of the
now-8 tournament_staff personas hits the identical error, since none of them
have an `org_members` row either; this predates today's work entirely; today's
six new personas just made a rarely-exercised corner far more likely to be
clicked. Fixed at the source in `DulaHQ/index.html` (`b2fc1fa` — a third
deliberate, narrow exception to §8's "keep it unrewritten," same precedent as
the mobile-nav fix and the demo-gallery removal): reworded the message reached
from any `/t/...` URL (`checkPlatformAdmin()`'s failure branch — the one both
the referee and the organizer actually hit) to "Signed in as X, but this
account has no role in this tournament here. Continue as a guest below, or
sign in with a different account." — accurate for both identity shapes, and
correct that `Continue as Guest` was sitting right there the whole time,
functional, just next to a message that made it look like something was
broken. The generic root-sign-in copy of this same string (reached only by
signing in directly on that app's own root domain, with no tenant URL at all —
none of this app's links produce that path) was deliberately left unchanged, a
narrower, less-reached case not worth conflating with this fix.

Verified live end-to-end on both fixes: cleared cookies, signed in fresh as
the Referee persona, clicked the (now plain-text) assignment row — no
navigation, stays on `/official`; separately reproduced the Organizer's
"Open tournament engine" failure before the fix (`#auth-error` read exactly
the old string) and confirmed the reworded string renders correctly at that
exact URL after deploying the `DulaHQ` fix.

---

## 0zf. Every persona should exercise its own role, not just view it (2026-09-29)

Direct follow-up: the wording fix above stopped the Referee persona from
hitting a scary error, but it still couldn't do the one thing a referee
actually does — officiate a match. Asked to make that work, and to check
every other persona against the same bar: can they *do* their role's real
actions, not just look at a page.

### The audit

Went through all 16 personas against what their console/page actually
permits writing, not just what it shows:

- **Club side (7) and the shared Org admin**: already fully functional —
  rename/staff/finance/membership (club manager), author development records
  (coach), documents/membership (team manager), view-as + audit (IT admin),
  confirm/decline roster acknowledgements + submit payment (guardian), create
  clubs/tournaments (org admin). Player is inherently the one mostly-viewing
  role in the real product too (a player doesn't administratively act on
  their own record) — not a demo gap, a correct reflection of the role.
- **Tournament side (6 of 7 tournament_staff roles)**: already fully
  functional — accept/decline entries (Organizer), create/reissue logins +
  suspend accounts (IT admin), add notes/flags (Team coordinator), review
  documents (Secretary), issue invoices/record payments (Treasurer), post
  announcements (Communications), assign officials (Referee coordinator) —
  every one of these is a real, previously-verified RLS-backed write path.
- **Referee**: the one genuine gap. `/official` (§0ze) was deliberately
  read-only, and the *actual* match-officiating functions (claim a match,
  start it, log events, enter a score, end it) live entirely inside the
  frozen `DulaHQ` engine's own legacy identity system (`org_members.role =
  'referee'`) — a system `org_officials`-linked accounts had no standing in
  at all until this pass.

### The decision, and why the obvious shortcut was wrong

The fast fix — add an `org_members` row (`role='referee'`) for the Referee
persona at Davao Unity Sports — was rejected on purpose. `org_members` isn't
`DulaHQ`-only data: `is_org_member()`/`is_org_admin()` and most of
`dula-hq-2.0`'s own RLS read it too, so that row would have quietly made the
persona an "org member" of Davao Unity Sports in the *newer* system as well
— exactly the standing this whole project has deliberately withheld from
officials everywhere else (§0l, §0y: an official is a name in a pool, never
folded into `org_members`/`club_staff`). A demo shortcut that widens a real
security boundary, even narrowly, isn't a shortcut worth taking.

Built the clean version instead, in `DulaHQ/index.html` (`22670ab` — a fourth
deliberate, narrow exception to §8, same precedent as the three before it):
`resolveOrgMember`'s failure branch, when an org is known (a `/t/{org-slug}
...` URL) and no `org_members` row exists, now also checks `org_officials`
via `checkOrgOfficial()` — keyed on `user_id = auth.uid()`, the same
self-read RLS branch phase16c already granted. Found active, it's treated
exactly like a real `org_members` row with `role='referee'` from that point
on: `loadTenantTournament_()` doesn't care how the role was determined, so
claiming, scoring and ending a match all work identically either way, with
zero change to what `dula-hq-2.0`'s own RLS grants the account.

`/official`'s assignment link (removed in §0ze because it only ever failed)
is back — now pointing at the specific tournament
(`/t/<org_slug>/<tournament_slug>`, more precise than the org-only link
removed before) — because it now actually works.

### A genuine surprise while verifying

Signed in as the Referee persona on a local static build, claimed "Pagadian
Panthers vs Tagum Titans," started it, logged a goal (1–0), ended the match —
full-time score recorded, "pending verification by the tournament
committee." Real, working, end-to-end. But a direct query afterward showed
`tournaments.data` for Tiger Cup is **null** — none of this was ever written
to the database. The referee console's own "Generate draw first" fallback
(seen elsewhere in this file) means an empty `data` makes the app
synthesize a believable placeholder bracket entirely client-side, and my
claim/score/end actions only ever mutated that transient state. Reassuring
for cleanup (nothing to revert, confirmed by re-querying — the match is
exactly as unplayed in the database as it always was) but worth recording
plainly: the "real game" exercised here is the app's own placeholder
fallback, not curated seed data, for this specific tournament. The
underlying code path is identical to what a real production referee with
real bracket data would use.

### Verified

Local static build (`serve -s`, SPA fallback needed — plain `serve` 404s on
nested `/t/<org>/<tournament>` paths, a pure local-testing quirk unrelated to
Vercel's own rewrites): fresh cookies, signed in as the Referee persona,
landed with `S.role === 'referee'` and no error; claimed a match, started it,
logged a goal, ended it, final score correct; confirmed via direct query
that `tournaments.data` stayed null throughout. `npx tsc --noEmit` clean for
the `dula-hq-2.0` side.

### A second, real bug found immediately after — a genuine race, not flaky testing

Re-verifying the same flow on **production** (not the local build) via the
*actual* click-through path (`/demo` → `/official` → click the assignment
link, exactly how a real user reaches it — the local test above had signed
in via a raw `signInWithPassword()` call instead) intermittently failed with
the *old, unworded* "no tenant membership was found" string, `S.role:
"admin"`, `signedIn: false` — as if none of this session's fixes existed. A
fresh incognito-equivalent tab reproduced it too, ruling out stale tab state.

Root cause: `completeSupabaseLogin_`'s `/t/{org-slug}` branch trusted
`PENDING_TENANT_ORG_SLUG`, a global the file's own `/t/` boot path — a
*separate* script block near the very end of the file — sets. That block's
own comment claimed the global is "always ready" by the time the auth
callback reads it. Demonstrably false: an *already-persisted* session
(exactly what arriving via a shared cookie from an already-signed-in
`dula-hq-2.0` page means, §6.B) fires `completeSupabaseLogin_` the instant
the Supabase client restores it from the cookie — no network round-trip
needed — which can beat the later boot script to the punch. A `signInWithPassword()`
call made *after* the page has already finished loading (the local test's
own method) can never race this way, since it necessarily waits on a real
network response; that's why the first round of local verification missed it
entirely.

Fixed by removing the shared mutable state instead of trying to sequence
around it: `completeSupabaseLogin_` now parses `location.pathname` itself,
fresh, at the point of use — a pure string match with no network call and no
dependency on script-execution order. `checkOrgOfficial`/`resolveOrgMember`
downstream are unchanged; only how the org slug is obtained changed.

Reproduced the exact failing shape locally (sign in first, *then* navigate
fresh to the tournament URL — the only way to make an already-persisted
session race the boot script on a controlled machine) and confirmed clean
across three consecutive runs after the fix. Also re-confirmed the
Organizer's still-unrecognized-here behavior is unchanged (`tournament_staff`
recognition was never in scope this round, only `org_officials` — the
reworded, non-alarming "no role" message still shows, as documented in §0ze).
