-- role_permission_defaults.role has its own separate CHECK from
-- club_staff.role_check (a lesson from phase6k/6l: two constraints, not
-- one). Widening it to also admit the 9 new tournament_staff role strings --
-- 'treasurer'/'secretary' are intentionally shared with club_staff's own
-- vocabulary (same real-world role, different table, distinct (role,key)
-- pairs so no grant can cross-contaminate -- confirmed, not assumed).
alter table public.role_permission_defaults drop constraint role_permission_defaults_role_check;
alter table public.role_permission_defaults add constraint role_permission_defaults_role_check
  check (role = any (array[
    'club_manager', 'staff', 'coach', 'team_manager', 'assistant_coach', 'treasurer', 'secretary', 'club_it_admin',
    'organizer', 'tournament_it_admin', 'team_coordinator', 'logistics', 'communications',
    'volunteer_coordinator', 'referee_coordinator'
  ]));
