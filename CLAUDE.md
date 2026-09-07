# Dula HQ — project context

Consolidating two live deployments under one brand ("Dula HQ"), on one origin,
with one login. Ground truth below was verified directly against the live
Vercel and Supabase projects on **2026-09-07**. Re-verify anything load-bearing
before acting on it — this file goes stale.

---

## 0. What changed on 2026-09-07 — read this first

**The database consolidation (phases 1–5) is applied and verified.** Thirteen
migrations are live in `zytyakbgwaegvftblkcn` and committed under
`supabase/migrations/`. Most of §3's security list is closed. §2's row counts are
gone. Do not re-plan this work — extend it.

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

**A. Buy the domain, then single origin.** `dulahq.com` is **not registered**
(~$11.25; `dulahq.app` ~$9.99). The live tournament app already ships
`<link rel="canonical" href="https://www.dulahq.com/">` pointing at a domain
nobody owns. Attach the domain to the **Next** project; leave
`dula-hq.vercel.app` where it is as a break-glass URL. Add rewrites `/t/:slug`,
`/t/:slug/:path*`, `/platformconsole` → the tournament app. No repointing, no
downtime window.

**B. One cookie session.** Apply the `@supabase/ssr` bootstrap to the Vite app.
Use `getUser()`, not `getSession()` (§7). Verify with a `/t/…` deep link.

**C. Entry flow.** Home page is identical for everyone, guests included: choose
**Clubs** or **Tournaments**, then browse. A club shows an overview unless RBAC
grants more; a tournament shows the guest view unless you are registered for it.
Signing in lands nobody on a dispatcher — context comes from the URL.

**D. Wire the app to §5.** Types are not generated in this repo today; generate
them when starting this.

**E. Sports + PWA.** `sports` is seeded (football production; tennis, pickleball,
basketball `coming_soon`) and `sport_id` is on clubs, teams and tournaments.
Remaining: manifest, service worker, picker.

**F. Contract steps — each needs code shipped first.** Drop `users.role` as an
auth source; drop `players.age`; retire `org_members` / `club_staff` /
`user_assigned_teams`; retire `referees` / `officiating_team` for `org_officials`;
drop `match_events.player_name`; drop `backups`.

**G. Consider `tournaments.id`.** It is `text`, inherited from 1.0's
single-tournament era, and every new table references it as text. The table is
empty right now — this is the cheapest it will ever be to change to `uuid`.

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
- **Cloudflare is dropped.** R2 was never enabled and there are no Workers.
  Storage is Supabase (1 GB free). `wrangler.toml` in this repo is dead weight.
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
