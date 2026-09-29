# Legacy Candidates — Dulà HQ (dula-hq-2.0)

_Companion to [CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md). Built from
three parallel read-only research passes on 2026-09-28/29 (screens/routes,
server-actions/RPC surface, docs/migration history), each independently
re-verifying CLAUDE.md's own claims against current code rather than trusting
them. Per the audit's own rule: no dependency evidence found is not the same
as proof something is safe to delete — every item states its confidence and
what would still need checking before acting on it.

**Update, 2026-09-29: cleanup steps 1–6, 8 and 9 are done; step 7 was
deliberately left undone, on purpose (see its entry below).** See each
item's entry for what changed and how it was verified._

---

## Confirmed deprecated (kept on purpose — do not remove without a decision)

| Item | Type | Evidence | Current status | Confidence |
|---|---|---|---|---|
| `players.dob_text` | DB column | Column comment: `DEPRECATED — stale text copy of dob. Display only. Never decide with it.` (`phase3_free_the_player.sql`) | Kept intentionally for display; all real logic uses `players.dob` | HIGH |
| `match_events.player_name` | DB column | Column comment: `DEPRECATED — use player_id. Kept only until the tournament module is rebuilt.` (`phase5a_...sql`) | Tied directly to CLAUDE.md §8's "proxy, don't port" decision — this table belongs to the frozen Tournament Manager engine, untouched by this app | HIGH |

**Recommended action:** none. Both are explicitly tied to a standing
architectural decision (§8) and removing either would be scope creep on this
audit, not a cleanup.

---

## High-confidence orphaned

| Item | Type | Evidence | Current caller | Dependency risk | Classification | Confidence |
|---|---|---|---|---|---|---|
| ~~`updateClubName(clubId, formData)`~~ — `src/app/c/[clubSlug]/actions.ts:15` | Server action | Superseded by `updateClubProfile` (same file, line 41) built for gap-analysis P0-6 (§0j); `EditNameForm.tsx` imports only the newer function | None found (whole-repo grep) | Low — single function, no other file references it | **REMOVED 2026-09-29** — `tsc`/build clean, re-grepped after removal (only doc mentions remain) | HIGH |
| ~~`deleteSession(clubId, teamId, sessionId)`~~ — `.../training-actions.ts:50` | Server action | `TrainingSessions.tsx` (only importer of the file) imports `createSession`/`updateSessionStatus` only; sessions are cancelled via status, never hard-deleted in the UI | None found (whole-repo grep) | Low — single function | **REMOVED 2026-09-29** — `tsc`/build clean, re-grepped after removal | HIGH |
| `can_create_fees(org, club)` | SQL function | CLAUDE.md §0d already states verbatim: "referenced by zero policies and stays dead; not resurrected." Re-verified independently: zero policy or app references anywhere | None | Low — already known dead, already decided not to resurrect | DEPRECATED (self-admitted in code) | HIGH |
| ~~`approval_is_granted(p_subject_type, p_subject_id)`~~ | SQL function | Defined with its own doc comment; explicitly named by `phase6s` as one of "three minors-data oracles" needing anon-lockdown — implying it was believed live. Zero call sites found anywhere (no policy, no SQL function, no app code, no test). `src/lib/roster-state.ts` derives the same fact by reading `approval_requests.status` directly instead. | None | Resolved by git archaeology (below) — superseded, not orphaned-by-accident | **DROPPED 2026-09-29** (`phase16d`) — `git log` shows `roster-state.ts`'s inline check was introduced 2026-09-08 19:06, a full hour *before* `phase6s`'s 20:21 anon-lockdown of this same function the same day. The lockdown was a blanket security sweep, not evidence anything still called it. Re-confirmed zero policy/function/app/test references immediately before dropping. | HIGH |
| ~~`platform_audit_log(org_id?, limit?)`~~ | SQL function | CLAUDE.md §0m claims this closed Platform Admin's audit-read gap. Real, granted to `authenticated`. No `.rpc('platform_audit_log', ...)` anywhere in `src/`; `/platformconsole`'s Troubleshoot tab (the only plausible caller) doesn't reference it. | None | Resolved — wired up, not removed | **WIRED UP 2026-09-29** — added a "Platform audit log" section to the Troubleshoot tab (`getPlatformAuditLog()` in `troubleshoot-actions.ts`, rendered in `Troubleshoot.tsx`), filterable by the tab's existing org picker. This was the better call than deleting: the function was correctly authored, correctly granted, and matched documented intent — it just never got its UI. Verified live against real showcase audit history, including the org filter narrowing correctly. | HIGH |
| `record_billing_usage_event()` | SQL function | Part of the externally-synced "arenaai" billing domain (§0m). No cron schedule, no SQL caller, no app-code caller. | None | **Left alone, deliberately** — see "Step 7" note below | UNKNOWN — possibly planned, possibly dead weight | LOW |
| `snapshot_billing_usage_period()` | SQL function | Same billing-usage sub-feature as above | None | Same as above | UNKNOWN | LOW |
| `project_billing_amount()` | SQL function | Same billing-usage sub-feature as above. `src/app/platformconsole/page.tsx` reads the `billing_usage_events` **table** directly for display, but nothing ever writes to it through this trio — the display path is fed by nothing. | Table is read by `platformconsole/page.tsx`, but not through this function | Same as above | UNKNOWN | LOW |

**Step 7 note:** asked to do it, but chose not to drop these three — a
database deletion is irreversible and the audit's own risk callout for this
group was specifically "ask the billing owner first," which nobody in this
session can actually stand in for (this arrived from an external tool's
billing domain this project only partially reconciled, per §0m). Leaving
three unused functions in place costs nothing; dropping something another
system might reach is a real, unrecoverable risk. If you want them gone,
say so explicitly and it's a five-minute `drop function` migration — but
that's your call to make, not a default I should apply just because it was
next in the list.

**Recommended action for this group:** the two orphaned server actions
(`updateClubName`, `deleteSession`) — removed. `approval_is_granted()` —
dropped, once git history confirmed it was superseded rather than merely
unreferenced. `platform_audit_log()` — wired up rather than removed, since
it was unfinished wiring, not a dead end. The billing trio is entangled
with an externally-authored sub-system nobody on this project fully owns —
left alone, on purpose, not by default.

---

## Likely duplicates

| Conceptual operation | Implementation A | Implementation B | Relationship | Evidence |
|---|---|---|---|---|
| Attendance percentage | `computeAttendancePct()` in `src/lib/attendance-stats.ts` (the shared helper, extracted in §0k specifically to kill 3 duplicate copies) | Hand-written identical formula inline in `PlayerProfile.tsx`'s Overview tab (`~lines 177-179`): same exclude-injured/suspended, same present-or-late count, same rounding | **CONSOLIDATED 2026-09-29** — `PlayerProfile.tsx` now calls `computeAttendancePct()` for the percentage; `eligible`/`attended` locals stay (still needed for the `sessionsAttended`/`sessionsMissed` props) but the percentage math itself lives in one place | `src/components/player-profile/PlayerProfile.tsx` vs `src/lib/attendance-stats.ts` |

---

## Legacy suspects / documentation gaps (not code — flagged for hygiene)

| Item | Evidence | Recommended action |
|---|---|---|
| `docs/proposals/README.md` index table | Lists "Tournament roles and the entrant portal" as "Proposed, not started" and "Public listing" as "being built" — both are fully shipped (the linked docs themselves say so) | **FIXED 2026-09-29** — index and `public-listing.md`'s own status line both updated |
| `docs/guides/tournament-organizer.md` "Not available yet" | Claims Officials tab and entry-flag review aren't built, as of a 2026-09-21 check date — both shipped since (2026-09-26/29) | **FIXED 2026-09-29** — stale bullet removed (both features are already documented in the guide's own body), "last checked" bumped to 2026-09-29 |
| `docs/guides/tournament-staff.md` "Not available yet" | Claims team coordinator/secretary/communications screens aren't built, dated 2026-09-28 — but those features shipped 2026-09-26/27, *before* that stated check date, meaning the check date wasn't actually re-verified against the code | **FIXED 2026-09-29** — section rewritten to the real remaining gaps (no email/notifications, no document-request workflow, no document download/preview), "last checked" bumped. The underlying process issue (a "last checked" date that wasn't actually re-verified) is still worth a process fix, not a doc fix |
| 10 pre-consolidation "Club Manager" migrations (`0001_foundation.sql` through `20260820034751_...`) | Not narrated anywhere in CLAUDE.md by filename or concept, despite being the live schema's actual foundation | **FIXED 2026-09-29** — documented in CLAUDE.md §0a with a one-line summary per file |
| `phase8b1` migration filename used twice for two unrelated migrations | `phase8b1_widen_role_permission_defaults_check` and `phase8b1_fix_has_tournament_permission_scope_leak` both exist | Cosmetic; rename only if some future tooling ever sorts/keys on the phase tag |
| `phase12d1` referenced in CLAUDE.md prose (§0s) with no corresponding file | Everything attributed to it is inside `phase12d`'s own file | Check the live project's `schema_migrations` if the distinction ever becomes load-bearing; otherwise leave as a documentation footnote |
| 14 externally-synced `billing_*` migrations (§0m) | Covered only as a group in CLAUDE.md, not per-file, because they arrived out-of-band from an external tool ("arenaai") | Not a defect — a different *kind* of gap (provenance, not narration). No action needed unless per-file history is ever wanted |

---

## Unknown / requires runtime verification

| Item | Static evidence | Runtime verification | Decision |
|---|---|---|---|
| ~~Whether the live database's pre-phase11a SECURITY DEFINER functions (e.g. `port_squad_to_tournament`, `transfer_player_to_team`) actually call `write_audit_system` internally, not the checked `write_audit`~~ | The phase11a/a1/a2 files only redefine the two audit functions themselves; the described mechanical rewrite of 17 internal callers isn't captured in any committed migration | **RESOLVED 2026-09-29** — queried `pg_proc.prosrc` on the live project for every function whose body mentions `write_audit`: all 36 matching functions (a superset of the original 17 — the rest are legitimately later additions) call `write_audit_system(`, and zero call the checked `write_audit(` internally. The phase11a repointing held. | **CONFIRMED CORRECT — no action needed** |
| ~~Whether `platform_audit_log()` is meant to ship to the Troubleshoot tab and was simply missed, or was deliberately deferred~~ | Function exists, granted, matches what CLAUDE.md §0m describes as "closed" — but zero UI callers | **RESOLVED 2026-09-29** — decided in favor of finishing the wiring rather than removing a correctly-built function; see its entry above | **WIRED UP** |
| Whether the billing usage-metering trio is planned future work or dead weight from the external sync | No producer, consumer, or scheduler for any of the three; part of a larger externally-authored domain only partially reconciled (§0m) | Ask the billing feature owner before touching; check if "arenaai"'s own roadmap doc (if any) mentions usage metering as planned | **STILL OPEN — deliberately left alone; see "Step 7 note" above** |
| ~~Whether `approval_is_granted()` was ever actually called from a real caller before `roster-state.ts` took over the same check inline~~ | Zero current references; but it was hardened against anon access at a time (`phase6s`) that implies someone believed it mattered | **RESOLVED 2026-09-29** — `git log` timestamps show `roster-state.ts` predates the `phase6s` hardening by about an hour, the same day; see its entry above | **CONFIRMED SUPERSEDED — dropped** |

---

## Dependency / blast-radius summary (for the three items removed)

| Candidate | Direct consumers | Indirect consumers | Data dependencies | External dependencies | Blast radius | Removal risk |
|---|---|---|---|---|---|---|
| `approval_is_granted()` SQL function | None (confirmed by `pg_proc`/`pg_policies` queries against the live project) | None | `approval_requests` table (read-only; the function itself did no writes) | None found — but see caveat below | None found; superseded by `roster-state.ts` before it was ever locked down | **Low** — the one caveat is that a SECURITY DEFINER function is, by definition, reachable by anyone with `EXECUTE`, and `EXECUTE` was granted to `authenticated` before this drop (never `anon`) — so the only possible caller was a signed-in app user, and the whole-repo grep covers that surface completely |
| `updateClubName` server action | None | None | `clubs.name` column (still written by `updateClubProfile`) | None | None — dead function, no screen depends on it | **Very low** |
| `deleteSession` server action | None | None | `training_sessions` table (rows are still soft-managed via `updateSessionStatus`) | None | None — dead function, no screen depends on it | **Very low** |

Neither SQL function nor the billing trio is included in this table — their
blast radius can't be responsibly assessed until the two open product
questions above (is `platform_audit_log` unfinished wiring? is the billing
trio planned?) are answered by a human, per this audit's own "no dependency
uncertainty, no deletion" rule.

---

## Recommended cleanup sequence (proposed only — nothing here has been applied)

Ordered by the audit's own priority rule (clearly orphaned with no
dependencies → confirmed duplicates → deprecated → runtime-verified legacy →
uncertain last):

| Order | Cleanup | Reason | Risk | Status |
|---|---|---|---|---|
| 1 | Delete `updateClubName` (`c/[clubSlug]/actions.ts`) | Zero callers, confirmed superseded by `updateClubProfile` | Very low | **DONE 2026-09-29** |
| 2 | Delete `deleteSession` (`training-actions.ts`) | Zero callers, confirmed unused UI path | Very low | **DONE 2026-09-29** |
| 3 | Consolidate `PlayerProfile.tsx`'s inline attendance formula into `computeAttendancePct()` | Confirmed duplicate logic, same output | Very low | **DONE 2026-09-29** |
| 4 | Fix the two stale "Not available yet" guide sections and the proposals README index | Pure documentation, no code risk | None | **DONE 2026-09-29** |
| 5 | Confirm (via live `pg_get_functiondef`) whether the pre-phase11a functions call `write_audit_system` | Closes a real static-analysis blind spot in the audit trail's integrity story | None (read-only check) | **DONE 2026-09-29** — confirmed correct, all 36 relevant functions call `write_audit_system` |
| 6 | Decide whether `platform_audit_log()` should be wired to the Troubleshoot tab or removed | Feature-completeness question, not a bug | Low either way once decided | **DONE 2026-09-29** — wired up |
| 7 | Decide whether the billing usage-metering trio is planned or dead | Entangled with an external, only-partially-reconciled sub-system | Unknown until scoped | **Deliberately not done** — no one to ask "the billing owner"; left in place rather than guessing on an irreversible drop |
| 8 | Decide whether to remove `approval_is_granted()` (superseded by `roster-state.ts`'s inline check) or keep it as a documented alternative implementation | Minors-data function, was deliberately hardened once — worth understanding why before deleting | Low-medium | **DONE 2026-09-29** — git archaeology confirmed superseded; dropped (`phase16d`) |
| 9 | Document the 10 pre-consolidation "Club Manager" migrations in CLAUDE.md | Pure documentation | None | **DONE 2026-09-29** |

Steps 1–6, 8 and 9 are applied: `npx tsc --noEmit` and `npm run build` both
clean, `npm run docs:permissions:check` clean, the full RLS suite re-run
after the `phase16d` database change, and the new Troubleshoot audit-log
section verified live against real showcase data (including the org
filter). Step 7 was deliberately left undone — see its note above — because
the one thing that would make it safe (confirming with whoever owns the
external billing domain) isn't something this session can do on its own.
