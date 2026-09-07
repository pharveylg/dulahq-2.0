# Dula HQ consolidation — phases 1 to 5, applied 7 Sep 2026

Thirteen migrations, applied live to Supabase project `zytyakbgwaegvftblkcn`.
Every filename carries the exact version the live project assigned, so these can be
committed to `supabase/migrations/` as-is and the local history will match remote.

Nothing here required downtime. Dula HQ 1.0 was untouched throughout; dulahq-2.0's
schema changed underneath it, additively.

---

## What the database looks like now

| | |
|---|---|
| Tables | 60 |
| Tables without RLS | **0** |
| Policies | 131 |
| Tables carrying `org_id` | 53 |
| Security advisor **errors** | **0** (was 1 — the `tournament_names` bypass) |

Data: your admin profile, the 27-row skills framework, and 1.0's `backups` table.
Nothing else. The four demo/test accounts are gone; `gadzonline@gmail.com` now has a
proper profile row.

---

## Applied migrations

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
| `…044730_phase2f_restore_public_directory_policies` | **Bug fix** — see below |
| `…044810_phase2g_lock_down_helper_execution` | Revokes `EXECUTE` on every SECURITY DEFINER helper from `anon` |

### The bug worth knowing about

Phase 2e rebuilds policies by dropping *all* policies on each table first. That
silently removed the two anon-facing directory policies phase 2d had created, so the
public directory went dark — verified by an anon simulation returning zero published
tournaments. `phase2f` restores them and must stay ordered **after** 2e.

If you ever re-run a drop-all policy rebuild, re-apply 2f afterwards.

---

## Verified

Run as `anon` and as an org admin inside `BEGIN … ROLLBACK`:

- An org admin with two orgs in the database sees **only their own** club, team and player.
- `is_org_admin()` is false for the other org, true for their own.
- `anon` sees the published tournament and **not** the unpublished draft — the flag is now enforced, where before the view leaked all of them.
- `anon` sees a listed club and not a private one.
- `anon` sees zero players, zero role assignments, zero audit rows, and is refused outright on `backups`.
- `port_squad_to_tournament()` with no consent recorded returned `consent_missing` for a 14-year-old and `ported` for an adult, from the same call.

---

## Code changes these migrations expect

Nothing below is urgent — the app keeps running without it, because every change was
additive and the legacy paths are still honoured. This is the "migrate" half of
expand/migrate/contract.

### 1. Types
Replace `database.types.ts` with the generated file in this folder (73 tables).

### 2. Identity
`public.users.id` is now `auth.users.id`. Anywhere the app looks a user up by email,
use the session user id directly. `current_dula_user_id()` still exists and now just
returns `auth.uid()`, so RPC callers keep working.

Remove any app-side "create profile row on signup" logic, or make it idempotent — a
trigger does it now.

### 3. Inserts must supply `org_id` where there's no parent to derive it from
A `BEFORE INSERT` trigger fills `org_id` from the parent row for 31 tables. These have
no parent and need the app to pass it:

`clubs`, `guardians`, `matches`, `registrations`, `referees`, `officiating_team`,
`access_requests`, `venues`, `org_officials`, `tournament_entries`

### 4. Entitlements gate the product, not the permission
Check `org_has_product(org_id, 'club' | 'tournament')` when deciding whether to render
a product at all. It's checked against the **resource's** org, separately from the
user's role. Seed rows into `org_entitlements` when you create an org — with none, the
write policies on `clubs` and `tournaments` will refuse.

### 5. Roles
Grant through `role_assignments (user_id, scope_type, scope_id, role, org_id)`.
Scopes: `platform` / `org` / `club` / `team` / `tournament`. The old `club_staff`,
`user_assigned_teams` and `org_members` tables are still read by the helpers, so
existing grants keep working — write new ones to `role_assignments`.

### 6. Fees
Stop setting `fee_charges.status` by hand. A trigger on `payments` recomputes it as
`paid` / `partial` / `overdue` / `pending` from `sum(payments)`. Use
`can_create_fees(org_id, club_id)` to decide who may raise a charge.

### 7. Consent
- `requires_guardian_consent(player_id, on_date)` — computed from `dob`, defaults to
  **true** when dob is unknown.
- Roster consent rows: `subject_type='tournament_roster'`, `subject_id=<entry id>`,
  `player_id=<player>`.
- Schedule `expire_stale_approvals()` (a cron or an edge function). Until it runs,
  `approval_is_granted()` still refuses anything not explicitly approved, so silence is
  never consent either way.

### 8. The port
Two RPCs, and they are the only places data crosses the org fence:

```ts
supabase.rpc('port_squad_to_tournament', { p_entry_id, p_player_ids })
// returns rows of { player_id, roster_id, outcome }
// outcome ∈ 'ported' | 'consent_missing' | 'not_your_player'

supabase.rpc('port_match_results_home', { p_match_id })  // returns row count
```

`port_squad_to_tournament` requires the entry to be `accepted` first, and refuses any
minor without an approved consent row. Both write to `audit_log` in **both** orgs.

### 9. Public pages
Query `public_tournaments` and `public_clubs` (both `security_invoker`) for the
directory. They return only published rows and only safe columns. Nothing is published
by default — set `publicly_listed = true` deliberately.

### 10. Renames and deprecations
- `media.r2_key` → `media.storage_key`
- `players.age` is deprecated — display only, never decide with it
- `match_events.player_name` is deprecated — use `player_id` → `tournament_roster`

---

## Deliberately NOT done — these are contract steps, they need code first

Each of these breaks something until the app stops using it. Do them one at a time,
after the matching code has shipped.

- Drop `users.role` as an authorization source (still readable; helpers no longer rely on it for tenancy)
- Drop `players.age`
- Retire `org_members`, `club_staff`, `user_assigned_teams` once all grants live in `role_assignments`
- Retire `referees` and `officiating_team` in favour of `org_officials`
- Drop `match_events.player_name` / `player_off_name`
- Drop `backups` — only after the rebuilt tournament module reaches parity (phase 5's real completion)
- Tighten `backups` RLS to org scope, or drop it, whichever comes first

## Two things I could not do from here

- **Leaked-password protection** is still off. It's a dashboard toggle under Auth, free, worth flipping before real signups.
- **`tournaments.id` is `text`**, inherited from 1.0's single-tournament era. Every new table references it as text. If you want it to be a uuid, change it while the table is empty — it gets expensive later.
