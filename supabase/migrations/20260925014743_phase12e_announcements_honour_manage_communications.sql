-- ann_write was `can_admin_club OR is_assigned_to_team(team_id)` as USING, but its
-- WITH CHECK was only `is_org_member(org_id)`. On an INSERT under an ALL policy
-- Postgres consults WITH CHECK alone, so ANY org member -- a guardian, the IT
-- admin, a treasurer -- could post an announcement to any audience, on any team.
-- Confirmed by test before this was written: guardian, IT admin and treasurer
-- inserts all succeeded. UPDATE/DELETE were properly fenced by USING, which is
-- why pinning and deleting looked fine.
--
-- It also never consulted the permission catalog: a secretary or staff member
-- holding manage_communications ("Send team/club announcements", club-scope) could
-- post only to a team they were assigned to, never club-wide -- the same "permission
-- granted, nothing honours it" shape as players_read (phase12d).
--
-- One expression now serves USING and WITH CHECK:
--   * can_admin_club                     -- club manager / org admin, any audience
--   * manage_communications at the club  -- club-scope, so any audience, any team
--   * an assigned team member            -- a team announcement for their own team
--                                          only (audience 'team'); a coach can no
--                                          longer attach a club-wide audience to
--                                          their team_id to slip past the check.
drop policy if exists ann_write on public.announcements;
create policy ann_write on public.announcements for all
using (
  is_org_member(org_id) and (
    can_admin_club(org_id, club_id)
    or has_staff_permission('manage_communications', club_id)
    or (audience = 'team' and is_assigned_to_team(team_id))
  )
)
with check (
  is_org_member(org_id) and (
    can_admin_club(org_id, club_id)
    or has_staff_permission('manage_communications', club_id)
    or (audience = 'team' and is_assigned_to_team(team_id))
  )
);
