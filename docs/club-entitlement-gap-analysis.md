# Club entitlement — gap analysis (2026-09-09)

Prepared before scoping the Tournament entitlement and the combined Club+Tournament
entitlement. Every claim below was checked directly against the live schema
(`zytyakbgwaegvftblkcn`), the permission catalog (`permissions` /
`role_permission_defaults` / `guardian_permission_defaults`), and the actual
application code — not against CLAUDE.md's own prior summaries, which this
exercise treats as a starting hypothesis, not ground truth. Where a table exists
but is empty or a permission key exists but no code reads it, that is stated
explicitly, because "the schema has a column for it" and "the feature exists" are
different claims and this document does not conflate them.

Role bundles at the time of writing (`role_permission_defaults`):

| Role | Permission count |
|---|---|
| `club_manager` | 19 |
| `coach` | 19 |
| `team_manager` | 17 |
| `staff` | 9 |
| `assistant_coach` | 7 |
| `treasurer` | 5 |
| `secretary` | 6 |
| `club_it_admin` | 2 |

---

## 1. Organization member profiles

**What exists.** `club_staff` is `(club_id, user_id, role, created_at, updated_at,
created_by, org_id)` — no profile fields at all. `users` is `(id, name, email,
role, linked_referee_id, created_at)`. That is the entire staff-facing data
model: a name, an email, and a role string. Contrast `players`, which has
`photo_url`, `notes`, `dob`, `preferred_foot`, `secondary_position`,
`development_status`, and a full six-tab canonical profile
(`PlayerProfile.tsx`: Overview/Development/Fees/Membership/Documents/Family).
There is no equivalent for a coach, team manager, treasurer, secretary, or club
manager — not a stub, not a placeholder tab, nothing.

There is also a **second, orphaned staff table**: `team_staff`
`(id, team_id, name, role, role_other, phone, org_id)` — no `user_id` at all, so
it cannot represent an account-holding person and cannot participate in RLS,
permissions, or assignment. It has **zero rows** and zero code references outside
`database.types.ts`. This predates `club_staff` + `user_assigned_teams` and was
never retired.

**Committee heads** cannot exist as a role at all: the `club_staff.role` CHECK
constraint permits exactly `club_manager, staff, coach, team_manager,
assistant_coach, treasurer, secretary, club_it_admin`. There is no `committees`
table anywhere in the schema.

**Classification.**
- No staff profile → **actually missing (P1)**. A club cannot show "who is our
  U15 Girls coach" beyond a bare email in most views (see §6, the "Unknown" bug).
- `team_staff` → **redundant, should be removed**. Confirm nothing in a seed
  script or import path still targets it, then drop it. Carrying a second,
  weaker staff shape forward into Tournament (where "who officiated" already has
  its own tables, §13) compounds rather than resolves this.
- Committee Heads → **defer**, but see §3/§13 — do not build a club-only
  committee model now if Tournament will need the same concept for organizing
  committees. Building it twice is the actual risk, not building it late.

**What a profile should carry, split by owner** (the account/membership/profile
split the request asked for):
- **Account** (`users`): name, email, auth state. Already correct; do not
  duplicate here.
- **Org membership** (`club_staff` + `user_assigned_teams`): role, assigned
  teams, primary-coach designation (now exists, phase6x), status (see §4 — does
  **not** exist), join date (does **not** exist — `created_at` is a row-creation
  timestamp, not a considered "member since" date, though it is the only
  candidate today).
- **Role-specific profile** (new): photo, phone, a short bio/qualifications
  field, certifications with expiry (for a coach's license, a treasurer's
  signing authority, etc.). This is genuinely new — nothing today is even a
  weak substitute, `team_staff.phone` included, since it isn't wired to
  anything.

---

## 2. Club identity and branding

**What exists.** `clubs.branding jsonb`, `clubs.settings jsonb`, `clubs.about
text`, `clubs.location text`, plus `slug`, `publicly_listed`, `sport_id`. In the
live showcase data, `branding` and `settings` are `{}` on every club, while
`about` and `location` are populated with real prose — because they were written
directly by the seed script, not through any application UI. The **only**
club-editing surface in the entire app is `EditNameForm.tsx`, which edits
exactly one field: the name. `about`, `location`, `branding`, and `settings` are
schema-only; a real club manager has no way to set any of them.

There is no club logo field (nowhere in `clubs`, nowhere in `branding`'s actual
usage — it's never read). There is no team logo/badge column at all. Separately,
`organizations` carries its **own** `logo_url` and `accent` — used today by the
platform-admin `Directory.tsx` for the org list, not by any club-facing surface.
The showcase data already has **two orgs each owning two clubs**, so "the org
has a logo, the club has none, which one prints on a roster export" is not a
hypothetical — it's the live shape.

**Classification.**
- Club logo/branding UI → **actually missing (P0)**. `RosterBuilder.tsx`'s TXT
  export already prints a "DULA HQ — TOURNAMENT ROSTER" header with no club
  identity on it at all; this is the concrete, already-shipped feature that
  needs it.
- `about`/`location`/`branding`/`settings` columns with no editing path →
  **already covered elsewhere and only needs surfacing** — the columns are
  right, they're just inert. Extend `EditNameForm`'s pattern (or replace it with
  a proper "Club profile" settings section) rather than adding new columns.
- Org-level vs. club-level branding conflict → **flag now, resolve before
  Tournament**. Tournament hosting is an org-level concept
  (`tournament_entries.host_org_id`), so tournament-facing surfaces will
  naturally want the **org's** branding, while club-facing surfaces (rosters,
  club-scoped exports) want the **club's**. Decide the precedence rule now
  (club branding overrides org branding when both exist; falls back to org
  otherwise) rather than discovering it mid-Tournament-build when a host org
  with two clubs entered generates a roster and nobody decided whose crest goes
  on it.

---

## 3. Organization structure / org chart

**What exists.** Nothing visual. The relationships are real and queryable —
`user_assigned_teams` (who's on which team, `is_primary` since phase6x),
`club_staff.role` (functional role), `has_staff_permission()` (effective
authority) — but there is no page that renders them as a structure. The closest
thing is the Staff tab's flat list (`StaffRow.tsx`), which shows one person per
row with inline team chips; it does not show a team's chain (primary coach →
assistant coaches → team manager) or the club-wide functional roles
(treasurer/secretary/club manager) as a single coherent picture.

**Classification.** **Actually missing, but P2, not P0.** The underlying data
(role + team assignment + primary designation) is now complete enough (post
phase6x) that a chart is a **read-only rendering problem**, not a modeling
problem — this is exactly the "derived, never a second dataset" pattern the
codebase already uses for roster state (`roster-state.ts`, CLAUDE.md §0f). Build
it as a pure view over `club_staff` + `user_assigned_teams`, never as a stored
tree. Explicitly **do not** include players/guardians in it — the request's own
framing (Club Manager → Team Managers → Coaches, functional roles alongside) is
a staff org chart, and folding families into it would conflate "who runs this
club" with "who is enrolled in it," which are different questions with
different audiences. Committee reporting relationships are moot until §1/§13's
committee decision lands.

---

## 4. Organization membership lifecycle

**What exists, and where it actually differs by person type — which is itself
the finding.** Three separate, incompatible lifecycles exist today:

- **Guardians**: `guardians.account_status` (`active` / `no_account`) plus
  `invited_at`. A real if minimal state machine.
- **Players**: `memberships.status` — table exists, **zero rows**, and no code
  path currently writes to it (`updateMembershipStatus` in
  `membership-actions.ts` per CLAUDE.md's own phase notes writes a `status`
  string including `'transferred'`, but the table backing it has never been
  exercised in the showcase data, so its actual value vocabulary is unverified
  against real usage).
- **Staff**: **nothing**. `club_staff` has no status column. `AddStaffForm`
  requires the person to already hold a Dula HQ account (no invitation flow —
  "This app doesn't create staff accounts"). Removal is `removeStaff` → a hard
  `DELETE` from `club_staff`. There is no suspend, no deactivate, no archive, no
  rejoin — a removed staff member's row is simply gone, and with it any
  assignment history (`user_assigned_teams` rows cascade-delete via the FK).

**Classification.**
- Staff has no status lifecycle and hard-deletes on removal → **actually
  missing, P0**. This directly contradicts §10's audit expectations too: a
  removed coach leaves no trace that they were ever assigned to a team, because
  the row that would have recorded it is deleted along with them.
- Three different lifecycles for guardian/player/staff → **should be
  consolidated**, per the request's own instruction not to build a separate flow
  per role. The shared shape should be: `invited → active → suspended →
  archived`, with `archived` (not deletion) as the terminal state for anyone who
  held real data (assignments, evaluations, fee history). Guardians' existing
  `active`/`no_account` maps onto this cleanly (`no_account` ≈ `invited`).
  Staff needs the column added; players' `memberships.status` needs its actual
  vocabulary pinned down before more is built on it, not assumed.
- Team/committee assignment and role changes → **already adequate** as
  mechanisms (`user_assigned_teams`, `set_team_primary_coach()`); what's missing
  is that they aren't audited (§10) and staff has no invite step to begin with.

---

## 5. Communication and contactability

**What exists.** `Announcements.tsx` supports real audience targeting — `club,
team, players, guardians, coaches, staff`. `announcement_reads` exists as a
table to back read receipts — and is referenced **nowhere in application code**;
it is a dead table, schema without feature. Guardians have a working, wired
notification path (`notifyAboutPlayer()`, Phase 5) with a real per-guardian,
per-permission gate (`receive_notifications`). Staff have **no** equivalent —
`NotificationBell.tsx` is rendered for any signed-in user, but nothing currently
writes a staff-targeted notification row; a staff member's only inbound channel
is reading Announcements when they think to look.

The more serious finding: **three guardian permissions are granted to every
guardian by default and implement nothing** —
`communicate_with_club`, `manage_availability`, `manage_forms`. They appear in
`guardian_permission_defaults` for every guardian and are surfaced to a club
admin managing per-guardian overrides in the Family tab's permission grid — but
none of the three strings appears **anywhere** in application code beyond the
permission catalog itself. A club admin can "revoke" a guardian's ability to
"communicate with club," and nothing observably changes in either direction,
because there is no messaging feature to gate.

**Classification.**
- Dead permission keys with a live management UI → **actually misleading, fix
  now, P0.** This isn't a missing feature so much as a **currently false claim**
  in the permission system — either build the minimal versions (a guardian
  message thread to club staff; an availability flag; a forms/waiver
  acknowledgement — the last of which materially overlaps §7's documents work)
  or remove the keys until they're real. Leaving them is worse than either
  choice: it's a permission that means nothing, which erodes trust in every
  other permission in the same grid.
- `announcement_reads` unused → **already covered by schema, needs building or
  dropping.** Given Announcements is club-to-many broadcast, read receipts are a
  real, small, P2 win (a club manager wants to know if the roster-change notice
  actually reached anyone) — cheap to wire since the table already exists.
- Staff notification gap → **actually missing, P1.** A team manager currently
  has no way to be told "a guardian declined the tournament acknowledgement for
  your team" except by opening the app and checking. `notifyAboutPlayer()`'s
  existing shape (guardian-or-player-account target) doesn't fit a staff
  recipient at all; this needs its own resolution path
  (`notifyStaff({clubId, permissionKey, template, payload})` resolving to
  everyone holding that permission for the relevant scope), not a bolt-on to the
  player-centric function.
- Technical vs. business communication split (the request's own framing) →
  **already correctly separated in principle** — `manage_communications` is a
  business permission (club_manager/staff/secretary), and nothing
  notification-technical (VAPID keys, push delivery, SMTP) is exposed to a
  business role anywhere today. Keep it that way; §11 covers the technical side.

---

## 6. Organization directory

**What exists.** `platformconsole/Directory.tsx` is a directory of
**organizations**, for the platform admin — not a people directory, and not
club-scoped. `it_club_directory()` (phase6q) returns `(user_id, name, email,
role, is_platform_admin)` for a club, but it exists solely to feed the IT
admin's "view as" picker and is not exposed as a general staff directory to
`club_manager` or `team_manager`. There is no player/guardian directory either —
players are only ever browsed per-team via a team's roster; there is no
club-wide "search all players" or "list all guardians" view.

The most concrete evidence this is a real, live gap rather than a theoretical
one: verifying phase6x's UI in the browser as the club manager, **every staff
member except the signed-in viewer rendered as "Unknown"** with a blank email in
the Staff tab. `StaffRow.tsx`'s joined `club_staff.select('..., users(name,
email)')` is emptied by `public.users`' own SELECT policy (self-row-only) for
everyone but the caller. The club manager — the person who owns this data — could
not read their own staff's names. (Flagged as a spawned follow-up task in the
prior session; still open at the time of this analysis.)

**Classification.**
- Staff directory returning "Unknown" → **actually broken, P0.** Not a
  gap-analysis finding so much as a confirmed regression; fix path is a narrow
  `club_staff_directory()` mirroring `it_club_directory()`'s already-established
  pattern (name/email/role, nothing else, SECURITY DEFINER, scoped to the
  caller's own club) rather than widening `public.users`' SELECT policy broadly.
- General club-scoped people directory (staff + players + guardians, one
  searchable surface) → **partially covered, needs consolidating.** The data
  exists per-team; what's missing is the club-wide view. Build one directory
  component parameterized by "which relation to query," reusing
  `club_staff_directory()` for staff and a straightforward `players` query
  (already club-scoped) for the player side — not three bespoke pages.

---

## 7. Documents, qualifications, and organizational records

**What exists.** `document_uploads` is a mature, working feature for
**player-scoped** documents: categories `identity / medical / registration /
consent / other`, role-gated write access (`manage_documents` generally,
`view_medical` for the medical category specifically, per phase6h/6j),
guardian/player read-only visibility. This is genuinely solid — it should not be
duplicated.

It is **entirely player-centric** — `player_id` and `player_name` are core to
the row shape. There is nowhere for:
- Coach qualifications/certifications/licenses (the request's own example, and a
  real-world requirement — a club needs to know its coaches are actually
  licensed).
- Club-level policy documents, agreements, or "important organizational files"
  not tied to any one player.
- Staff-facing documents of any kind.

**Classification.**
- Coach/staff qualifications → **actually missing, but P2 at launch, not P0.**
  Real clubs care about this, but it is not blocking anything else being built,
  and the schema decision matters more than the UI: extend `document_uploads`
  with a nullable `subject_type` (`player` | `staff`) and matching
  `subject_id`, rather than building a parallel `staff_documents` table. The
  category/review/notify machinery is already correct and should be reused
  wholesale.
- Club-level policy documents/agreements → **defer.** Genuinely low value before
  real clubs are onboarded; the same `subject_type` extension above (a third
  value, `club`, with `subject_id = club_id`) covers it cheaply whenever it's
  wanted, so deferring costs nothing architecturally.
- Tournament-side implication (flag early): if Tournament brings its own
  eligibility/waiver documents for a club-less entrant, the **same** polymorphic
  extension is the right home for those too — a tournament-specific documents
  table would immediately duplicate the review/category/notify pipeline that
  already exists here. This is the single clearest "build once, reuse for
  Tournament" opportunity in the whole review.

---

## 8. Operational settings and configuration

**What exists.** For **Club Manager**: renaming the club, that's it —
confirmed by reading `EditNameForm.tsx` directly; `manage_club`'s only
consumer is a single-field rename form. `clubs.settings jsonb` is `{}`
everywhere and unread by any code. For **Club Admin (IT)**: exactly two
capabilities — start a "view as" session (`impersonate_user`), and a permission
check for `view_audit_log` that is **never actually consumed** (see §10 — the
IT page checks the permission to decide whether to render its own section, but
that section is the "view as" panel, not an audit log view; nothing in the app
renders `audit_log` rows to anyone, ever). For **Platform Admin**: org
suspend/activate, org rename, org entitlement toggles (`Directory.tsx`) —
genuinely infrastructure-level, correctly scoped.

**Classification.**
- Club Manager settings surface is one field wide → **actually missing, P1.**
  Once §2's branding fields have an editing surface, that surface **is** most of
  "club settings" — this doesn't need to be a separate epic, it needs the same
  form extended: name, about, location, logo, plus whatever `settings` ends up
  holding (default currency is already a column-level default per CLAUDE.md
  §0a's `phase2n`, not something that needs a settings-JSON entry).
- IT admin has no actual settings, only inspection tools → **acknowledge as
  correct for now, revisit in §11.** Building settings nobody asked for "because
  the role exists" is exactly the anti-pattern the request warns against;
  §11 below identifies which IT capabilities are genuinely missing versus which
  ones (email infra, API keys, integrations) have no product behind them yet to
  administer.

---

## 9. Reporting and organization visibility

**What exists.** `Reports.tsx`: attendance % and development counts per team
(30-day window) plus one club-wide financial summary (collected / outstanding /
expenses / net). That is the entire reporting surface. There is no staff
report, no membership-status report, no communications report (delivery/read
rates — moot until §5's `announcement_reads` is wired), no organizational
activity report, no role/status report.

**A real overlap, not hypothetical:** the club console currently has **three**
separate dashboard-shaped surfaces with fuzzy boundaries — `ActionCenter.tsx`
("today's schedule," upcoming sessions, per-team snapshot, an action list),
`ClubDashboardStats.tsx` (rendered below ActionCenter under a "Club-wide"
label), and the `Reports` tab (attendance/development/finance, again per-team).
`ActionCenter` and `Reports` both compute a per-team attendance figure
independently; nothing shares that calculation.

**Classification.**
- Missing report types (staff, membership, org activity, role/status) →
  **actually missing, P2.** None of these are blocking anything downstream; they
  are genuinely "valuable but can follow."
- Three overlapping dashboard surfaces → **redundant, consolidate, P1.**
  Specifically: fold `ClubDashboardStats` into `Reports` as its "club-wide"
  section (it is already visually subordinate to it on the page today) rather
  than leaving it a sibling of `ActionCenter`. `ActionCenter` should stay
  separate — it is action-first ("what do I need to do today"), a genuinely
  different job from Reports' after-the-fact visibility — but the per-team
  attendance calculation should be one shared function, not two independent
  ones that can silently drift.

---

## 10. Audit, history, and accountability

**What exists and is genuinely good:** `write_audit()` is used consistently for
guardian relationship changes, guardian permission changes, tournament
acknowledgement request/decision, roster export/withdraw/port, player team
transfer, and the primary-coach designation (phase6x) — a real, append-only,
no-UPDATE/DELETE-for-anyone log (CLAUDE.md §5's own guarantee, confirmed still
true).

**What's missing, confirmed by grep, not inferred:** `src/app/c/[clubSlug]/
actions.ts` — which holds `addStaff`/`removeStaff`/`assignStaffToTeam`/
`unassignStaffFromTeam` — contains **zero** calls to `write_audit`. Adding a
coach, removing a treasurer, moving a team manager from one team to another:
none of it is logged. Combined with §4's hard-delete-on-remove, this means a
club's entire staffing history can vanish with no record it ever happened.

**Separately: `view_audit_log` is a granted permission with no consumer.** It is
in `club_manager`'s bundle (19 perms) and `club_it_admin`'s bundle (2 perms),
checked in `it/page.tsx` to decide whether to show a section — and that section
is the "view as" tool, not an audit view. **Nobody who holds this permission can
actually see an audit log entry anywhere in the application.** This is the
single cleanest example in the whole review of "a permission that exists and is
granted, gating a feature that was never built" — distinct from §5's dead
guardian permissions (which gate nothing because there's no feature at all);
this one gates the *wrong* feature.

**Classification.**
- Staff/team-assignment actions unaudited → **actually missing, P0.** This is a
  one-line addition at each of the four call sites in `actions.ts`, using the
  exact pattern already proven everywhere else in the codebase. There is no
  design work here, only omission.
- `view_audit_log` granted, nothing renders it → **actually missing, P0, and
  cheap.** A read-only audit log view, scoped by the same permission that
  already exists, filtered to the club's own `org_id`/`scope_id` rows. This has
  been "out of scope" since CLAUDE.md's own Phase 4 note and should not remain
  so while the permission keeps being granted to people who can't use it.
- Financial action auditing → **unclear, verify before Tournament.** Fee charge
  creation/edit and payment recording were not confirmed either way in this
  pass; given money is involved, this needs an explicit check (not an
  assumption) before the combined entitlement introduces tournament entry fees
  on top of club fees.

---

## 11. Club Admin / IT capability

**What exists:** exactly two permissions (`impersonate_user`, `view_audit_log`),
one of which is unconsumed (§10). The "view as" tool itself is well-built and
correctly scoped (read-only inspection, not session takeover — CLAUDE.md §0e's
design holds up on re-review: the actor's own identity stays attached to every
audit record, matching the Club Admin spec's own requirement).

**What's absent, checked against the request's own list:** account
administration (deactivate a user, force sign-out, reset a password — there is
no password reset flow **at all** in this app, staff or guardian, per CLAUDE.md
§8/§0g's own note that "nothing sends email"), MFA (none exists to administer —
Supabase Auth supports it, nothing in this app touches it), session management
beyond impersonation's own bookkeeping, integrations, email infrastructure
config, domains, API keys, security monitoring beyond raw `audit_log` rows (no
alerting, no anomaly surface), and any escalation path to Platform Admin (§12).

**Classification — this list is longer than most because it mixes genuinely
missing capabilities with capabilities that have no product behind them to
administer yet:**
- **Actually missing, P0:** the audit log view (§10, restated here because it's
  as much an IT-capability gap as an audit gap), and the staff directory fix
  (§6) — an IT admin whose entire job is "troubleshoot access for a named
  person" currently can't reliably see that person's name.
- **Actually missing, P1:** account deactivation/reactivation (this is §4's
  staff-lifecycle gap wearing an IT hat — same underlying status column,
  consumed here as an IT action rather than a Club Manager one; decide who owns
  the *action* even though both roles will want to *see* the state — recommend
  Club Manager decides "this person left," IT admin executes "disable their
  access," which matches the spec's own club_admin=technical /
  club_manager=business split exactly).
- **Not valuable enough to build yet, defer:** MFA administration, integrations,
  API keys, domains, email infrastructure config. None of these have a product
  surface behind them today (no integrations exist to manage, no API consumers
  exist to key, no custom domains are wired per-org). Building the admin screen
  before the thing it administers is the "technically possible but not
  meaningful" anti-pattern the request explicitly warns against.
- **Should remain Platform Admin, not Club Admin:** anything spanning multiple
  orgs (which the current split already respects — confirmed, `it/page.tsx` is
  strictly club-scoped throughout) and genuine infrastructure (VAPID keys,
  Supabase project settings, Vercel config) — correctly untouched by any
  club-facing role today.
- **A foundational gap this section surfaces that the request's framing
  doesn't explicitly ask about, but should:** IT administration is *entirely*
  `club_id`-scoped — `impersonation_sessions.club_id`, `it_club_directory(p_club_id)`,
  the `/c/[clubSlug]/it` route itself. **An org with the Tournament entitlement
  and no Club entitlement has no club, and therefore no IT admin capability of
  any kind is reachable for it.** This is a direct collision with the stated
  next step. See §13.

---

## 12. Organization → Platform Admin support

**What exists:** nothing. No ticket table, no support-request table, no status
field, no escalation path — confirmed by exhaustive grep across the schema and
`src/`. `impersonation_sessions` is a related but distinct building block (a
logged, time-limited *inspection* mechanism) — it is not a support ticket and
should not be stretched into one.

**Classification.** **Actually missing, P1** — not P0, because nothing else
depends on it existing, but real: right now the only "support channel" this
product has is literally none, which the request correctly anticipated needs to
be more than an email address.

**Scope recommendation, staying inside the request's own boundaries:**
- A new `support_requests` table: `org_id, created_by, category, subject,
  body, status (open/in_progress/waiting_on_org/resolved/closed),
  affected_entity_type, affected_entity_id, created_at, updated_at`, plus a
  `support_request_messages` child table for the back-and-forth (reuse
  `document_uploads`' inline-storage pattern for attachments if screenshots are
  wanted, rather than adding blob storage this app doesn't have).
- Who can create one: `club_manager`, `club_it_admin` per the request — a new
  **club-scope** permission, `submit_support_request`, granted to both by
  default.
- Platform Admin side: list/assign/respond/escalate/resolve, all inside
  `platformconsole` (already the correct home — it is already the org-spanning
  admin surface). "Request temporary access" is exactly what
  `start_impersonation()` already is, if generalized to platform admin acting on
  any org rather than club staff acting on their own club — **reuse it, don't
  build a second impersonation mechanism for support purposes.**
- This is a genuinely **shared platform capability**, not Club-specific —
  correctly so, since a Tournament-only org will need the exact same escalation
  path with no changes. Build it once, now, generic over `org_id`, and it never
  needs to be revisited for Tournament.

---

## 13. Cross-cutting gaps and Tournament-entitlement collision risks

Gaps that don't map to a single numbered section above, and — per the request's
explicit ask — places where today's Club-only design will actively fight the
Tournament entitlement if not addressed first.

- **IT administration is club-scoped and therefore unreachable for a
  Tournament-only org (§11).** This is the highest-priority cross-cutting
  finding in the whole review. `is_org_admin()` already exists and is
  club-independent; the fix is very likely "IT admin capability should key off
  org-level authority (a new `org_it_admin`-shaped concept, or extending
  `is_org_admin` callers) with club scoping as a *narrowing*, not a
  *requirement*" — but that decision should be made deliberately, now, not
  discovered mid-Tournament-build the way the phase6x team-assignment bug was
  discovered mid-fix.

- **The role/permission model (`has_staff_permission`, `role_permission_defaults`,
  scope ∈ {club, team}) is Club-shaped by construction.** Tournament already has
  its own, entirely separate staffing concept — `org_officials`,
  `tournament_officials`, `referees`, `officiating_team` — built for the
  unrewritten Tournament Manager app (CLAUDE.md §8, kept unrewritten by explicit
  rule). **The real risk isn't that these compete today — it's that defining a
  new Tournament-entitlement role model from scratch, instead of extending
  `permissions.scope` with a `tournament`/`entry` value and reusing
  `has_staff_permission`'s existing machinery, produces two parallel
  authorization systems for the combined entitlement to reconcile later.**
  Flag this as the design question to answer *first* in the Tournament scoping
  pass, before any Tournament-specific tables are added.

- **`document_uploads` is structurally player-centric** (§7) — the right fix
  (a polymorphic `subject_type`/`subject_id`) should land as part of Club
  cleanup specifically *because* Tournament will want the same pipeline for
  entrant eligibility documents. Doing it now avoids a second documents table
  later.

- **Club branding vs. org branding (§2)** has no precedence rule, and
  Tournament hosting is org-level — meaning Tournament-facing surfaces will
  default to org branding while Club-facing surfaces default to club branding,
  with no defined rule for what happens when a combined-entitlement org has
  both and they conflict (a roster crossing from a club-backed entry into a
  tournament the same org hosts). Resolve the precedence rule now, cheaply,
  before either side has more consumers depending on the wrong default.

- **Staff notification resolution (§5) is written specifically for
  guardian/player targets.** Tournament will need to notify tournament
  officials and entrant-side staff about entry status, roster deadlines, and
  match assignments — a shape closer to "staff notification" than
  "guardian/player notification." Building the staff-notification resolver now
  (§5's P1 recommendation) means Tournament inherits it rather than needing its
  own.

- **`role_assignments` remains completely empty** (confirmed again in this
  pass — CLAUDE.md §4's "write new grants here" is still aspirational, zero
  rows). Every real grant lives in `club_staff`/`org_members`/
  `user_assigned_teams`. This was already known; restated here because
  Tournament will be the second consumer of whatever authorization model wins,
  and building it against a table nothing writes to would be building on sand.
  **Do not extend `role_assignments`' usage for Tournament until a decision is
  made to either retire it or actually cut the Club model over to it** — a
  half-migrated authorization system across two entitlements is worse than the
  current single-system-with-legacy-tables state.

- **Notifications-that-don't-lead-anywhere:** confirmed one concrete instance —
  `announcement_reads` (§5), schema with no feature. No other instance of this
  specific failure mode (a `notifications` row with a dead `link_path`, etc.)
  was found; the notification/link-path pattern otherwise resolves correctly
  everywhere it's used.

- **Workflows with no completion state:** staff removal (§4/§10 — no status,
  hard delete, no audit) is the clearest example. Guardian permission
  management (§5) is the second-clearest — the permission grid itself has a
  well-defined completion state (grant/revoke persists correctly), but three of
  its rows gate nothing, which is a different failure mode (a false affordance,
  not a missing completion state) already covered above.

---

## Prioritized recommendations

**P0 — Critical / foundational.** Blocking or actively misleading; should not
carry forward into Tournament scoping.

| # | Problem | Owner | Proposed capability | Shared or Club-specific | Permission impact | Tournament impact | Replaces/consolidates |
|---|---|---|---|---|---|---|---|
| 1 | Staff directory shows "Unknown" for everyone but the viewer (`public.users` RLS empties the join) | Engineering | `club_staff_directory()` SECURITY DEFINER RPC, mirroring `it_club_directory()` | Club-specific (mirrors an existing pattern; the pattern itself is reusable) | None new | None | Fixes `StaffRow.tsx`'s existing (broken) query |
| 2 | Three guardian permissions (`communicate_with_club`, `manage_availability`, `manage_forms`) are granted by default and implement nothing | Product + Engineering | Either build minimal versions or remove the keys from the catalog and every default bundle | Club-specific | Removes/redefines 3 existing guardian permission keys | None if removed before Tournament reuses the guardian permission model | Removes a currently-false affordance in the Family tab's permission grid |
| 3 | `view_audit_log` is granted to `club_manager` and `club_it_admin`; nothing renders an audit log anywhere | Engineering | A read-only audit view, scoped to the caller's own `org_id`, gated on the existing permission | Club-specific (view); the underlying `audit_log`/`write_audit()` are already shared platform infrastructure | None new | Directly reusable — Tournament actions already write to the same `audit_log` | Fulfills CLAUDE.md's own long-deferred Phase 4 note |
| 4 | Staff add/remove and team (re)assignment write no audit rows (`actions.ts` has zero `write_audit` calls) | Engineering | Add `write_audit()` calls at the 4 existing call sites, matching the pattern already used elsewhere | Club-specific | None new | None — same audit infrastructure | N/A, additive |
| 5 | Removing a staff member is a hard `DELETE`; no status lifecycle exists for staff (unlike guardians) | Product + Engineering | Add `status` to `club_staff` (`invited/active/suspended/archived`); "Remove" archives, doesn't delete; assignment history survives | Club-specific (staff); the *shape* should match players'/guardians' lifecycle | New column, no new permission (existing `manage_staff` covers status changes) | None directly, but the shared-lifecycle shape should be the template Tournament reuses for entrant-side staff | Replaces the current hard-delete flow |
| 6 | Club has no logo/branding editing surface; `RosterBuilder.tsx`'s export already prints an unbranded header | Product + Engineering | Extend the club settings form to cover `about`/`location`/logo upload; decide the org-vs-club branding precedence rule now | Club-specific UI over a field that's arguably shared (org already has `logo_url`) | None | The precedence rule this establishes is required before Tournament rosters/exports cross entitlements | Extends `EditNameForm` rather than replacing it |

**P1 — Important before entitlement expansion.**

| # | Problem | Owner | Proposed capability | Shared or Club-specific | Permission impact | Tournament impact | Replaces/consolidates |
|---|---|---|---|---|---|---|---|
| 7 | No staff profile beyond name/email/role; no photo, phone, bio, or qualifications | Product + Engineering | A role-specific profile record (photo, phone, short bio, certifications) layered on `club_staff`, not duplicating `users` | Club-specific | None new | A qualifications record is exactly what a Tournament official profile will also want — design the shape to be reused, not to be Club-only by construction | New capability; no existing flow to replace |
| 8 | Staff have no notification channel; `notifyAboutPlayer()` only targets guardian/player accounts | Engineering | A `notifyStaff({clubId, permissionKey, template, payload})` resolver, parallel to but distinct from `notifyAboutPlayer` | **Shared platform capability** — the resolution pattern (find everyone holding permission X in scope Y) is entitlement-agnostic | None new | Tournament will need to notify officials/entrant staff the same way — build the resolver generically now | New; nothing to replace |
| 9 | Club Manager's only settings capability is renaming the club | Product + Engineering | Fold into #6's settings-form work: name, about, location, branding, and whatever `clubs.settings` ends up needing | Club-specific | None new | None | Extends existing rename form |
| 10 | No support/escalation path from an org to Platform Admin | Product + Engineering | `support_requests` + `support_request_messages` tables; club_manager/club_it_admin can submit; Platform Admin triages in `platformconsole`; reuse `start_impersonation()`'s pattern for "request temporary access" rather than building a second one | **Shared platform capability**, generic over `org_id` from day one | New permission `submit_support_request` (club scope, granted to club_manager + club_it_admin by default) | None — designed to need zero changes for Tournament | New; no existing flow |
| 11 | IT admin has no way to deactivate/reactivate a user | Product + Engineering | An IT action consuming #5's new staff status column; Club Manager decides someone has left, IT admin executes the access change | Club-specific | Consumes existing `manage_staff`/new status column; no new IT permission needed if scoped as "act on an existing status" | Same club-id-scoping caveat as §13's IT gap applies | Extends #5, doesn't duplicate it |
| 12 | Three overlapping dashboard surfaces (ActionCenter / ClubDashboardStats / Reports) with duplicated attendance math | Engineering | Fold `ClubDashboardStats` into `Reports` as its club-wide section; extract one shared attendance-percentage function | Club-specific | None | None | Consolidates 2 of the 3 existing surfaces into 1 |
| 13 | IT administration is entirely `club_id`-scoped, unreachable for a Tournament-only org | Product + Engineering (design decision first) | Decide whether IT authority becomes org-scoped with club-scoping as a narrowing, before any Tournament-side IT capability is built | **Must be resolved as a shared platform decision** before Tournament scoping begins | Affects `impersonate_user`/`view_audit_log` scope semantics | Directly blocks Tournament-only orgs from having any IT capability if left as-is | Not a replacement — a scoping decision that the current club-only implementation needs revisited, not rewritten from scratch |

**P2 — Valuable but can follow later.**

| # | Problem | Owner | Proposed capability | Shared or Club-specific | Notes |
|---|---|---|---|---|---|
| 14 | No org chart visualization | Engineering | Read-only view over existing `club_staff`/`user_assigned_teams` data — no new storage | Club-specific | Explicitly exclude players/guardians from it |
| 15 | No club-wide people directory (staff + players + guardians in one searchable surface) | Engineering | One parameterized directory component reusing #1's `club_staff_directory()` and the existing per-team player query | Club-specific | Depends on #1 landing first |
| 16 | `announcement_reads` schema exists, unused | Engineering | Wire read-tracking into `Announcements.tsx`; surface a simple "seen by N" count | Club-specific | Cheap — the table already exists |
| 17 | No coach/staff qualifications or certifications storage | Engineering | Extend `document_uploads` with a `subject_type` (`player`/`staff`, later `club`) rather than a new table | Club-specific schema, but the extension point is deliberately reusable for Tournament (§7, §13) | Design the column now even if the UI for it waits |
| 18 | Missing report types: staff, membership status, org activity, role/status | Engineering | Additional `Reports` tab sections | Club-specific | Low urgency — nothing depends on these existing |
| 19 | No club-level policy/agreement document storage | Engineering | The same `subject_type='club'` extension as #17 | Club-specific | True defer — no real demand signal yet |
| 20 | Financial action audit coverage unconfirmed | Engineering | Verify (not assume) whether fee/payment CRUD writes to `audit_log`; add if missing | Club-specific | Should move to P0 if verification finds it's actually missing — treat as **unresolved, not deferred** |

**Defer / do not build.**

| # | Item | Why |
|---|---|---|
| 21 | MFA administration in the IT console | No MFA exists anywhere in the app to administer. Building the admin screen before the feature it administers is exactly the anti-pattern this exercise was asked to avoid. |
| 22 | Integrations management, API keys, custom domains-per-org | No integrations, no API consumers, no per-org domains exist today. Same reasoning as #21. |
| 23 | `team_staff` table | Redundant, zero rows, zero references outside generated types. Drop it; do not migrate it forward. |
| 24 | A separate, Club-only committee model | Build only once the Tournament entitlement's organizing-committee needs are known, so the two aren't built twice (§1, §13). |
| 25 | Retiring the legacy `org_members`/`club_staff`/`user_assigned_teams` tables in favor of `role_assignments` | Already correctly deferred per CLAUDE.md §6.F — restated here because Tournament scoping will be tempted to build against `role_assignments` since it looks more "correct"; don't, until a real migration is committed to. |

---

## What this means for the Tournament-entitlement pass

Three decisions from this document should be made **before**, not during,
Tournament scoping, because they change the shape of work that follows:

1. **Authorization model reuse** (§13, first bullet): extend
   `has_staff_permission`'s scope model rather than inventing a parallel one for
   tournament officials/entries.
2. **IT administration's scoping** (§11/§13, P1 #13): org-level authority with
   club as a narrowing, not a requirement — otherwise Tournament-only orgs have
   no IT capability by construction.
3. **Documents' `subject_type` extension** (§7/§13): land this as part of Club
   cleanup specifically because Tournament will be the second consumer.

Everything else in this document can proceed independently of those three, but
those three should be resolved first — they are the parts of the Club
entitlement that Tournament will either compose with cleanly or collide with
directly, and which is which depends entirely on whether they're generalized
now or left Club-shaped.
