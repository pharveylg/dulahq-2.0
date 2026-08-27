-- Club Manager: Phase 3 — Role permission seed rows
--
-- Depends on 0003_role_permissions.sql (from dula-hq) for the
-- role_permissions table and has_permission() function -- neither is
-- redefined here, only extended with new rows for Club Manager's 5 roles.

insert into role_permissions (role, resource, action) values
  ('club_admin', 'club', 'update'),
  ('club_admin', 'club', 'view'),
  ('club_admin', 'teams', 'create'),
  ('club_admin', 'teams', 'update'),
  ('club_admin', 'players', 'create'),
  ('club_admin', 'players', 'update'),
  ('club_admin', 'finance', 'view'),
  ('club_admin', 'finance', 'update'),
  ('club_admin', 'logistics', 'view'),
  ('club_admin', 'logistics', 'update'),
  ('club_admin', 'announcements', 'create'),
  ('club_admin', 'club_staff', 'update'),

  ('team_manager', 'training_sessions', 'create'),
  ('team_manager', 'training_sessions', 'update'),
  ('team_manager', 'attendance', 'update'),
  ('team_manager', 'logistics', 'update'),
  ('team_manager', 'announcements', 'create'),

  ('coach', 'training_sessions', 'update'),
  ('coach', 'attendance', 'update'),
  ('coach', 'players', 'view'),

  ('guardian', 'fee_charges', 'view'),
  ('guardian', 'attendance', 'view'),
  ('guardian', 'players', 'view'),
  ('guardian', 'announcements', 'view'),

  ('player', 'players', 'view'),
  ('player', 'training_sessions', 'view'),
  ('player', 'announcements', 'view')
on conflict (role, resource, action) do nothing;
