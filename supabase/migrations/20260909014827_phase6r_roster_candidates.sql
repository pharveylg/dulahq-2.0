-- Phase C (CLAUDE.md §0f): make the roster workflow *visible*.
--
-- Phase 3 collapsed fill -> request acknowledgement -> finalize into one
-- "Submit Roster" click, explicitly because there was "nowhere to persist an
-- in-progress candidate list". That is the actual blocker to visibility: the
-- proposed roster lived in one person's browser, so a team manager could not
-- prepare something a coach picked up later, and no state existed for anyone
-- to observe.
--
-- This table is that missing persistence. Note what it is NOT: it stores no
-- status column. Every state the UI shows -- Draft / Proposed / Awaiting
-- guardian / Guardian confirmed / Guardian declined / Ready for review /
-- Finalized -- is DERIVED at read time from these rows plus approval_requests
-- plus tournament_roster. A stored status would be a second source of truth
-- that silently drifts from the approvals it claims to summarise, and since
-- the product decision is visibility rather than enforcement, there is
-- nothing to gain by storing it.
create table public.tournament_roster_candidates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null references public.tournament_entries(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  unique (entry_id, player_id)
);

create index tournament_roster_candidates_entry_idx
  on public.tournament_roster_candidates (entry_id);

alter table public.tournament_roster_candidates enable row level security;

-- Anyone who can see the tournament can see who is proposed for it -- that
-- is the point. Writing the proposal needs fill_tournament_roster, the same
-- permission Phase 3 already used for selecting players.
create policy trc_read on public.tournament_roster_candidates for select to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.tournament_entries e
      where e.id = tournament_roster_candidates.entry_id
        and (
          can_read_club(tournament_roster_candidates.org_id, e.club_id)
          or public.has_staff_permission('view_tournament', e.club_id, e.team_id)
        )
    )
  );

create policy trc_write on public.tournament_roster_candidates for all to authenticated
  using (
    is_org_member(org_id) and exists (
      select 1 from public.tournament_entries e
      where e.id = tournament_roster_candidates.entry_id
        and public.has_staff_permission('fill_tournament_roster', e.club_id, e.team_id)
    )
  )
  with check (
    is_org_member(org_id) and exists (
      select 1 from public.tournament_entries e
      where e.id = tournament_roster_candidates.entry_id
        and public.has_staff_permission('fill_tournament_roster', e.club_id, e.team_id)
    )
  );

revoke all on public.tournament_roster_candidates from anon;
