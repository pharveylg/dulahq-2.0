-- Tournament organizer console (docs/tournament-organizer-console-proposal.md).
-- tournaments, tournament_entries and tournament_categories were readable
-- only through is_org_member, which has no tournament-staff branch (it
-- predates the tournament layer), so an Organizer who was not also an org
-- admin got zero rows -- they could call decide_tournament_entry on an entry
-- they could not list. Targeted policies rather than widening is_org_member,
-- which is the spine of ~60 policies and would hand tournament staff club and
-- player data.
--
-- Note can_read_tournament() is organizer-or-org-admin ONLY, so it can't be
-- reused here: team_coordinator and treasurer would still read nothing.
-- is_tournament_staff (any active staff role, suspension-aware) is the right
-- gate for "may see this tournament's entries and categories".
alter table public.tournament_categories
  add column if not exists entry_fee numeric(12,2) check (entry_fee is null or entry_fee >= 0),
  add column if not exists capacity integer check (capacity is null or capacity > 0);

drop policy if exists tournaments_staff_read on public.tournaments;
create policy tournaments_staff_read on public.tournaments for select to authenticated
using (public.is_tournament_staff(id));

drop policy if exists te_staff_read on public.tournament_entries;
create policy te_staff_read on public.tournament_entries for select to authenticated
using (public.is_tournament_staff(tournament_id));

drop policy if exists tc_staff_read on public.tournament_categories;
create policy tc_staff_read on public.tournament_categories for select to authenticated
using (public.is_tournament_staff(tournament_id));
