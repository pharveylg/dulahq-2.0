-- Retire the two tournament roles seeded in phase8b with zero backing feature and zero
-- holders: 'logistics' and 'volunteer_coordinator'. Unlike review_tournament_entry (a
-- permission seeded ahead of its consuming feature, on a role that stayed), these two
-- roles themselves are retired -- so the permission keys they existed for
-- (manage_tournament_logistics, manage_tournament_volunteers) are removed outright too,
-- the same P0-2 precedent as the three dead guardian permissions: zero consumers anywhere,
-- confirmed live, not assumed. organizer's own grant of these two keys goes with them --
-- an org-wide permission with no screen and no role left to delegate it to is not worth
-- keeping "just in case".
--
-- Order matters: role_permission_defaults (which references permissions.key) is cleared
-- before permissions itself, and tournament_staff_permission_grants (a per-user override,
-- not role-keyed) is checked and cleared the same way in case anyone was ever granted one
-- directly.

do $$
declare v_staff_rows int; v_grant_rows int;
begin
  select count(*) into v_staff_rows from public.tournament_staff where role in ('logistics', 'volunteer_coordinator');
  if v_staff_rows > 0 then
    raise exception 'refusing to retire: % tournament_staff row(s) still hold the retired roles', v_staff_rows;
  end if;
  select count(*) into v_grant_rows from public.tournament_staff_permission_grants
   where permission_key in ('manage_tournament_logistics', 'manage_tournament_volunteers');
  if v_grant_rows > 0 then
    delete from public.tournament_staff_permission_grants
     where permission_key in ('manage_tournament_logistics', 'manage_tournament_volunteers');
  end if;
end $$;

delete from public.role_permission_defaults
 where role in ('logistics', 'volunteer_coordinator')
    or permission_key in ('manage_tournament_logistics', 'manage_tournament_volunteers');

delete from public.permissions where key in ('manage_tournament_logistics', 'manage_tournament_volunteers');

alter table public.tournament_staff drop constraint tournament_staff_role_check;
alter table public.tournament_staff add constraint tournament_staff_role_check
  check (role in (
    'organizer', 'tournament_it_admin', 'team_coordinator', 'secretary',
    'treasurer', 'communications', 'referee_coordinator'
  ));

alter table public.role_permission_defaults drop constraint role_permission_defaults_role_check;
alter table public.role_permission_defaults add constraint role_permission_defaults_role_check
  check (role = any (array[
    'club_manager', 'staff', 'coach', 'team_manager', 'assistant_coach', 'treasurer', 'secretary', 'club_it_admin',
    'organizer', 'tournament_it_admin', 'team_coordinator', 'communications', 'referee_coordinator'
  ]));
