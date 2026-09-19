# Tournament organizer console — proposal (not built)

Status: **proposal for review.** Nothing here is implemented. It closes gap
analysis P1-10 (`docs/platform-club-tournament-gap-analysis.md` §3.2) and
would be the first native Tournament workspace in this repo. The frozen Vite
engine (brackets, live scores, matches) stays proxied and is out of scope.

## The problem, checked against the live database

The tournament authorization layer (CLAUDE.md §0l) is built and tested, and
nothing uses it:

- `decide_tournament_entry()`, `tournament_staff_directory()` and
  `tournament_audit_log()` exist and are called by **no page**.
- Nothing in `src/` inserts a `tournament_entries` row, so every entry today was
  created by SQL or a seed script.
- `tournament_categories` has RLS and no UI.

**A second problem this check turned up, and the reason this is more than
pages:** an Organizer who is not also an org admin cannot read the entries they
are meant to decide.

| Table | Read policy | Write policy |
|---|---|---|
| `tournament_entries` | `is_org_member(host_org_id)` or `is_org_member(entrant_org_id)` | `is_org_admin` only |
| `tournament_categories` | `is_org_member(org_id)` | `is_org_admin` only |

`is_org_member` has no `tournament_staff` branch (it predates the tournament
layer), so an `organizer` or `team_coordinator` gets **zero rows**. They could
call `decide_tournament_entry` on an id they cannot list. The fix is targeted
policies keyed on `can_read_tournament` / `has_tournament_permission`, **not**
adding tournament staff to `is_org_member`: that helper is the spine of ~60
policies, and widening it would hand tournament staff club and player data.

## Proposed slices, each shippable on its own

Route: `/tm/[orgSlug]/[tournamentSlug]` (org + tournament slug, matching the
public `/t/:org/:slug` shape; `/t/` itself is the proxy). Permission-gated, not
role-gated, like the club console.

**1. Entry queue** — the core of it.
List entries by status with team, category, club-backed vs external, and the
entry's contacts. Accept / decline through `decide_tournament_entry`, with the
existing audit. Payment stays separate from acceptance, per
`tournament-billing-integration.md` ("do not make payment verification
automatically change an entry to accepted").
*Needs:* a `te_read` branch for `can_read_tournament`.

**2. Staff and audit.**
`tournament_staff_directory()`, add / archive staff, suspend / reactivate via
`set_tournament_staff_account_status`, and the `tournament_audit_log()` panel
for `view_audit_log` holders. Also the first place a `tournament_it_admin` has a
surface at all.

**3. Categories.**
Create / edit divisions (`name`, `age_group`, birth-year range, `format`,
`sort_order`). *Needs:* `tc_write` widened to `manage_competition`.
Note `tournament_categories` has **no fee or capacity column** — the gap
analysis assumed both. Entry fees and caps are a schema decision (below).

**4. Add an entry (host-entered registration).**
An organizer form: team name, category, optional club, contacts
(`tournament_entry_contacts`, name / email / role). This is what already happens
today by SQL, given a UI. *Needs:* `te_host_write` widened to
`manage_tournament`.
Optionally issues the entry-fee invoice through `create_billing_invoice`
(`source_type = 'tournament_entry'`), which phase9c already authorizes for
`manage_tournament_finances`.

**5. Finance queue** (later, depends on 1 and 4).
Submitted payments to verify or reject, using `can_read_billing_account` /
`review_billing_payment`. Small once entries exist to bill.

## Decisions I need from you

1. **Registration: host-entered only, or also self-service?** The existing
   `te_entrant_apply` policy needs the entrant to be an org admin, and an
   external team has no org. So today only the host can create entries. I'd
   ship host-entered (slice 4) first. Self-service public registration needs
   spam and abuse control and a way to authenticate an org-less team, and is a
   feature in its own right.
2. **Fees and capacity.** Add `entry_fee` / `capacity` to `tournament_categories`,
   or leave pricing to the invoice step? Without them slice 4 has nothing to
   default the invoice amount from.
3. **Team Coordinator's "flag for review".** §0l decided the coordinator reviews
   and the organizer alone accepts, and seeded `review_tournament_entry` without
   wiring it. Where does a flag live: a `review_note` on the entry, a separate
   table, or skip it in v1? I'd skip it in v1.
4. **Route name.** `/tm/...` is a placeholder.

## Explicitly out of scope

Brackets, scheduling, live scores, venues, matches (the proxied engine);
officiating UI (`org_officials` is an org-level pool with no tournament id — its
own design question); anything touching `is_org_member`.

## Verification I'd hold it to

Each slice ships with RLS tests written first, in the style of the existing
suite: an Organizer who is not an org admin can list and decide entries, a
`treasurer` cannot decide, a coach in the same org sees nothing, and a
different org's organizer sees nothing. Then driven through the real UI as the
Organizer persona (the demo has none yet, so slice 1 would add one).
