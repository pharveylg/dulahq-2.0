-- Phase 6b: wire the Phase 0 permission system into development_goals,
-- player_evaluations, player_skill_ratings, player_development_notes --
-- the tables the new canonical Player Profile's Development tab reads and
-- writes. Per CLAUDE.md §0c's plan: cut over one feature area's tables at a
-- time as the UI actually touches them, rather than one large rewrite.
--
-- All four tables' old write policies were literally
-- `can_admin_club(org_id, club_id) OR is_assigned_to_team(team_id)` -- the
-- exact thing Phase 0's has_staff_permission() was built to replace, and
-- club_admin needs no separate OR-clause any more: its role_permission_defaults
-- bundle already contains every staff permission, so has_staff_permission()
-- alone covers both cases app code used to check separately.
--
-- Two real behavior changes, both intentional:
--
-- 1. player_development_notes now enforces the Coach Module spec's "Separate:
--    Player-visible feedback / Private coach notes" at the database level --
--    writing a player/parent-visible note requires add_player_feedback,
--    writing a coach_only/staff note requires add_private_coach_note. Today
--    every coach/team_manager has both by default (see phase6a), so nothing
--    changes for anyone until a club_admin grants them separately.
--
-- 2. player_skill_ratings_read was `is_org_member(org_id) AND exists an
--    evaluation` -- no visibility check at all, so any org member could read
--    any rating regardless of the parent evaluation's own visibility. Found
--    while rewriting this exact policy for the new permission system;
--    tightened to mirror evals_read's own visibility logic rather than left
--    as a known gap, same as the phase2h-2k pattern in §0a/§0b.
--
-- Guardian/player read access is unchanged in shape (still keyed off each
-- row's own `visibility` column via is_guardian_of()/is_player_self()) but
-- now additionally requires the matching guardian-side permission
-- (view_development_guardian / view_evaluations / view_feedback) --
-- currently a no-op since every guardian's default bundle grants all of
-- them (phase6a), but now enforced rather than assumed if a club_admin ever
-- narrows a specific guardian relationship.

-- ============================================================
-- development_goals
-- ============================================================

drop policy "goals_write" on public.development_goals;
create policy "goals_write" on public.development_goals for all
  using (public.is_org_member(org_id) and public.has_staff_permission('manage_development', club_id, team_id))
  with check (public.is_org_member(org_id) and public.has_staff_permission('manage_development', club_id, team_id));

drop policy "goals_read" on public.development_goals;
create policy "goals_read" on public.development_goals for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_development_guardian', player_id))
      or (visibility = 'player_and_parent' and public.is_player_self(player_id))
    )
  );

-- ============================================================
-- player_evaluations
-- ============================================================

drop policy "evals_write" on public.player_evaluations;
create policy "evals_write" on public.player_evaluations for all
  using (public.is_org_member(org_id) and public.has_staff_permission('add_evaluation', club_id, team_id))
  with check (public.is_org_member(org_id) and public.has_staff_permission('add_evaluation', club_id, team_id));

drop policy "evals_read" on public.player_evaluations;
create policy "evals_read" on public.player_evaluations for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_evaluations', player_id))
      or (visibility = 'player_and_parent' and public.is_player_self(player_id))
    )
  );

-- ============================================================
-- player_skill_ratings
-- ============================================================

drop policy "ratings_write" on public.player_skill_ratings;
create policy "ratings_write" on public.player_skill_ratings for all
  using (
    public.is_org_member(org_id) and exists (
      select 1 from public.player_evaluations e
      where e.id = player_skill_ratings.evaluation_id and public.has_staff_permission('add_evaluation', e.club_id, e.team_id)
    )
  )
  with check (
    public.is_org_member(org_id) and exists (
      select 1 from public.player_evaluations e
      where e.id = player_skill_ratings.evaluation_id and public.has_staff_permission('add_evaluation', e.club_id, e.team_id)
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
        or (e.visibility = 'player_and_parent' and public.is_player_self(e.player_id))
      )
    )
  );

-- ============================================================
-- player_development_notes
-- ============================================================

drop policy "notes_write" on public.player_development_notes;
create policy "notes_write" on public.player_development_notes for all
  using (
    public.is_org_member(org_id) and (
      (visibility in ('coach_only', 'staff') and public.has_staff_permission('add_private_coach_note', club_id, team_id))
      or (visibility in ('player', 'parent', 'player_and_parent') and public.has_staff_permission('add_player_feedback', club_id, team_id))
    )
  )
  with check (
    public.is_org_member(org_id) and (
      (visibility in ('coach_only', 'staff') and public.has_staff_permission('add_private_coach_note', club_id, team_id))
      or (visibility in ('player', 'parent', 'player_and_parent') and public.has_staff_permission('add_player_feedback', club_id, team_id))
    )
  );

drop policy "notes_read" on public.player_development_notes;
create policy "notes_read" on public.player_development_notes for select
  using (
    public.is_org_member(org_id) and (
      public.has_staff_permission('view_development', club_id, team_id)
      or (visibility in ('player_and_parent', 'parent') and public.is_guardian_of(player_id) and public.has_guardian_permission('view_feedback', player_id))
      or (visibility = 'player_and_parent' and public.is_player_self(player_id))
    )
  );
