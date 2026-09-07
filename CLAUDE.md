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
