# Platform / Club / Tournament gap analysis (2026-09-11)

Evidence-based, checked against the live Supabase project (`zytyakbgwaegvftblkcn`)
and the current repo state, not against what any design doc claims should be
true. File:line citations throughout; no speculation. This picks up directly
from `docs/club-entitlement-gap-analysis.md` (Club-only, mostly resolved — see
§2.1) and extends the same method to Platform and Tournament, per the request:
this feeds how Platform Admin will manage tenants, run a support system, and
act as the cross-org "backdoor" for troubleshooting.

---

> **Status, 2026-09-19.** All five P0s are fixed and four of six P1s (7, 9,
> 10, 11); see CLAUDE.md §0m, §0n and §0o. **P1-8** (two ledgers) is resolved
> by scoping: `fee_charges` stays the club ledger and the billing domain covers
> Platform and Tournament. **P1-10** is built as the organizer console at
> `/tm/...` (entries, categories, staff, host-entered registration); its
> finance queue and self-service registration are not. Only **P1-6**
> (entitlement lifecycle) remains open, deliberately: the Directory deletes a
> row to turn a product off, and trial/grace needs pricing to design against.
> The body below is the
> original analysis and is left as written; §0 and the P0/P1 tables reflect
> what was found, not what remains.

## 0. Sync notes — what changed since the last session, and two things that need a decision

Two commits landed directly against this repo/origin since Tournament RBAC
(§0l) shipped: `3ade9b6` "Add tournament-first platform and manual billing
foundation" and `eb05901`, a small follow-up. Together they add a large
billing domain (14 migrations, a Platform Admin billing console, a Guardian
billing tab, a Club billing view) plus a big planning document,
`docs/platform-implementation-roadmap.md` (1,464 lines) that this analysis
checks the codebase against throughout. Three things from that commit need a
decision before anything else:

1. **The live Supabase project has NOT had the billing migrations applied.**
   `list_migrations` on the live project shows every migration through
   `phase8d_tournament_entry_contacts` (2026-09-09) — none of the 14
   `20260910*_billing_*` files are live. `docs/implementation-handoff.md:3`
   says exactly this ("no Supabase migration has been applied from this
   workspace"), so it's a known state, not a surprise — but every billing
   screen (Platform Admin's Billing tab, Guardian's Billing tab, Club's
   "Billing invoices" section) is live application code pointed at tables
   that don't exist in production yet. **Decision needed: apply the 14
   migrations, or leave billing dark until reviewed?** This analysis treats
   billing as "built, not deployed" throughout.

2. **`3ade9b6` deleted CLAUDE.md §0l (Tournament RBAC foundation) and the 18
   RLS tests for `tournament_staff`/`tournament_entry_contacts`, with nothing
   added back in their place.** Confirmed via `git diff f818ac8 3ade9b6 --
   CLAUDE.md`: 212 lines removed, 0 added. Same for
   `tests/rls/club-manager-isolation.test.ts`: 212 lines removed, 0 added —
   the entire `describe('tournament_staff...')` and
   `describe('tournament_entry_contacts...')` blocks. **The underlying
   schema is untouched and still live** (phase8a–phase8d are all still in
   `list_migrations`), so this is a documentation and test-coverage loss, not
   a functional regression — but it means the Tournament RBAC layer this
   analysis relies on (§3.1) currently has zero automated regression
   coverage, and the record of the three real bugs found while building it
   (the `has_tournament_permission` scope leak, the `rejected`→`declined`
   status fix, the guardian-invite RLS discrepancy) only exists in this
   session's memory and in the migration file comments themselves.
   **Recommend restoring both** — the content is fully recoverable from git
   history (`git show f818ac8:CLAUDE.md`, `git show f818ac8:tests/rls/club-manager-isolation.test.ts`).

3. **A stray, garbled file sits at the repo root**: `t platform and manual
   billing foundation"` (the visible part of a filename containing a broken
   Unicode private-use character, `git ls-tree` shows the raw bytes
   `\357\200\242`). Its content is a `git diff --stat` output, not source —
   an artifact of a broken command during that commit. It's tracked
   (`git ls-tree -r HEAD` finds it) and does nothing; recommend
   `git rm` once confirmed you don't need it for anything.

---

## 1. Platform

### 1.1 Tenant lifecycle and entitlement management

**What exists, and it's more than expected.** `platformconsole/Directory.tsx`
lists every organization with club/member counts and its held entitlements
(`src/app/platformconsole/page.tsx:39-57`), supports inline rename + accent
color (`Directory.tsx:79-89`), and toggling `club`/`tournament` product
entitlements per org (`Directory.tsx:97-114`, `updateOrgEntitlements` in
`actions.ts`). `ProvisionForm.tsx` creates a new tenant end-to-end — org,
optional first club, optional first tournament, entitlement checkboxes, in
one form. This satisfies most of what a "manage tenants" surface needs
structurally.

**"Suspend" does nothing.** `Directory.tsx:71-73`'s Suspend/Activate button
calls `toggleOrgStatus`, which writes `organizations.status`
(`actions.ts:144`). Grepped every RLS policy and helper function in
`supabase/migrations/` for `organizations.status` or `org.status`: **zero
matches**. No policy, no helper (`is_org_member`, `is_org_admin`,
`org_has_product`, `can_read_club`, `can_admin_club`) reads this column. A
suspended org's staff, guardians, and players retain every permission they
had a moment before — they can still read/write clubs, teams, players, fees,
tournaments, everything. The button changes a label in the directory row and
nothing else. **This is the platform's single highest-severity gap**: it is
the one control that looks like it enforces something and doesn't.

**Entitlement lifecycle is binary, not phased.** The roadmap
(`docs/platform-implementation-roadmap.md:172-184`) specifies `Requested →
Provisioning → Trial → Active → Grace period → Restricted → Suspended →
Cancelled/Expired → Archived`. The live `org_entitlements.status` CHECK
(confirmed via the billing RLS reading `status = 'active' or status =
'trial'` at `platformconsole/page.tsx:55`) allows more values than the UI
exposes, but nothing in `Directory.tsx` sets anything other than checked/
unchecked (implicitly active/absent). There is no grace period, no trial
countdown, no restricted-but-visible state — an org's product access is a
light switch, not the lifecycle the roadmap calls for.

### 1.2 The cross-org troubleshooting "backdoor" — the headline gap

This is the part of the request with no existing capability at all, and it's
the most consequential finding in this analysis.

**Every "view as" / diagnostic mechanism in this codebase is scoped to a
single club, callable only by that club's own `club_it_admin`.**
`start_impersonation()` (`supabase/migrations/20260909012518_phase6o_impersonation_sessions.sql`)
takes a `p_club_id` and requires the caller to hold `impersonate_user` *at
that club*; `effective_access_for()` (`phase6p_effective_access_readout.sql`)
refuses unless a live session exists for that exact actor/target/club
triple. Grepped every migration for `start_impersonation` and
`effective_access_for`: **three files, all club-scoped, none org-wide, none
platform-scoped.** `tournament_it_admin` (§0l) got its own separate,
tournament-scoped `tournament_audit_log()` — deliberately not unified with
the club version (per the explicit ruling recorded in
`docs/club-entitlement-gap-analysis.md` §13, resolved 2026-09-09).

**The consequence: Platform Admin — the one role that should be able to
troubleshoot ANY org — has no diagnostic path into any org at all**, beyond
querying tables directly with the service-role key or reading raw
`audit_log`/`support_requests` rows. If a guardian in a Tournament-only org
(no club, therefore no `club_it_admin` possible) can't see their invoice,
Platform Admin's only recourse today is manual SQL. This exactly matches
what the roadmap itself calls for and has not built: "inspect effective
access for Club users… support organization-level troubleshooting without
broadening product access" (`platform-implementation-roadmap.md:391-392`),
"troubleshoot organizer, official, entrant, and roster access"
(`:429`), and the P1 control-plane wishlist's "organization people/access
directory… effective-permission inspector… 'explain why' access
diagnostics" (`:889-892`).

**The right shape, given what's already built and proven twice:** a third,
platform-scoped tier of the same pattern already used for `club_it_admin`
and `tournament_it_admin` — call it `platform_view_as` or fold it into
`is_platform_admin()` directly, since Platform Admin is already a single,
well-audited role (unlike club/tournament staff, there's no bundle to
design). The mechanics to reuse directly:
- `start_platform_impersonation(p_org_id, p_target_user_id, p_reason)` —
  same guards as `start_impersonation()` (non-empty reason, not yourself,
  target must belong to the org, capped expiry, one active session per
  actor) but keyed on `org_id` alone, not `club_id`, so it works for a
  Tournament-only org with no club at all.
- `effective_access_for_platform()` — a readout function like
  `effective_access_for()`, but resolving through **both**
  `has_staff_permission` and `has_tournament_permission` depending on which
  entitlement(s) the target org holds, since a combined-entitlement org's
  user could hold either bundle (or both).
- Same audit discipline: the *admin's* identity stays the actor in
  `audit_log`, never the target's — this is non-negotiable per the Club
  Admin spec's own requirement that §0e already built around once, and the
  Tournament RBAC and Platform layers should not relitigate it.
- The same visible-banner UI pattern from `/c/[clubSlug]/it`, generalized:
  "You are viewing as {target} in {org}. You are still signed in as
  yourself."

This is genuinely new work (no existing code to widen — widening
`start_impersonation` itself to accept a null `club_id` would be the wrong
move, since its guards are club-specific by design and a null club_id would
either silently skip the club-membership check or need a parallel branch
that's really this new function in disguise).

### 1.3 Support system

**Built, and it is the org_id-generic shape §0k's P1-10 promised** — no
schema change was needed for Tournament to use it (§0l already exercises
this: a tournament organizer filing a ticket is covered by the same
`support_requests`/`support_request_messages` tables and the widened RLS
from `phase8c`). `SupportQueue.tsx` gives Platform Admin a working
triage queue: status transitions, threaded replies.

**One real gap for the "manage tenants" use case: the queue shows no
entitlement context.** `SupportQueue.tsx:48-51` renders subject, org name,
category, submitter, date — never which product(s) the filing org holds.
A Platform Admin working a ticket has to separately visit the Directory tab
to learn whether "Rally Point Sports" is Club-only, Tournament-only, or
both, before they can even guess which subsystem the ticket concerns. Given
§1.2's finding, they also have no way to look at the filer's own account
from inside the ticket — no "view as this person" link, because that
capability doesn't exist yet.

### 1.4 Billing (platform layer)

The schema (`20260910090000_billing_domain_foundation.sql`) is well-shaped —
one shared `billing_accounts`/`billing_invoices`/`billing_payment_submissions`
model across all three `context_type` values (`platform`/`club`/
`tournament`), a `billing_accounts_context_shape` CHECK enforcing exactly one
of `club_id`/`tournament_id` per context, manual-QR-only with an explicit
`ManualQrPaymentProvider → AutomatedPaymentProvider` seam
(`docs/implementation-handoff.md:128-133`) matching this project's own
established pattern of deferring automation until justified (§8's SMTP
deferral is the same shape). Automatic billing-account provisioning on
club/tournament creation (`20260910100000_billing_context_provisioning.sql:41-49`)
is real and correctly triggers on both tables.

**A real bug: the "Create invoice" form cannot succeed.**
`BillingConsole.tsx:82-99`'s form collects `orgId`, `amount`, `description`,
`dueAt`, `notes` — there is no `billingAccountId` field anywhere in the
form, hidden or otherwise. `createPlatformInvoice`
(`billing-actions.ts:11-19`) reads `formData.get('billingAccountId')` and
returns `{ error: 'Organization, billing account, description, and a
positive amount are required.' }` whenever it's empty — which is every
submission, since nothing ever sets it. The org `<select>` disables options
lacking a billing account (`BillingConsole.tsx:86`) but never captures the
*id* of the account for the one it does allow. **This cannot currently
create a single invoice**, though it can't be tested live yet either
(§0.1). Fix: either look up the account id server-side from `orgId` (there's
a 1:1 partial-unique index guaranteeing exactly one platform account per
org, `billing_accounts_platform_org_uidx`), which is simpler than fixing the
form, or add the hidden field.

**RLS is deliberately broad for now, and says so** —
`billing_accounts_read`/`billing_invoices_read`/etc. all grant
`is_org_member(org_id)` a full read, with the migration's own comment
admitting "Product-specific staff narrowing is added with the corresponding
Club/Tournament billing UI and policies" (`20260910090000...sql:174-177`).
As written today, **any member of an org — a coach, a guardian, a player —
can read every invoice and payment submission belonging to that org**,
including other families' fee invoices and the club's own platform billing.
This is explicitly acknowledged as temporary in the migration, but nothing
in the later 13 billing migrations narrows it (confirmed: grepped all 14 for
`is_club_staff`, `has_staff_permission`, `has_tournament_permission` against
`billing_*` tables — zero results). **Before these migrations reach
production, this needs the same staff-permission narrowing every other
sensitive table in this project has gone through** (§0j/§0k's own pattern:
`view_finances`/`view_team_finance` gating `fee_charges`, not raw org
membership).

### 1.5 Audit and platform health

`audit_log` remains append-only and the right sink, but there is still no
platform-wide read surface for it (§0j's P0-3/4 built `club_audit_log()` and
Tournament got its own `tournament_audit_log()` — Platform Admin has
neither a cross-org view nor even direct SELECT access documented anywhere
in the app; the "backdoor" in §1.2 would need its own read path here too,
scoped to platform admins only, unlike the club/tournament versions which
are scoped to their own tenant).

---

## 2. Clubs

### 2.1 Already resolved — recap only

`docs/club-entitlement-gap-analysis.md` covers this product in full; P0
(items 1–6) and 5 of 7 P1 items are built and verified (CLAUDE.md §0j/§0k).
P1-#13 (IT scoping) is explicitly resolved, not deferred (§0e above,
`docs/club-entitlement-gap-analysis.md` §11/§13). Nothing in this pass
reopens any of that. Two things surfaced *while investigating the new
billing work* are new, below.

### 2.2 New: two parallel, unreconciled financial systems

Clubs now have **two independent fee/invoice systems living side by side
with no bridge**: the pre-existing `fee_charges`/`payments` (with its own
`recompute_fee_status` trigger, referenced throughout §5/§0c) and the new
`billing_invoices`/`billing_payment_submissions` domain. `Finances.tsx:74-114`
renders both as separate, unrelated list sections — "Fee charges" and
"Billing invoices" — with the billing section's own empty-state copy
admitting the gap outright: *"No billing-domain invoices yet. Existing fee
charges remain visible above."* (`Finances.tsx:104`). There is no migration
backfilling historical `fee_charges` into `billing_invoices`, no shared
`source_type`/`source_id` linkage between a `fee_charges` row and its
billing-domain counterpart, and no product decision recorded anywhere about
which system is authoritative going forward, whether they'll ever merge, or
whether `fee_charges` becomes the club-context billing UI's data source
directly instead of staying a second table. Every dashboard/report currently
reading club finances (`ActionCenter.tsx`, `Reports.tsx`,
`attendance-stats.ts`'s sibling patterns) reads `fee_charges` only — none
were updated to also fold in `billing_invoices`, so a club that starts using
the new billing screens will see its revenue *split* across two places that
don't sum together anywhere.

### 2.3 Leftover: the club-wide Finances tab was never cut over to the permission catalog

`canManageFinances = access.isClubManager || access.role === 'staff'`
(`src/app/c/[clubSlug]/page.tsx:100`) is a role-literal check that predates
Phase 0's permission foundation (`git log -S canManageFinances` traces it to
before the `club_admin`→`club_manager` rename). This is a different flag
from `PlayerProfile.tsx`'s per-player `canManageFees`, which §0d's phase6m
work correctly cut over to `manage_finances`. The club-wide version was
missed. Concrete consequence: **`treasurer`**, the role phase6l created
specifically as "Finance specialist" (§0d's role table), **cannot open or
manage the club's own Finances tab** — the literal string check only
matches `club_manager` and `staff`. This is a pre-existing gap (not
introduced by the billing commit), but the billing commit's own new
`billingInvoices` query rides on this same broken flag
(`page.tsx:450,497-505`), so fixing `canManageFinances` to check
`manage_finances`/`view_finances` via `has_staff_permission` now also fixes
who can see the new billing section correctly.

---

## 3. Tournaments

### 3.1 RBAC foundation — built, live, temporarily undocumented and untested

The full `tournament_staff` authorization layer from §0l is live in
production (`list_migrations` confirms `phase8a` through `phase8d` are
applied) and unaffected by anything in this pass. Its CLAUDE.md section and
its 18 RLS tests were deleted with the billing commit (§0.2) — recommend
restoring both from `f818ac8` before building anything further on top of
this layer, since the next two findings (§3.4) depend on people
understanding what's already there well enough not to duplicate it.

### 3.2 No tournament organizer console exists anywhere in this repo

Grepped every route under `src/app` for `tournament` (24 files, listed).
Beyond the public `/tournaments` list and the club-side team/roster pages
(`c/[clubSlug]/teams/[teamSlug]/tournaments/...`), there is **no page for an
Organizer, Team Coordinator, or any other `tournament_staff` role to do
anything with their own tournament** — no way to see who holds what role
(`tournament_staff_directory()` exists in the database and is called by
nothing in `src/`), no way to review or decide a pending entry
(`decide_tournament_entry()` likewise exists and is called by nothing),
no way to manage officiating assignments, no tournament settings screen.
Everything built in §0l is reachable only via direct RPC/SQL today — which
is consistent with §0l's own explicit statement that it shipped
"authorization layer only," but it means the entire Tournament Manager
product side of this repo (as opposed to the frozen, proxied Vite engine)
is schema without a workspace.

**Registration itself has no UI either.** Grepped
`teams/[teamSlug]/tournaments/actions.ts` for any INSERT into
`tournament_entries`: none — only SELECT. Nothing anywhere in `src/`
creates a `tournament_entries` row. Every entry in the live database today
exists because it was inserted directly (seed script or SQL), not through
any product surface. `tournament_categories` (divisions/age groups/entry
fee/capacity) has the same status: a real table with RLS, zero UI to create
or edit a category from either the host-org or club side.

### 3.3 Competition data — correctly schema-only where it belongs to the proxied engine, not everywhere

`venues`, `matches`, `match_events`, `player_tournament_results` are
consumed exclusively by the separate, frozen Tournament Manager (Vite) app
per §8's explicit "proxy, don't port" rule — their absence of UI in *this*
repo is by design, not a gap, and should stay that way.
`tournament_roster` is written only by `port_squad_to_tournament()`/
`withdraw_from_tournament_roster()` (§0h), which is correct — this repo owns
the club-side of that boundary. **`tournament_categories` is different**:
it's the host org's own configuration (what divisions this tournament
offers, at what fee), not the proxied engine's runtime data, and it has no
owner-side UI anywhere. This belongs with §3.2's organizer console, not with
the "leave it to the proxied app" list.

### 3.4 Tournament billing: a second, unreconciled permission vocabulary

`docs/tournament-billing-integration.md:178-187` proposes tournament finance
permissions — `view_tournament_finance` (singular), `manage_entry_invoices`,
`verify_tournament_payment`, `issue_tournament_credit`,
`approve_tournament_refund`, `export_tournament_financial_reports` — none of
which exist in the live `permissions` catalog. Grepped every migration for
each string: zero matches. The catalog phase8b already built and seeded
**does** have tournament finance permissions —
`manage_tournament_finances`/`view_tournament_finances` (plural), already
granted to `organizer` and `treasurer`
(`20260909115827_phase8b...sql:120-121,135-136,148-149`) — and the new
document neither reuses them nor references them. This is precisely the
risk the roadmap document warns about in its own risk section: *"Tournament
work can accidentally create a second permission model"*
(`platform-implementation-roadmap.md:963`). Nothing in the 14 billing
migrations wires any tournament-finance permission (old or newly-proposed)
into `has_tournament_permission` or `role_permission_defaults` at all — the
whole tournament billing contract is a design document with a matching RPC
surface (`create_billing_invoice`, `submit_billing_payment`,
`review_billing_payment` — all real, all shared across contexts) but zero
tournament-specific authorization wired to it yet. Before any tournament
finance screen gets built, reconcile the six proposed keys against the two
that already exist and already have role defaults, rather than adding both.

### 3.5 Officiating — schema and RLS only, confirmed unchanged

`org_officials`/`tournament_officials` have no UI in this repo (consistent
with §0l's own scope statement); `manage_officiating` (phase8c) gates writes
correctly per the RLS test that was deleted in §0.2 but whose assertions are
recoverable from git history. No new findings here beyond what §0l already
recorded — restoring the test is the only action item.

---

## 4. Cross-cutting risks

- **The same "role string reused across two tables" pattern that caused the
  `has_tournament_permission` scope-leak bug (§0l) now exists a second time
  in miniature**: `billing_invoices.payer_type` allows `'club'`/`'team'`/
  `'entrant'` alongside `'organization'`/`'family'`/`'guardian'`/`'player'`
  in one flat CHECK, with no context-type-aware gating anywhere yet (§1.4).
  The lesson from §0l — verify the (role/type, permission) pairs never
  actually cross contexts before trusting a shared vocabulary — applies
  directly here and hasn't been applied yet, since no policy narrows on
  `payer_type` at all today.
- **Two RBAC efforts (Club's phase6-7 series and Tournament's phase8 series)
  were each verified live with a real RLS test suite before being trusted.
  The billing series has one unit test file** (`tests/unit/billing-domain.test.ts`,
  "unit tests for invoice calculations" per the handoff doc) **and no RLS
  test at all** — nothing plays the role `tests/rls/club-manager-isolation.test.ts`
  played for every other phase in this project: proving the broad
  `is_org_member` read policy in §1.4 is deliberately temporary rather than
  quietly becoming permanent because nothing ever failed a test over it.
- **Suspending an org (§1.1) and suspending a billing account
  (`billing_accounts.status`, which DOES have a `'suspended'` value in its
  own CHECK) are two different, currently-both-inert switches.** Neither is
  read by any policy or helper today. If both get wired up independently
  later without a single source of truth, an org could end up
  billing-suspended-but-access-active or the reverse, silently.

---

## 5. Priority

**P0 — before this phase is considered "shipped," in any order:**

| # | Area | Problem | Fix |
|---|---|---|---|
| 1 | Platform | `organizations.status = 'suspended'` is read by nothing | Wire it into `is_org_member`/`org_has_product` (or a new top-level gate both call) so a suspended org's access actually stops |
| 2 | Platform | No cross-org troubleshooting path for Platform Admin at all | Build `start_platform_impersonation`/`effective_access_for_platform`, org-scoped not club-scoped, mirroring §0e's proven pattern (§1.2) |
| 3 | Sync | CLAUDE.md §0l and 18 RLS tests were deleted with no replacement | Restore both from commit `f818ac8` |
| 4 | Platform | Billing `is_org_member(org_id)` read policy exposes every org member to every other family's invoices | Narrow with `has_staff_permission`/`has_tournament_permission` before any billing migration reaches production |
| 5 | Platform | "Create invoice" form can never succeed (`billingAccountId` never submitted) | Look up the account id server-side from `orgId`, or add the missing field |

**P1 — real gaps, no urgent forcing function yet:**

| # | Area | Problem | Fix |
|---|---|---|---|
| 6 | Platform | Entitlement lifecycle is binary (on/off), not the roadmap's phased states | Add at minimum a `trial`/`grace_period` distinction the Directory can show and act on |
| 7 | Platform | Support queue shows no entitlement context | Join `org_entitlements` into the support query, same shape as the Directory's own filter |
| 8 | Clubs | `fee_charges` and `billing_invoices` are two unreconciled ledgers | Product decision: which is authoritative; bridge or backfill accordingly |
| 9 | Clubs | `canManageFinances` is a role-literal check; `treasurer` can't manage the club's own Finances tab | Cut over to `has_staff_permission('manage_finances'/'view_finances', ...)`, matching `PlayerProfile.tsx`'s already-correct version |
| 10 | Tournament | No organizer console; `tournament_staff_directory`/`decide_tournament_entry`/registration have zero UI | Build the minimum organizer workspace: staff directory, entry review/decide, category management |
| 11 | Tournament | Tournament billing proposes a second, unreconciled permission vocabulary | Reconcile the 6 proposed keys against the 2 already-live `manage_tournament_finances`/`view_tournament_finances` keys before building any screen |

**P2 / Defer:**

| # | Area | Note |
|---|---|---|
| 12 | Sync | Stray garbled file at repo root | Delete once confirmed unneeded |
| 13 | Platform | Platform-wide audit read surface | Needed once §1.2's backdoor exists, not before |
| 14 | Tournament | Venues/matches/match_events/results UI | Correctly out of scope — belongs to the proxied engine, not this repo |
