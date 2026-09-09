-- Phase A part 2 (CLAUDE.md §0d): make the role bundles express the specs'
-- boundaries. Before this, `team_manager`'s default bundle was byte-identical
-- to `coach` (19 permissions, including add_private_coach_note,
-- manage_development, add_evaluation) -- the exact opposite of the Team
-- Manager spec's most emphasized rule, "player development remains a
-- Coach-owned function". And `club_manager` held all 26, including
-- development authoring and roster finalization, which the Club Manager spec
-- forbids (§19 read-only development, §29 no PREPARE/FINALIZE roster).
--
-- coach and staff bundles are deliberately untouched.

-- ---------- club_manager: business boss, no football authorship ----------
-- Removed vs before: add_evaluation, add_player_feedback,
-- add_private_coach_note, manage_development (spec §19, development is
-- read-only for this role -- view_development is retained); manage_lineup
-- (§33 lineup is Coach's); manage_attendance (§32 Coach records attendance,
-- view_attendance retained); fill_tournament_roster +
-- request_guardian_acknowledgement (§29 "Club Manager does not become the
-- roster preparer"); finalize_tournament_roster (§29 + explicit product
-- decision: finalization is coach or team_manager only).
delete from public.role_permission_defaults where role = 'club_manager';
insert into public.role_permission_defaults (role, permission_key) values
  ('club_manager','manage_club'),
  ('club_manager','manage_communications'),
  ('club_manager','manage_documents'),
  ('club_manager','manage_finances'),
  ('club_manager','manage_membership'),
  ('club_manager','manage_staff'),
  ('club_manager','manage_match'),
  ('club_manager','manage_training'),
  ('club_manager','edit_player_football_profile'),
  ('club_manager','export_tournament_roster'),
  ('club_manager','view_finances'),
  ('club_manager','view_attendance'),
  ('club_manager','view_development'),
  ('club_manager','view_medical'),
  ('club_manager','view_player'),
  ('club_manager','view_team'),
  ('club_manager','view_tournament');

-- ---------- team_manager: operations, not football development ----------
-- Removed vs before: add_evaluation, add_player_feedback,
-- add_private_coach_note, manage_development (Team Manager spec §8 --
-- read-only view_development is retained per §8's "limited/read-only
-- visibility... where the permission model explicitly permits");
-- manage_lineup (§27 lineup is Coach's); manage_attendance (§11 "Coach
-- records attendance", Team Manager views and reports).
-- finalize_tournament_roster is KEPT by explicit product decision, which
-- deviates from the spec's §15/§23 ("Coach has final authority... do NOT
-- grant FINALIZE_TOURNAMENT_ROSTER") -- recorded in §0d.
delete from public.role_permission_defaults where role = 'team_manager';
insert into public.role_permission_defaults (role, permission_key) values
  ('team_manager','manage_training'),
  ('team_manager','manage_match'),
  ('team_manager','edit_player_football_profile'),
  ('team_manager','fill_tournament_roster'),
  ('team_manager','request_guardian_acknowledgement'),
  ('team_manager','finalize_tournament_roster'),
  ('team_manager','export_tournament_roster'),
  ('team_manager','view_attendance'),
  ('team_manager','view_development'),
  ('team_manager','view_medical'),
  ('team_manager','view_player'),
  ('team_manager','view_team'),
  ('team_manager','view_tournament');

-- ---------- assistant_coach: supports the Coach, authors nothing ----------
delete from public.role_permission_defaults where role = 'assistant_coach';
insert into public.role_permission_defaults (role, permission_key) values
  ('assistant_coach','manage_attendance'),
  ('assistant_coach','view_attendance'),
  ('assistant_coach','view_development'),
  ('assistant_coach','view_medical'),
  ('assistant_coach','view_player'),
  ('assistant_coach','view_team'),
  ('assistant_coach','view_tournament');

-- ---------- treasurer: the finance specialist (Club Manager spec §21) -----
delete from public.role_permission_defaults where role = 'treasurer';
insert into public.role_permission_defaults (role, permission_key) values
  ('treasurer','manage_finances'),
  ('treasurer','view_finances'),
  ('treasurer','view_player'),
  ('treasurer','view_team'),
  ('treasurer','view_tournament');

-- ---------- secretary: records/administration (Club Manager spec §24) -----
delete from public.role_permission_defaults where role = 'secretary';
insert into public.role_permission_defaults (role, permission_key) values
  ('secretary','manage_documents'),
  ('secretary','manage_membership'),
  ('secretary','manage_communications'),
  ('secretary','view_player'),
  ('secretary','view_team'),
  ('secretary','view_tournament');
