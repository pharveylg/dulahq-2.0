-- can_read_club(p_org, p_club) previously fell back to is_org_member(p_org).
-- Nearly every read policy is already written as
--   is_org_member(org_id) AND (can_read_club(org_id, club_id) OR ...)
-- with the SAME org_id passed to both calls. Once the outer is_org_member
-- gate passes, the inner "OR is_org_member(p_org)" is trivially true too,
-- so the whole club-scoping collapsed to "any org member can read any
-- club's data" -- silently erasing intra-org club/team/player isolation
-- for every table that uses can_read_club (players, training_sessions,
-- fee_charges, guardians, payments, evaluations, meetings, expenses,
-- memberships, documents, approvals, team_memberships, etc).
--
-- Fix: the org-wide override should require an actual org admin, not mere
-- org membership (which phase2i deliberately widened to include distant
-- roles -- a coach on one team, a guardian of one player -- specifically
-- so they aren't fenced out of their OWN club, not so they can read every
-- other club in the org).
create or replace function public.can_read_club(p_org uuid, p_club uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select public.is_club_staff(p_club) or public.is_org_admin(p_org);
$function$;
