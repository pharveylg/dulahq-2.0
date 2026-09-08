-- Phase 6c: fix a pre-existing read gap on development_goals,
-- player_evaluations, player_skill_ratings, player_development_notes,
-- found live-testing phase6b's rewritten policies against the showcase
-- data (a coach wrote a note with visibility='player'; the linked player
-- could not read it back).
--
-- All four tables' player-self read clause checked
-- `visibility = 'player_and_parent'` only -- the exact same predicate
-- phase6b's rewrite carried forward unchanged from the original phase3/4
-- policies, so this bug predates Phase 6 and isn't something the
-- permission-system cutover introduced. Coach-facing UI (Goals.tsx,
-- Evaluations.tsx, Notes.tsx) has always offered 'player' as its own
-- distinct visibility option, separate from 'player_and_parent' -- so
-- anything a coach marked plain "Player" was silently unreadable by that
-- player forever. Widening the player-self clause to
-- visibility IN ('player', 'player_and_parent') is the fix; the guardian
-- clause (visibility IN ('parent', 'player_and_parent')) was already
-- correct and is untouched.

drop policy "goals_read" on public.development_goals;
create policy "goals_read" on public.development_goals for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_development_guardian', player_id))
      or (visibility in ('player_and_parent', 'player') and public.is_player_self(player_id))
    )
  );

drop policy "evals_read" on public.player_evaluations;
create policy "evals_read" on public.player_evaluations for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_evaluations', player_id))
      or (visibility in ('player_and_parent', 'player') and public.is_player_self(player_id))
    )
  );

drop policy "ratings_read" on public.player_skill_ratings;
create policy "ratings_read" on public.player_skill_ratings for select
  using (
    public.is_org_member(org_id) and exists (
      select 1 from public.player_evaluations e
      where e.id = player_skill_ratings.evaluation_id and (
        public.has_staff_permission('view_development', e.club_id, e.team_id)
        or (e.visibility in ('player_and_parent', 'parent') and public.is_guardian_of(e.player_id) and public.has_guardian_permission('view_evaluations', e.player_id))
        or (e.visibility in ('player_and_parent', 'player') and public.is_player_self(e.player_id))
      )
    )
  );

drop policy "notes_read" on public.player_development_notes;
create policy "notes_read" on public.player_development_notes for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_feedback', player_id))
      or (visibility in ('player_and_parent', 'player') and public.is_player_self(player_id))
    )
  );
