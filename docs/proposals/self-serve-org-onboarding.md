# Self-serve organization onboarding

_Written 2026-10-08. Status: **approved to build, phased** — feasibility check against
the live schema and `main` at `6d2af36`. Source document:
`dula-hq-self-serve-org-onboarding-review.md`, supplied by the user. Nothing in this
file has been built yet; Phase 0 is next._

**Decisions (2026-10-08):**
- Negotiated per-org pricing (Phase 5) is confirmed deferred — not needed yet. Every
  published plan stays zero-priced and Platform Admin keeps provisioning paid/
  negotiated deals by hand until a real pilot needs otherwise.
- Self-serve audience: any verified account, no invite/allowlist gate. Add
  rate-limiting only if abuse actually shows up.
- Trial length and caps: approved exactly as recommended — 14 days; Club 1 club/1
  team; Tournament 1 tournament/5 entries.
- Test Roles: reuse `/demo`'s persona-switcher, scoped to the new org, rather than
  building a separate mock sandbox.

**Phase 0 is done** (2026-10-08, `phase18a`): `org_members`'s missing migration is
backfilled; `organizations.about`/`location` added (no new exposure — that table was
already fully public for `name`/`accent`/`logo_url`); a new
`organization_contact_details` table holds contact/address with zero `anon` access
and its own `show_publicly` flag, nothing reads it publicly yet; `trial_policy`
(singleton, 14 days) and `trial_caps` (the four approved numbers) are seeded and
platform-admin-writable. Verified live: guard counts unchanged, all 5 existing
`org_members` rows untouched, `anon` has zero grants on the contact table, a non-admin
org member is refused writing contact details, an org admin can write and read their
own.

**Phase 1 is done** (2026-10-08, `phase18b`): `create_self_serve_organization(name,
slug)` is one atomic SECURITY DEFINER function -- creates the organization, inserts
the caller as its first `org_members` admin, and starts a 24-hour
`org_onboarding_shells` deadline, all in one transaction (a failure partway rolls
back everything, satisfying the review's "atomic and safe to retry" requirement
directly). This needed its own bootstrap path because `is_org_admin()`'s only
bootstrap branch is for a platform admin -- an ordinary self-serve creator has no
such status, so without this function nobody could ever insert the first admin row
for their own brand-new org. `expire_onboarding_shells_system()` runs hourly via
`pg_cron` (`37 * * * *`) and deletes only a shell whose 24 hours have passed AND
which still has zero `org_entitlements` -- a shell that became a real trial is never
touched even if its own row wasn't cleared yet. New UI: `/organizations/new` (signed-in
gate, name + web address) and `/organizations/[orgSlug]` (shell deadline, entitlements
if any, a link to `/demo` for Test Roles, and a "starting a trial isn't available yet"
note -- that's Phase 2). A link from the homepage, next to the existing `/demo` link.

Verified live, including a real end-to-end pass through the actual UI (signed in as
the demo tournament organizer persona, who has no `org_members` row at all): creation,
first-admin bootstrap, and the 24h shell deadline all work for a user with zero org
relationships; anon is refused at the grant level; a duplicate slug is refused; a
different signed-in user cannot see the shell's deadline; the cleanup function deletes
an expired empty shell and leaves one with an entitlement untouched even when its shell
row is also stale. Test org and fixtures removed afterward.

**Phase 2 is done** (2026-10-08, `phase18c`): `start_product_trial(org, products[])`
grants `org_entitlements(status='trial')` + a matching `billing_subscriptions` row per
chosen product, sharing one trial clock across every product an org ever starts (read
once from the first trial, reused for any later one -- never reset or stacked).
Zero `org_entitlements` rows have ever had `valid_until` set, so this was the safe
moment to fix the date/timestamp mismatch Phase 0 flagged: `valid_until` is now
`timestamptz`, and `org_has_product()` compares against `now()` instead of
`current_date` -- no existing org was affected, confirmed live before changing it.

Hard caps are four `BEFORE INSERT` triggers (`clubs`, `teams`, `tournaments`,
`tournament_entries`), each locking the parent row (`for update`) before counting --
the standard Postgres answer to the review's own "count-then-insert can be bypassed by
concurrent requests" warning, since two simultaneous inserts against the same parent
are forced to take that lock one after another. Each is a no-op once the entitlement
is `active` rather than `trial`, and a no-op entirely if `trial_caps` has no row for
that key. `/organizations/[orgSlug]` now shows a real "Start a free trial" form (with
the actual numbers from `trial_policy`/`trial_caps`, not hand-typed copy) once an org
has no product yet, and the entitlement's trial end date once it does.

Verified live in a single rolled-back transaction covering every path: the shared
clock across two products, the shell being cleared once a trial starts, all four caps
refusing their first over-the-limit insert, and a club flipped to `active` immediately
allowing a second one. Separately verified that an ordinary org admin's session
cannot flip `org_entitlements.status` directly (RLS silently filters it -- correct,
since no "pay now" path exists yet; that's Phase 3). Six more tests added through the
real Supabase JS client (not raw SQL) covering the same ground, plus a full
end-to-end pass through the actual UI signed in as a persona with no prior org at
all: create → start a club trial → status page shows "Club — trial · ends
10/22/2026" with working links to Clubs/Tournaments. Running the **full** suite
after this phase surfaced two pre-existing staleness bugs, unrelated to Phase 2 and
now fixed: a phase17a test asserting the public-profile player shape before
phase17b added `photoKey` to it, and the anon-secdef-allowlist guard test still
pinned to its single phase16b entry after phase17a added a second. Full suite: 362
passed. Phase 3 (upgrade via the existing manual billing path) is next.

## What was checked, and what it confirmed

The review's technical claims were checked against this repo and the live project
rather than taken on trust. All of the following are confirmed live:

- **`org_members` has no `CREATE TABLE` anywhere in `supabase/migrations/`**, though
  it's read and written throughout the app. It exists live with exactly
  `org_id, email, user_id, role, created_at` — no `id` column, no invite flow. This is
  the same class of gap as the 14 out-of-band billing migrations in CLAUDE.md §0m and
  the ten pre-phase2 migrations in §0a: real, applied, undocumented. Not a blocker for
  this work, but worth backfilling into a migration file the same way those were.
- **`organizations` has only `id, slug, name, accent, logo_url, status, created_at`.**
  No about/location/contact/address columns at all — the review's "verify against
  applied migrations" caveat was right to flag this as unconfirmed; it's confirmed
  absent. `clubs` got exactly this kind of section (`about`, `location`,
  `contact_email`, `contact_phone`, public-visibility rules) in phase17a
  (2026-10-05) — that migration is the direct template for organizations.
- **`org_entitlements.valid_until` is `date`; `billing_subscriptions.ends_at` is
  `timestamptz`.** The review's off-by-one/timezone warning is live, not theoretical.
- **`billing_plans` has three version-1, zero-priced rows**: `club-basic`,
  `tournament-basic`, `combined-basic`, all `base_amount = 0`. `combined-basic` exists
  but `provisionTenant` creates separate club/tournament subscriptions regardless —
  confirmed in `src/app/platformconsole/actions.ts`, matching the review exactly.
- **`createTeam()` has no cap check** (`src/app/c/[clubSlug]/actions.ts`) and
  **tournament entry creation checks only the category's own `capacity`**, not a
  tournament-wide total (`src/app/tm/[orgSlug]/[tournamentSlug]/actions.ts`). Zero
  hard-cap enforcement exists anywhere in the write paths today.
- **Zero `org_entitlements` rows are currently `trial`.** The trial path has never
  been exercised against a real org.
- **The live site title is `Dulà HQ`**, with the grave accent, in `layout.tsx`'s
  metadata and nav — the review's "current vs. target brand" note is accurate; nothing
  in the codebase uses the ASCII `Dula HQ` spelling anywhere yet. That's a separate
  rename decision, out of scope here.
- **`pg_cron` is already scheduled five times** in this project (expiring stale
  approvals, temp logins, monthly usage/infra snapshots). A trial-expiry and
  shell-cleanup job is the same pattern, not a new capability for this codebase.
- **`provisionTenant` is guarded by `isPlatformAdmin()`**, confirmed, and it performs
  several sequential writes with no rollback — the review's "atomic and safe to retry"
  concern for a customer-facing equivalent is justified by reading the function itself.

Everything else in the review — the entitlement/subscription model, the manual-QR
billing state, the absence of a payment provider, the Access Manager prototype being
mock-only — matches this project's own CLAUDE.md record and wasn't re-litigated here.

## Where this review's recommendation fits this project particularly well

Two things make the "reuse everything, add narrowly" framing easier here than it
would be in a cold start:

1. **This project already has a working non-admin self-serve account path.**
   Guardian signup (`/guardian-signup`) and IT-issued temporary logins both create
   real, verified accounts outside the platform-admin provisioner. A self-serve
   organization-creation action is a third instance of the same shape — a trusted
   server action that authorizes off the verified session, not a new paradigm.
2. **`/demo` already does most of what the review calls "Test Roles."** It lets
   anyone sign in as any real role against showcase data and see exactly what that
   role can and can't do, with no account needed. Before building a second, isolated
   mock-data sandbox, it's worth deciding explicitly whether a new org's owner should
   land on a scoped version of `/demo`'s own persona-switching pattern instead of a
   parallel prototype. This needs a decision (§ below), not an assumption either way.

## Where I'd push back or simplify

- **Don't build the negotiated-rate-card system before the first live pilot.**
  Every published plan is currently zero-priced, there's no payment provider, and
  Vercel hobby plan forbids commercial use until the product takes revenue (CLAUDE.md
  §8) — so "self-serve, publicly, with real money" isn't actually reachable yet
  regardless of how this is built. The realistic v1 is **trial-only self-serve**, with
  "Pay now" landing in the *existing* manual QR/invoice flow (already built, §0q) for
  Platform Admin to settle by hand. The full org-scoped `billing_plans` versioning and
  Platform Console rate editor is real, valuable work — just sequence it after the
  trial path ships, not before.
- **Don't build the Organization Profile & Branding section as a from-scratch
  design.** `clubs` got this exact section nine days ago. Copy its shape onto
  `organizations` (same columns, same public/private split, same upload path) rather
  than re-deriving requirements — it's a smaller, lower-risk piece of work than the
  review's phrasing implies.
- **Resolve the `org_members` gap as part of this work, not separately.** Any new
  self-serve write path that touches `org_members` should ship with the missing
  `CREATE TABLE IF NOT EXISTS` backfilled into a migration first, the same way
  phase2h/phase2i were reconstructed in §0a. Building on top of an undocumented table
  without pinning its shape first is how a future session breaks it by accident.

## Decisions this needs before any code (unchanged from the review, restated)

1. Who can self-serve: any verified user, or gated somehow?
2. 14-day trial, starting on first product-trial activation — approve or change.
3. Caps: one club/one team; one tournament/five entries — approve or change.
4. Is the isolated Test Roles sandbox a new mock build, or a scoped `/demo`?
5. Negotiated rates: build before or after the first self-serve pilot goes out?

## Phased delivery sequence

Each phase is independently shippable and leaves the app in a working state —
consistent with how every other feature in this codebase has landed (CLAUDE.md's
whole history is one phase at a time, verified live before the next starts).

**Phase 0 — Schema groundwork, no UI.**
Backfill `org_members`'s `CREATE TABLE` into a migration matching the live shape.
Add `organizations.about/location/contact_email/contact_phone` plus the same
public-visibility guard pattern `clubs` already has. Add a small versioned
`billing_plan_limits`-style table for trial caps (`teams_per_club`,
`entries_per_tournament`, etc.) and a `trial_days` column on `billing_plans`. No
behavior changes yet — this is the same "migration first, reconciled against live"
discipline every other phase in this project has used.

**Phase 1 — Self-serve organization creation, trial-only.**
A new server action, authorized off the verified session (not `isPlatformAdmin()`),
creates the org + first-admin `org_members` row + the Organization Profile fields
from Phase 0. No product entitlement yet. A `pg_cron` job expires an unselected shell
after 24 hours, mirroring the existing `expire_stale_approvals`/`expire_temp_logins`
jobs. Resolve the Test Roles decision here — reuse `/demo`'s pattern scoped to the
new org, or build the isolated sandbox.

**Phase 2 — Product trial entitlements with real hard caps.**
A second server action attaches `org_entitlements(status='trial')` and
`billing_subscriptions(status='trial')` for the chosen product(s), using one
server-generated `timestamptz` as the authoritative trial end (fixing the
date/timestamp mismatch from Phase 0's audit, rather than carrying it forward).
Add the transactional cap check to `createTeam()` and tournament entry creation,
reading the new `billing_plan_limits` row for the org's current plan. A second
product added mid-trial reads the existing end date rather than creating a new one.

**Phase 3 — Upgrade, using the existing manual billing path.**
"Pay now" creates a `billing_invoice` against the resolved plan through the billing
functions already built in §0q/§0m — no new payment infrastructure. Platform Admin
verifies payment the same way they already do for tournament and platform invoices;
verification flips the entitlement/subscription to `active` and the cap check in
Phase 2 is skipped for an active (non-trial) entitlement.

**Phase 4 — Trial expiry and the read-only/export grace period.**
A `pg_cron` job expires trials whose end date has passed, following the shell-cleanup
job's shape from Phase 1. Building the actual read-only access mode (reads allowed,
writes blocked, distinct from today's binary `org_has_product()`) is real RLS work —
budget it as its own step, not a line item inside this phase.

**Phase 5 — Platform Admin plan and negotiated-rate controls.**
Org-scoped `billing_plans` rows, a rate-assignment screen in `ProvisionForm` and the
Billing console, and wiring `provisionTenant`/the new self-serve checkout through one
shared plan-resolution function instead of the hard-coded version-1 helper. This is
the review's §4 in full — sequenced last because nothing before it depends on it, and
every plan in production today is zero-priced regardless.

**Phase 6 — Parity and polish.**
Same Organization Profile & Branding fields in `ProvisionForm` as self-serve (Phase 0
already added the columns; this is the admin-facing form). Acceptance-criteria
sign-off against the review's §9 checklist. Retention/purge policy for expired trials.

## Bottom line

Feasible, and less new ground than the review's length suggests: the entitlement,
subscription, audit, RLS, and scheduled-job primitives it leans on already exist and
have been exercised repeatedly in this codebase. The genuinely new work is the
non-admin creation path, transactional cap enforcement, and (if wanted before a
pilot) org-scoped pricing. Sequencing the pricing system last, and reusing `clubs`'
just-shipped profile pattern for `organizations`, should cut real build time
compared to building every piece in the order the review lists them.
