-- phase2j narrowed the org-wide fallback but left the club-wide grant on
-- is_club_staff(p_club), which is true for ANY club_staff row regardless
-- of role. Per the app's own documented model (getClubAccess() in
-- src/lib/supabase/server.ts, added by rbac_phase1_narrow_coach_to_assigned_teams):
-- only platform admin and club_admin are club-wide; every other club_staff
-- role (coach/team_manager/staff) is scoped to their assigned teams via
-- is_assigned_to_team(), which read policies already OR in separately.
--
-- Without this, a club_staff row with role='coach' granted full club-wide
-- read (all teams' sessions, all players' fee charges, etc.) through
-- can_read_club, defeating the team-level scoping the coach role is meant
-- to have.
create or replace function public.can_read_club(p_org uuid, p_club uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.is_club_admin(p_club) or public.is_org_admin(p_org);
$function$;
